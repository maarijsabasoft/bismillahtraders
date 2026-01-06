import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import { FiPlus } from 'react-icons/fi';
import './Inventory.css';

const Inventory = () => {
  const { db, isReady } = useDatabase();
  const [stockLevels, setStockLevels] = useState([]);
  const [products, setProducts] = useState([]);
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
      loadProducts();
    }
  }, [db, isReady]);

  const loadProducts = async () => {
    try {
      const result = await db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY name').all();
      setProducts(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    }
  };

  const loadStockLevels = async () => {
    try {
      // Fetch products, companies, stock levels, and inventory transactions
      const productsResult = await db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY name').all();
      const companiesResult = await db.prepare('SELECT * FROM companies').all();
      const stockLevelsResult = await db.prepare('SELECT * FROM stock_levels').all();
      const inventoryResult = await db.prepare('SELECT product_id, quantity FROM inventory').all();
      
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
      inventoryTransactions.forEach(transaction => {
        const productId = transaction.product_id?.toString() || 
                         transaction.productId?.toString() || 
                         transaction.product_id || 
                         transaction.productId;
        if (productId) {
          const idStr = String(productId);
          const quantity = parseInt(transaction.quantity) || 0;
          
          if (!calculatedStock[idStr]) {
            calculatedStock[idStr] = 0;
          }
          calculatedStock[idStr] += quantity;
          
          // Also track integer version
          const idNum = parseInt(idStr);
          if (!isNaN(idNum)) {
            if (!calculatedStock[idNum]) {
              calculatedStock[idNum] = 0;
            }
            calculatedStock[idNum] += quantity;
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
        
        // Get calculated stock from transactions (source of truth)
        // Default to 0 if no transactions exist
        let currentStock = calculatedStock[productId];
        if (currentStock === undefined && productId) {
          const idNum = parseInt(String(productId));
          if (!isNaN(idNum)) {
            currentStock = calculatedStock[idNum] || calculatedStock[String(idNum)];
          }
        }
        // If still undefined (no transactions), default to 0
        if (currentStock === undefined) {
          currentStock = 0;
        }
        
        // Get stock metadata (threshold, updated_at) from stock_levels
        let stock = stockMap[productId];
        if (!stock && productId) {
          const idNum = parseInt(String(productId));
          if (!isNaN(idNum)) {
            stock = stockMap[idNum] || stockMap[String(idNum)];
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
      
      setStockLevels(productsWithData);
    } catch (error) {
      console.error('Error loading stock levels:', error);
      setStockLevels([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.product_id || !formData.quantity) {
      alert('Please select a product and enter quantity');
      return;
    }

    try {
      const quantity = parseInt(formData.quantity);
      if (quantity <= 0) {
        alert('Quantity must be greater than 0');
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

      // Insert inventory transaction
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

      // Get current stock level - calculate from inventory transactions (source of truth)
      // Default to 0 if no transactions exist
      const allTransactions = await db.prepare('SELECT quantity FROM inventory WHERE product_id = ?').all(productId);
      let currentQuantity = 0;
      
      if (Array.isArray(allTransactions) && allTransactions.length > 0) {
        // Sum all transaction quantities to get current stock
        currentQuantity = allTransactions.reduce((sum, t) => {
          const qty = parseInt(t.quantity) || 0;
          return sum + qty;
        }, 0);
      }
      
      // Calculate new quantity after this transaction
      const newQuantity = currentQuantity + transactionQuantity;
      
      // Ensure new quantity is not negative for OUT transactions
      if (newQuantity < 0) {
        alert(`Insufficient stock! Current stock: ${currentQuantity}, cannot reduce by ${quantity}`);
        return;
      }

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

      if (existingStock) {
        // Update existing stock level immediately
        await db.prepare(`
          UPDATE stock_levels 
          SET quantity = ?, updated_at = CURRENT_TIMESTAMP
          WHERE product_id = ?
        `).run(newQuantity, productId);
      } else {
        // Create new stock level entry - starts at 0, then adds/subtracts transaction
        await db.prepare(`
          INSERT INTO stock_levels (product_id, quantity, low_stock_threshold, updated_at)
          VALUES (?, ?, 10, CURRENT_TIMESTAMP)
        `).run(productId, newQuantity);
      }

      // Reload stock levels IMMEDIATELY to show updated values in UI
      await loadStockLevels();
      
      // Close modal after successful save
      handleCloseModal();
      
      // Show success message with new stock level
      alert(`Stock ${formData.transaction_type === 'IN' ? 'IN' : 'OUT'} transaction saved!\nNew stock level: ${newQuantity}`);
    } catch (error) {
      console.error('Error saving inventory:', error);
      alert(`Error saving inventory transaction: ${error.message || 'Unknown error'}`);
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    // Reload products when opening modal to ensure latest data
    loadProducts();
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

