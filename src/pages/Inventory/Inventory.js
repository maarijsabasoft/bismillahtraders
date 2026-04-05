import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useListCache } from '../../context/ListCacheContext';
import { LIST_CACHE_KEYS } from '../../context/listCacheKeys';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import { FiPlus } from 'react-icons/fi';
import { useToast } from '../../context/ToastContext';
import {
  inventoryQuantitySignedDelta,
  sumInventorySignedQuantity,
} from '../../utils/inventoryStock';
import './Inventory.css';

const Inventory = () => {
  const { db, isReady, dataRevision } = useDatabase();
  const { toastError, toastSuccess } = useToast();
  const { readListCache, writeListCache } = useListCache();
  const [stockLevels, setStockLevels] = useState(
    () => readListCache(LIST_CACHE_KEYS.inventoryStock) ?? []
  );
  const [products, setProducts] = useState(
    () => readListCache(LIST_CACHE_KEYS.inventoryProducts) ?? []
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    product_id: '',
    transaction_type: 'IN',
    quantity: '',
    batch_number: '',
    expiry_date: '',
    notes: ''
  });

  useEffect(() => {
    if (isReady && db) {
      loadStockLevels();
    }
  }, [db, isReady, dataRevision]);

  useEffect(() => {
    writeListCache(LIST_CACHE_KEYS.inventoryStock, stockLevels);
  }, [stockLevels, writeListCache]);

  useEffect(() => {
    writeListCache(LIST_CACHE_KEYS.inventoryProducts, products);
  }, [products, writeListCache]);

  const loadStockLevels = async () => {
    try {
      const [productsResult, companiesResult, stockLevelsResult, inventoryResult] = await Promise.all([
        db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY name').all(),
        db.prepare('SELECT * FROM companies').all(),
        db.prepare('SELECT * FROM stock_levels').all(),
        db.prepare('SELECT product_id, quantity, transaction_type FROM inventory').all(),
      ]);
      
      const products = Array.isArray(productsResult) ? productsResult : [];
      const companies = Array.isArray(companiesResult) ? companiesResult : [];
      const stockLevels = Array.isArray(stockLevelsResult) ? stockLevelsResult : [];
      const inventoryTransactions = Array.isArray(inventoryResult) ? inventoryResult : [];
      
      // Create maps for quick lookup
      const companyMap = {};
      companies.forEach(company => {
        const id = company.id?.toString() || company._id?.toString();
        if (id) {
          companyMap[id] = company.name;
          // Also map integer version
          const idNum = parseInt(id);
          if (!isNaN(idNum)) {
            companyMap[idNum] = company.name;
            companyMap[String(idNum)] = company.name;
          }
        }
      });
      
      // Calculate actual stock from inventory transactions (source of truth)
      const calculatedStock = {};
      inventoryTransactions.forEach((transaction) => {
        const productId =
          transaction.product_id?.toString() ||
          transaction.productId?.toString() ||
          transaction.product_id ||
          transaction.productId;
        if (productId) {
          const idStr = String(productId);
          const delta = inventoryQuantitySignedDelta(transaction);

          if (!calculatedStock[idStr]) {
            calculatedStock[idStr] = 0;
          }
          calculatedStock[idStr] += delta;

          const idNum = parseInt(idStr, 10);
          if (!Number.isNaN(idNum)) {
            if (!calculatedStock[idNum]) {
              calculatedStock[idNum] = 0;
            }
            calculatedStock[idNum] += delta;
            calculatedStock[String(idNum)] = calculatedStock[idNum];
          }
        }
      });
      
      // Create stock map from stock_levels table (for threshold and updated_at)
      const stockMap = {};
      stockLevels.forEach(stock => {
        const productId = stock.product_id?.toString() || 
                         stock.productId?.toString() || 
                         stock.product_id || 
                         stock.productId;
        if (productId) {
          const idStr = String(productId);
          stockMap[idStr] = stock;
          const idNum = parseInt(idStr);
          if (!isNaN(idNum)) {
            stockMap[idNum] = stock;
            stockMap[String(idNum)] = stock;
          }
        }
      });
      
      // Join products with company names and stock levels
      const productsWithData = products.map(product => {
        const productId = product.id?.toString() || product._id?.toString() || product.id || product._id;
        const companyId = product.company_id?.toString() || product.companyId?.toString() || product.company_id || product.companyId;

        // Stock metadata (threshold, updated_at) from stock_levels
        let stock = stockMap[productId];
        if (!stock && productId) {
          const idNum = parseInt(String(productId), 10);
          if (!Number.isNaN(idNum)) {
            stock = stockMap[idNum] || stockMap[String(idNum)];
          }
        }

        /* Prefer stock_levels.quantity (updated by Sales / Inventory) — avoids product_id key drift vs transaction rows. */
        let currentStock;
        if (stock != null && stock.quantity != null) {
          currentStock = parseInt(stock.quantity, 10) || 0;
        } else {
          currentStock = calculatedStock[productId];
          if (currentStock === undefined && productId) {
            const idNum = parseInt(String(productId), 10);
            if (!Number.isNaN(idNum)) {
              currentStock = calculatedStock[idNum] || calculatedStock[String(idNum)];
            }
          }
          if (currentStock === undefined) {
            currentStock = 0;
          }
        }
        
        // Try multiple lookup strategies for company
        let companyName = companyMap[companyId];
        if (!companyName && companyId) {
          const idStr = String(companyId);
          const idNum = parseInt(idStr);
          companyName = companyMap[idStr] || companyMap[idNum] || companyMap[String(idNum)];
          
          // Fallback: direct search
          if (!companyName) {
            const foundCompany = companies.find(c => {
              const cId = c.id?.toString() || c._id?.toString() || c.id || c._id;
              return String(cId) === idStr || parseInt(String(cId)) === idNum;
            });
            if (foundCompany) {
              companyName = foundCompany.name;
            }
          }
        }
        
        return {
          id: productId,
          product_name: product.name,
          company_name: companyName || null,
          current_stock: currentStock !== undefined ? currentStock : 0,
          low_stock_threshold: stock?.low_stock_threshold || 10,
          updated_at: stock?.updated_at || null
        };
      });

      setProducts(products);
      setStockLevels(productsWithData);
    } catch (error) {
      console.error('Error loading stock levels:', error);
      setStockLevels([]);
      setProducts([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.product_id || !formData.quantity) {
      toastError('Please select a product and enter quantity');
      return;
    }

    try {
      const quantity = parseInt(formData.quantity);
      if (quantity <= 0) {
        toastError('Quantity must be greater than 0');
        return;
      }

      // Ensure product_id is in the correct format
      const productId = formData.product_id.toString();
      const transactionQuantity = formData.transaction_type === 'IN' ? quantity : -quantity;

      console.log('Inventory transaction:', {
        product_id: productId,
        type: formData.transaction_type,
        quantity: transactionQuantity
      });

      // Stock from existing transactions only (before this row is inserted)
      const priorTransactions = await db
        .prepare('SELECT quantity, transaction_type FROM inventory WHERE product_id = ?')
        .all(productId);
      const currentQuantity = sumInventorySignedQuantity(
        Array.isArray(priorTransactions) ? priorTransactions : []
      );

      const newQuantity = currentQuantity + transactionQuantity;
      if (newQuantity < 0) {
        toastError(`Insufficient stock. Current: ${currentQuantity}, cannot reduce by ${quantity}.`);
        return;
      }

      await db.prepare(`
        INSERT INTO inventory 
        (product_id, transaction_type, quantity, batch_number, expiry_date, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        productId,
        formData.transaction_type,
        transactionQuantity,
        formData.batch_number || null,
        formData.expiry_date || null,
        formData.notes || null
      );

      console.log('Stock update:', {
        currentQuantity,
        transactionQuantity,
        newQuantity
      });

      // Update stock_levels immediately to reflect new stock
      // Try to find existing stock level
      let existingStock = await db.prepare('SELECT * FROM stock_levels WHERE product_id = ?').get(productId);
      if (!existingStock) {
        const productIdInt = parseInt(productId);
        if (!isNaN(productIdInt)) {
          existingStock = await db.prepare('SELECT * FROM stock_levels WHERE product_id = ?').get(productIdInt);
        }
      }

      const stockPid =
        existingStock?.product_id != null ? existingStock.product_id : productId;

      if (existingStock) {
        await db.prepare(`
          UPDATE stock_levels 
          SET quantity = ?, updated_at = CURRENT_TIMESTAMP
          WHERE product_id = ?
        `).run(newQuantity, stockPid);
      } else {
        await db.prepare(`
          INSERT INTO stock_levels (product_id, quantity, low_stock_threshold, updated_at)
          VALUES (?, ?, 10, CURRENT_TIMESTAMP)
        `).run(productId, newQuantity);
      }

      // Reload stock levels IMMEDIATELY to show updated values in UI
      await loadStockLevels();
      
      // Close modal after successful save
      handleCloseModal();
      
      toastSuccess(
        `Stock ${formData.transaction_type === 'IN' ? 'IN' : 'OUT'} saved. New level: ${newQuantity}.`
      );
    } catch (error) {
      console.error('Error saving inventory:', error);
      toastError(`Error saving inventory: ${error.message || 'Unknown error'}`);
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({
      product_id: '',
      transaction_type: 'IN',
      quantity: '',
      batch_number: '',
      expiry_date: '',
      notes: ''
    });
  };

  const columns = [
    { 
      key: 'company_name', 
      label: 'Company', 
      width: '20%',
      render: (value) => value || 'N/A'
    },
    { 
      key: 'product_name', 
      label: 'Product', 
      width: '25%',
      render: (value) => value || 'N/A'
    },
    { 
      key: 'current_stock', 
      label: 'Current Stock', 
      width: '15%',
      render: (value) => value || 0
    },
    { 
      key: 'low_stock_threshold', 
      label: 'Low Stock Alert', 
      width: '15%',
      render: (value) => value || 10
    },
    { 
      key: 'updated_at', 
      label: 'Last Updated', 
      width: '20%',
      render: (value) => value ? new Date(value).toLocaleString() : '-'
    },
  ];

  return (
    <div className="inventory-page">
      <div className="page-header">
        <h1 className="page-title">Inventory Management</h1>
        <Button onClick={handleOpenModal}>
          <FiPlus /> Stock Transaction
        </Button>
      </div>

      <Card>
        <Table columns={columns} data={stockLevels} />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Stock Transaction"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="input-label">
              Product <span className="input-required">*</span>
            </label>
            <select
              className="input"
              value={formData.product_id}
              onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
              required
            >
              <option value="">Select Product</option>
              {Array.isArray(products) && products.map((p) => {
                const productId = p.id?.toString() || p._id?.toString() || p.id || p._id;
                return (
                  <option key={productId} value={productId}>
                    {p.name}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="form-group">
            <label className="input-label">
              Transaction Type <span className="input-required">*</span>
            </label>
            <select
              className="input"
              value={formData.transaction_type}
              onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
              required
            >
              <option value="IN">Stock IN</option>
              <option value="OUT">Stock OUT</option>
            </select>
          </div>

          <Input
            label="Quantity"
            type="number"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            required
            placeholder="Enter quantity"
          />

          <Input
            label="Batch Number"
            value={formData.batch_number}
            onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
            placeholder="Optional"
          />

          <Input
            label="Expiry Date"
            type="date"
            value={formData.expiry_date}
            onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
          />

          <Input
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Optional notes"
          />

          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit">Save Transaction</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Inventory;

