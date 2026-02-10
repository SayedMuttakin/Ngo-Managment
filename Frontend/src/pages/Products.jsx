import React, { useState, useEffect } from 'react';
import { Plus, Search, Package, RefreshCw } from 'lucide-react';
import ProductCard from '../components/products/ProductCard';
import ProductForm from '../components/products/ProductForm';
import { productsAPI } from '../utils/api';
import toast from 'react-hot-toast';

const Products = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [globalStats, setGlobalStats] = useState({
    totalProducts: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0
  });

  // Fetch products from API
  useEffect(() => {
    fetchProducts();
  }, [currentPage]);

  // Also refetch when search changes
  useEffect(() => {
    setCurrentPage(1); // Reset to page 1 on search
    fetchProducts();
  }, [searchTerm]);

  // Auto-refresh when page becomes visible (user switches back to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Page became visible, refreshing products...');
        fetchProducts(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const fetchProducts = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const params = {};

      if (searchTerm) params.search = searchTerm;

      // Add pagination params
      params.page = currentPage;
      params.limit = 50; // Keep 50 per page as default, but now we can navigate

      // Add cache-busting parameter for refresh
      if (isRefresh) {
        params._t = Date.now();
      }

      console.log('🔍 Fetching products with params:', params);
      const response = await productsAPI.getAll(params);
      console.log('📦 Products API response:', response);

      if (response.success) {
        const products = response.data || [];
        console.log(`✅ Loaded ${products.length} products:`, products);

        // Log each product's stock fields for debugging
        products.forEach((product, index) => {
          console.log(`📦 Product ${index + 1} (${product.name}):`, {
            totalStock: product.totalStock,
            availableStock: product.availableStock,
            stock: product.stock,
            unitPrice: product.unitPrice,
            price: product.price
          });
        });



        setProducts(products);
        if (response.pagination) {
          setTotalPages(response.pagination.pages || 1);
        }
        if (response.stats) {
          setGlobalStats(response.stats);
        }

        if (isRefresh) {
          toast.success('Products refreshed!');
        }
      } else {
        console.error('❌ API returned error:', response);
        toast.error('Failed to fetch products');
        setProducts([]);
      }
    } catch (error) {
      console.error('❌ Error fetching products:', error);
      toast.error('Error connecting to server');
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };



  // Handle product actions
  const handleAddProduct = async (productData) => {
    try {
      const response = await productsAPI.create(productData);

      if (response.success) {
        toast.success('Product added successfully!');
        setShowAddForm(false);
        await fetchProducts(); // Refresh the list
      } else {
        toast.error(response.message || 'Failed to add product');
      }
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Error adding product. Please try again.');
    }
  };

  const handleEditProduct = async (productData) => {
    try {
      console.log('📝 Updating product:', editingProduct._id || editingProduct.id, productData);
      const response = await productsAPI.update(editingProduct._id || editingProduct.id, productData);
      console.log('📋 Update response:', response);

      if (response.success) {
        toast.success('Product updated successfully! 🔄 Refreshing...');
        setEditingProduct(null);

        // Force refresh with loading indicator
        console.log('🔄 Refreshing products after update...');
        setRefreshing(true);

        // Small delay to ensure backend has processed the update
        setTimeout(async () => {
          await fetchProducts(true); // Use refresh mode to show loading
        }, 500);
      } else {
        console.error('❌ Update failed:', response);
        toast.error(response.message || 'Failed to update product');
      }
    } catch (error) {
      console.error('❌ Error updating product:', error);
      toast.error('Error updating product. Please try again.');
    }
  };

  const handleDeleteProduct = async (productId) => {
    const product = products.find(p => (p._id || p.id) === productId);
    const productName = product ? product.name : 'this product';

    const confirmMessage = `Are you sure you want to delete "${productName}"?\n\nThis will:\n• Remove the product from inventory\n• Hide it from all product listings\n• Preserve historical distribution records\n\nThis action cannot be undone.`;

    if (window.confirm(confirmMessage)) {
      try {
        console.log('🗑️ Deleting product:', productId, productName);
        const response = await productsAPI.delete(productId);

        if (response.success) {
          toast.success(`Product "${productName}" deleted successfully! 🗑️`);
          console.log('✅ Product deleted, refreshing list...');

          // Force refresh with loading indicator
          setRefreshing(true);
          setTimeout(async () => {
            await fetchProducts(true);
          }, 300);
        } else {
          console.error('❌ Delete failed:', response);
          toast.error(response.message || 'Failed to delete product');
        }
      } catch (error) {
        console.error('❌ Error deleting product:', error);
        toast.error('Error deleting product. Please try again.');
      }
    }
  };

  const handleUpdateStock = async (productId, stockChange) => {
    try {
      const product = products.find(p => (p._id || p.id) === productId);
      if (!product) {
        toast.error('Product not found');
        return;
      }

      const currentStock = product.availableStock || product.totalStock || product.stock || 0;
      const newStock = currentStock + stockChange;

      if (newStock < 0) {
        toast.error('Stock cannot be negative!');
        return;
      }

      console.log('📦 Updating stock:', product.name, 'from', currentStock, 'to', newStock);

      // Backend expects: { action: 'add'/'remove', quantity: number }
      const action = stockChange > 0 ? 'add' : 'remove';
      const quantity = Math.abs(stockChange);

      const response = await productsAPI.updateStock(productId, {
        action: action,
        quantity: quantity,
        reason: `Stock ${action === 'add' ? 'increased' : 'decreased'} by ${quantity}`
      });

      if (response.success) {
        toast.success(`Stock updated! ${currentStock} → ${newStock} (${stockChange > 0 ? '+' : ''}${stockChange})`);

        // Refresh products list
        setRefreshing(true);
        setTimeout(async () => {
          await fetchProducts(true);
        }, 300);
      } else {
        toast.error(response.message || 'Failed to update stock');
      }
    } catch (error) {
      console.error('❌ Error updating stock:', error);
      toast.error('Error updating stock. Please try again.');
    }
  };

  // Filter products based on search
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });




  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-md mb-3">
            <Package className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Product Management</h1>
          <p className="text-gray-500 text-sm">Manage inventory and track stock levels</p>
        </div>


        {/* Search and Filter */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search products by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
              />
            </div>

            <div className="flex items-center space-x-3">

              <div className="flex space-x-3">
                <button
                  onClick={() => fetchProducts(true)}
                  disabled={refreshing}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-blue-400 disabled:to-blue-400 text-white px-5 py-3.5 rounded-xl font-semibold transition-all flex items-center space-x-2 shadow-md hover:shadow-lg"
                >
                  <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>

                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3.5 rounded-xl font-semibold transition-all flex items-center space-x-2 shadow-md hover:shadow-lg"
                >
                  <Plus className="h-5 w-5" />
                  <span>Add Product</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Add/Edit Product Form */}
        {(showAddForm || editingProduct) && (
          <div className="mb-8">
            <ProductForm
              product={editingProduct}
              onSave={editingProduct ? handleEditProduct : handleAddProduct}
              onCancel={() => {
                setShowAddForm(false);
                setEditingProduct(null);
              }}
            />
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-500 text-lg">Loading products...</p>
          </div>
        )}

        {!loading && products.length >= 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg">
              <p className="text-blue-100 text-sm font-medium mb-1">Total Products</p>
              <p className="text-3xl font-bold">{globalStats.totalProducts}</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white shadow-lg">
              <p className="text-green-100 text-sm font-medium mb-1">In Stock</p>
              <p className="text-3xl font-bold">{globalStats.inStock}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl p-5 text-white shadow-lg">
              <p className="text-yellow-100 text-sm font-medium mb-1">Low Stock</p>
              <p className="text-3xl font-bold">{globalStats.lowStock}</p>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-5 text-white shadow-lg">
              <p className="text-red-100 text-sm font-medium mb-1">Out of Stock</p>
              <p className="text-3xl font-bold">{globalStats.outOfStock}</p>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product._id || product.id}
                product={product}
                onEdit={setEditingProduct}
                onDelete={handleDeleteProduct}
                onUpdateStock={handleUpdateStock}
              />
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && products.length > 0 && totalPages > 1 && (
          <div className="flex justify-center items-center space-x-2 mt-8 mb-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex space-x-1">
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                // Show first page, last page, current page, and pages around current
                if (
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-10 h-10 rounded-lg font-medium transition-all ${currentPage === pageNum
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                } else if (
                  (pageNum === currentPage - 2 && pageNum > 1) ||
                  (pageNum === currentPage + 2 && pageNum < totalPages)
                ) {
                  return <span key={pageNum} className="px-1 text-gray-400 self-end mb-2">...</span>;
                }
                return null;
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* No Products Found */}
        {!loading && filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-gray-100 p-6 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Package className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-gray-500 text-lg mb-2">
              {products.length === 0 ? 'No products available' : 'No products match your criteria'}
            </p>
            <p className="text-gray-400 mb-4">
              {products.length === 0
                ? 'Add your first product to get started'
                : 'Try adjusting your search or filter criteria'
              }
            </p>
            {products.length === 0 && (
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center space-x-2 mx-auto"
              >
                <Plus className="h-5 w-5" />
                <span>Add First Product</span>
              </button>
            )}
          </div>
        )}

      </div>
    </div >
  );
};

export default Products;