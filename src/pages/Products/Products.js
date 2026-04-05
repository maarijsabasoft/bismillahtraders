import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useDatabase } from '../../context/DatabaseContext';
import { useListCache } from '../../context/ListCacheContext';
import { LIST_CACHE_KEYS } from '../../context/listCacheKeys';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import { FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import { mongoCrudErrorMessage } from '../../utils/mongoErrors';
import { useToast } from '../../context/ToastContext';
import './Products.css';

function sortCompaniesByName(rows) {
  if (!Array.isArray(rows)) return [];
  return [...rows].sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
  );
}

function readCachedCompaniesForDropdown(readListCache) {
  const pc = readListCache(LIST_CACHE_KEYS.productsCompanies);
  if (pc?.length) return pc;
  const c = readListCache(LIST_CACHE_KEYS.companies);
  return c?.length ? sortCompaniesByName(c) : [];
}

const Products = () => {
  const { db, isReady, dbMode, dataRevision } = useDatabase();
  const { toastError } = useToast();
  const { readListCache, writeListCache } = useListCache();
  const location = useLocation();
  const [products, setProducts] = useState(
    () => readListCache(LIST_CACHE_KEYS.productsRows) ?? []
  );
  const [companies, setCompanies] = useState(() =>
    readCachedCompaniesForDropdown(readListCache)
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    company_id: '',
    name: '',
    sku: '',
    barcode: '',
    category: '',
    bottle_size: '',
    purchase_price: '',
    sale_price: '',
    tax_rate: '0',
    discount_rate: '0',
    is_active: true
  });

  useEffect(() => {
    if (isReady && db && location.pathname === '/products') {
      loadProducts();
    }
  }, [db, isReady, dataRevision, location.pathname]);

  useEffect(() => {
    writeListCache(LIST_CACHE_KEYS.productsRows, products);
  }, [products, writeListCache]);

  useEffect(() => {
    writeListCache(LIST_CACHE_KEYS.productsCompanies, companies);
  }, [companies, writeListCache]);

  const normalizeCompanyIdForDb = (raw) => {
    if (dbMode === 'mongodb') {
      return String(raw == null ? '' : raw).trim();
    }
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) ? n : 0;
  };

  const loadProducts = async () => {
    try {
      const companiesPromise = db.prepare('SELECT * FROM companies ORDER BY name').all();
      const productsPromise = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();

      companiesPromise
        .then((companiesEarly) => {
          const rows = Array.isArray(companiesEarly) ? companiesEarly : [];
          if (rows.length > 0) {
            setCompanies(sortCompaniesByName(rows));
          }
        })
        .catch(() => {});

      const [productsResult, companiesResult] = await Promise.all([
        productsPromise,
        companiesPromise,
      ]);

      const products = Array.isArray(productsResult) ? productsResult : [];
      const companies = Array.isArray(companiesResult) ? companiesResult : [];
      
      // Create a map of company_id to company_name for quick lookup
      // Handle all possible ID formats (string, integer, ObjectId)
      const companyMap = {};
      companies.forEach(company => {
        // Try all possible ID field names and formats
        const id = company.id?.toString() || 
                   company._id?.toString() || 
                   company.id || 
                   company._id;
        if (id) {
          const idStr = String(id);
          companyMap[idStr] = company.name;
          // Also map integer version if it's a number
          const idNum = parseInt(idStr);
          if (!isNaN(idNum)) {
            companyMap[idNum] = company.name;
            companyMap[String(idNum)] = company.name;
          }
        }
      });
      
      // Join products with company names
      const productsWithCompanies = products.map(product => {
        // Try all possible company_id formats
        const companyId = product.company_id?.toString() || 
                         product.companyId?.toString() || 
                         product.company_id || 
                         product.companyId;
        
        let companyName = null;
        if (companyId) {
          // Try multiple lookup strategies
          const idStr = String(companyId);
          const idNum = parseInt(idStr);
          
          companyName = companyMap[idStr] || 
                       companyMap[idNum] || 
                       companyMap[String(idNum)] ||
                       companyMap[companyId];
          
          // If still not found, try to find by matching any numeric conversion
          if (!companyName && !isNaN(idNum)) {
            // Try to find company by comparing all possible ID formats
            const foundCompany = companies.find(c => {
              const cId = c.id?.toString() || c._id?.toString() || c.id || c._id;
              return String(cId) === idStr || 
                     parseInt(String(cId)) === idNum ||
                     String(cId) === String(idNum);
            });
            if (foundCompany) {
              companyName = foundCompany.name;
            }
          }
        }
        
        return {
          ...product,
          company_name: companyName
        };
      });

      setProducts(productsWithCompanies);
      setCompanies(sortCompaniesByName(companies));
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.company_id) return;

    const data = {
      ...formData,
      purchase_price: parseFloat(formData.purchase_price) || 0,
      sale_price: parseFloat(formData.sale_price) || 0,
      tax_rate: parseFloat(formData.tax_rate) || 0,
      discount_rate: parseFloat(formData.discount_rate) || 0,
      is_active: formData.is_active ? 1 : 0,
    };

    const companyIdForDb = normalizeCompanyIdForDb(data.company_id);
    if (dbMode === 'mongodb' && !companyIdForDb) {
      toastError('Please select a company.');
      return;
    }

    const companyName =
      companies.find((c) => String(c.id) === String(companyIdForDb))?.name ?? null;
    const now = new Date().toISOString();

    const buildRow = (id, pending) => ({
      id,
      company_id: companyIdForDb,
      company_name: companyName,
      name: data.name,
      sku: data.sku || null,
      barcode: data.barcode || null,
      category: data.category || null,
      bottle_size: data.bottle_size || null,
      purchase_price: data.purchase_price,
      sale_price: data.sale_price,
      tax_rate: data.tax_rate,
      discount_rate: data.discount_rate,
      is_active: data.is_active,
      created_at: now,
      updated_at: now,
      ...(pending ? { __pending: true } : {}),
    });

    if (editingProduct) {
      const ed = editingProduct;
      const rollbackForm = { ...formData };
      const snapshot = products.map((p) => ({ ...p }));
      setProducts((prev) =>
        prev.map((p) =>
          String(p.id) === String(ed.id) ? { ...buildRow(p.id, false), created_at: p.created_at || now } : p
        )
      );
      handleCloseModal();
      try {
        await db.prepare(`
          UPDATE products 
          SET company_id = ?, name = ?, sku = ?, barcode = ?, category = ?,
              bottle_size = ?, purchase_price = ?, sale_price = ?, tax_rate = ?,
              discount_rate = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          companyIdForDb, data.name, data.sku || null, data.barcode || null,
          data.category || null, data.bottle_size || null, data.purchase_price,
          data.sale_price, data.tax_rate, data.discount_rate, data.is_active,
          ed.id
        );
      } catch (error) {
        console.error('Error saving product:', error);
        setProducts(snapshot);
        setEditingProduct(ed);
        setFormData(rollbackForm);
        setIsModalOpen(true);
        toastError(
          `Could not save product.\n\n${mongoCrudErrorMessage(error, dbMode, {
            duplicateHint: 'SKU must be unique. Clear SKU or use a different one.',
          })}`
        );
      }
      return;
    }

    const tempId = `__pending_${Date.now()}`;
    setProducts((prev) => [buildRow(tempId, true), ...prev]);
    handleCloseModal();

    try {
      const out = await db.prepare(`
        INSERT INTO products 
        (company_id, name, sku, barcode, category, bottle_size, purchase_price, 
         sale_price, tax_rate, discount_rate, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        companyIdForDb, data.name, data.sku || null, data.barcode || null,
        data.category || null, data.bottle_size || null, data.purchase_price,
        data.sale_price, data.tax_rate, data.discount_rate, data.is_active
      );
      const newId = out?.lastInsertRowid != null ? String(out.lastInsertRowid) : null;
      if (newId) {
        setProducts((prev) =>
          prev.map((p) => (p.id === tempId ? { ...buildRow(newId, false) } : p))
        );
      } else {
        await loadProducts();
      }
    } catch (error) {
      console.error('Error saving product:', error);
      setProducts((prev) => prev.filter((p) => p.id !== tempId));
      toastError(
        `Could not save product.\n\n${mongoCrudErrorMessage(error, dbMode, {
          duplicateHint: 'SKU must be unique. Clear SKU or use a different one.',
        })}`
      );
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    // Handle company_id in various formats
    const companyId = product.company_id?.toString() || 
                     product.companyId?.toString() || 
                     product.company_id || 
                     product.companyId || 
                     '';
    setFormData({
      company_id: companyId,
      name: product.name,
      sku: product.sku || '',
      barcode: product.barcode || '',
      category: product.category || '',
      bottle_size: product.bottle_size || '',
      purchase_price: product.purchase_price?.toString() || '0',
      sale_price: product.sale_price?.toString() || '0',
      tax_rate: product.tax_rate?.toString() || '0',
      discount_rate: product.discount_rate?.toString() || '0',
      is_active: product.is_active === 1
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (String(id).startsWith('__pending_')) return;
    if (window.confirm('Are you sure you want to delete this product?')) {
      const snapshot = products.map((p) => ({ ...p }));
      const idStr = String(id);
      setProducts((prev) => prev.filter((p) => String(p.id) !== idStr));
      try {
        await db.prepare('DELETE FROM products WHERE id = ?').run(id);
      } catch (error) {
        console.error('Error deleting product:', error);
        setProducts(snapshot);
        toastError(`Could not delete product.\n\n${mongoCrudErrorMessage(error, dbMode)}`);
      }
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    const seeded = readCachedCompaniesForDropdown(readListCache);
    if (seeded.length > 0) {
      setCompanies(seeded);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData({
      company_id: '',
      name: '',
      sku: '',
      barcode: '',
      category: '',
      bottle_size: '',
      purchase_price: '',
      sale_price: '',
      tax_rate: '0',
      discount_rate: '0',
      is_active: true
    });
  };

  const columns = [
    { 
      key: 'company_name', 
      label: 'Company', 
      width: '15%',
      render: (value) => value || 'N/A'
    },
    { key: 'name', label: 'Product Name', width: '20%' },
    { key: 'sku', label: 'SKU', width: '10%' },
    { key: 'category', label: 'Category', width: '12%' },
    { key: 'bottle_size', label: 'Size', width: '8%' },
    { 
      key: 'purchase_price', 
      label: 'Purchase Price', 
      width: '10%',
      render: (value) => `Rs. ${parseFloat(value || 0).toFixed(2)}`
    },
    { 
      key: 'sale_price', 
      label: 'Sale Price', 
      width: '10%',
      render: (value) => `Rs. ${parseFloat(value || 0).toFixed(2)}`
    },
    { 
      key: 'is_active', 
      label: 'Status', 
      width: '8%',
      render: (value) => (
        <span className={value === 1 ? 'status-active' : 'status-inactive'}>
          {value === 1 ? 'Active' : 'Inactive'}
        </span>
      )
    },
  ];

  return (
    <div className="products-page">
      <div className="page-header">
        <h1 className="page-title">Products</h1>
        <Button onClick={handleOpenModal}>
          <FiPlus /> Add Product
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          data={products}
          actions={(row) => {
            const pending = String(row.id).startsWith('__pending_');
            return (
              <>
                <Button
                  variant="secondary"
                  size="small"
                  disabled={pending}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(row);
                  }}
                >
                  <FiEdit2 />
                </Button>
                <Button
                  variant="danger"
                  size="small"
                  disabled={pending}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(row.id);
                  }}
                >
                  <FiTrash2 />
                </Button>
              </>
            );
          }}
        />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        size="large"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="input-label">
                Company <span className="input-required">*</span>
              </label>
              <select
                className="input"
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                required
              >
                <option value="">Select Company</option>
                {Array.isArray(companies) && companies.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Product Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g., Cola 500ml"
            />
          </div>

          <div className="form-row">
            <Input
              label="SKU"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              placeholder="Product SKU"
            />
            <Input
              label="Barcode"
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              placeholder="Barcode"
            />
          </div>

          <div className="form-row">
            <Input
              label="Category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., Soft Drinks, Juices"
            />
            <Input
              label="Bottle Size"
              value={formData.bottle_size}
              onChange={(e) => setFormData({ ...formData, bottle_size: e.target.value })}
              placeholder="e.g., 250ml, 500ml, 1L"
            />
          </div>

          <div className="form-row">
            <Input
              label="Purchase Price"
              type="number"
              step="0.01"
              value={formData.purchase_price}
              onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
              required
            />
            <Input
              label="Sale Price"
              type="number"
              step="0.01"
              value={formData.sale_price}
              onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
              required
            />
          </div>

          <div className="form-row">
            <Input
              label="Tax Rate (%)"
              type="number"
              step="0.01"
              value={formData.tax_rate}
              onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
            />
            <Input
              label="Discount Rate (%)"
              type="number"
              step="0.01"
              value={formData.discount_rate}
              onChange={(e) => setFormData({ ...formData, discount_rate: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="input-label">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                style={{ marginRight: 8 }}
              />
              Active
            </label>
          </div>

          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit">
              {editingProduct ? 'Update' : 'Add'} Product
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Products;

