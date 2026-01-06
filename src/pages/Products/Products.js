import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import { FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import './Products.css';

const Products = () => {
  const { db, isReady } = useDatabase();
  const [products, setProducts] = useState([]);
  const [companies, setCompanies] = useState([]);
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
    if (isReady && db) {
      loadProducts();
      loadCompanies();
    }
  }, [db, isReady]);

  const loadCompanies = async () => {
    try {
      const result = await db.prepare('SELECT * FROM companies ORDER BY name').all();
      setCompanies(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Error loading companies:', error);
      setCompanies([]);
    }
  };

  const loadProducts = async () => {
    try {
      // Fetch products and companies separately (MongoDB doesn't support JOINs)
      const productsResult = await db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
      const companiesResult = await db.prepare('SELECT * FROM companies').all();
      
      const products = Array.isArray(productsResult) ? productsResult : [];
      const companies = Array.isArray(companiesResult) ? companiesResult : [];
      
      // Create a map of company_id to company_name for quick lookup
      const companyMap = {};
      companies.forEach(company => {
        // Handle both string and integer IDs
        const id = company.id?.toString() || company._id?.toString();
        if (id) {
          companyMap[id] = company.name;
        }
      });
      
      // Join products with company names
      const productsWithCompanies = products.map(product => ({
        ...product,
        company_name: companyMap[product.company_id?.toString()] || companyMap[product.companyId?.toString()] || null
      }));
      
      setProducts(productsWithCompanies);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.company_id) return;

    try {
      const data = {
        ...formData,
        purchase_price: parseFloat(formData.purchase_price) || 0,
        sale_price: parseFloat(formData.sale_price) || 0,
        tax_rate: parseFloat(formData.tax_rate) || 0,
        discount_rate: parseFloat(formData.discount_rate) || 0,
        is_active: formData.is_active ? 1 : 0
      };

      if (editingProduct) {
        await db.prepare(`
          UPDATE products 
          SET company_id = ?, name = ?, sku = ?, barcode = ?, category = ?,
              bottle_size = ?, purchase_price = ?, sale_price = ?, tax_rate = ?,
              discount_rate = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          parseInt(data.company_id), data.name, data.sku || null, data.barcode || null,
          data.category || null, data.bottle_size || null, data.purchase_price,
          data.sale_price, data.tax_rate, data.discount_rate, data.is_active,
          editingProduct.id
        );
      } else {
        await db.prepare(`
          INSERT INTO products 
          (company_id, name, sku, barcode, category, bottle_size, purchase_price, 
           sale_price, tax_rate, discount_rate, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          parseInt(data.company_id), data.name, data.sku || null, data.barcode || null,
          data.category || null, data.bottle_size || null, data.purchase_price,
          data.sale_price, data.tax_rate, data.discount_rate, data.is_active
        );
      }
      
      // Reload products after successful operation
      await loadProducts();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error saving product.');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      company_id: product.company_id.toString(),
      name: product.name,
      sku: product.sku || '',
      barcode: product.barcode || '',
      category: product.category || '',
      bottle_size: product.bottle_size || '',
      purchase_price: product.purchase_price.toString(),
      sale_price: product.sale_price.toString(),
      tax_rate: product.tax_rate.toString(),
      discount_rate: product.discount_rate.toString(),
      is_active: product.is_active === 1
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await db.prepare('DELETE FROM products WHERE id = ?').run(id);
        // Reload products after successful deletion
        await loadProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Cannot delete product. It may have associated sales or inventory.');
      }
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    // Reload companies when opening modal to ensure latest data
    loadCompanies();
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
          actions={(row) => (
            <>
              <Button
                variant="secondary"
                size="small"
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(row.id);
                }}
              >
                <FiTrash2 />
              </Button>
            </>
          )}
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
                  <option key={c.id} value={c.id}>
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

