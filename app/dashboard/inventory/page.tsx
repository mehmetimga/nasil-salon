'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Package, AlertTriangle, TrendingUp, TrendingDown, Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Product {
  id: string;
  name: string;
  description: string;
  category_id: string;
  sku: string;
  unit_price: number;
  cost_price: number;
  is_active: boolean;
  low_stock_threshold: number;
  product_categories?: {
    name: string;
  };
  inventory?: {
    current_stock: number;
    available_stock: number;
  }[];
}

interface Category {
  id: string;
  name: string;
}

interface StockMovement {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  notes: string;
  created_at: string;
  products?: {
    name: string;
  };
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentMovements, setRecentMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    category_id: '',
    sku: '',
    unit_price: '',
    cost_price: '',
    low_stock_threshold: '10',
  });

  const [stockForm, setStockForm] = useState({
    movement_type: 'purchase',
    quantity: '',
    notes: '',
  });

  const supabase = createClient();

  useEffect(() => {
    checkUserRole();
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      setIsAdmin(roleData?.role === 'admin');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('product_categories')
        .select('*')
        .order('display_order');

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Fetch products with inventory
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          product_categories (name),
          inventory (current_stock, available_stock)
        `)
        .order('name');

      if (productsError) throw productsError;
      setProducts(productsData || []);

      // Fetch recent stock movements
      const { data: movementsData, error: movementsError } = await supabase
        .from('stock_movements')
        .select(`
          *,
          products (name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (movementsError) throw movementsError;
      setRecentMovements(movementsData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          name: productForm.name,
          description: productForm.description,
          category_id: productForm.category_id || null,
          sku: productForm.sku,
          unit_price: parseFloat(productForm.unit_price),
          cost_price: productForm.cost_price ? parseFloat(productForm.cost_price) : null,
          low_stock_threshold: parseInt(productForm.low_stock_threshold),
        })
        .select()
        .single();

      if (productError) throw productError;

      // Initialize inventory
      const { error: inventoryError } = await supabase
        .from('inventory')
        .insert({
          product_id: product.id,
          current_stock: 0,
        });

      if (inventoryError) throw inventoryError;

      toast.success('Product created successfully');
      setShowProductDialog(false);
      setProductForm({
        name: '',
        description: '',
        category_id: '',
        sku: '',
        unit_price: '',
        cost_price: '',
        low_stock_threshold: '10',
      });
      fetchData();
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error('Failed to create product');
    }
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProduct) return;

    try {
      const quantity = stockForm.movement_type === 'purchase' || stockForm.movement_type === 'return'
        ? parseInt(stockForm.quantity)
        : -parseInt(stockForm.quantity);

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('stock_movements')
        .insert({
          product_id: selectedProduct.id,
          movement_type: stockForm.movement_type,
          quantity,
          notes: stockForm.notes,
          created_by: user?.id,
        });

      if (error) throw error;

      toast.success('Stock updated successfully');
      setShowStockDialog(false);
      setStockForm({
        movement_type: 'purchase',
        quantity: '',
        notes: '',
      });
      setSelectedProduct(null);
      fetchData();
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Failed to update stock');
    }
  };

  const getLowStockCount = () => {
    return products.filter(p => {
      const stock = p.inventory?.[0]?.current_stock || 0;
      return stock <= p.low_stock_threshold;
    }).length;
  };

  const getTotalValue = () => {
    return products.reduce((total, product) => {
      const stock = product.inventory?.[0]?.current_stock || 0;
      return total + (stock * product.unit_price);
    }, 0);
  };

  const getStockStatus = (product: Product) => {
    const stock = product.inventory?.[0]?.current_stock || 0;
    if (stock === 0) return { label: 'Out of Stock', variant: 'destructive' as const };
    if (stock <= product.low_stock_threshold) return { label: 'Low Stock', variant: 'secondary' as const };
    return { label: 'In Stock', variant: 'default' as const };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="container mx-auto py-8 px-4">
          <div>Loading inventory...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          {isAdmin && (
            <Button onClick={() => setShowProductDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{products.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getLowStockCount()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${getTotalValue().toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Products Table */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Products</CardTitle>
            <CardDescription>
              Manage your retail products and track inventory levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const stock = product.inventory?.[0]?.current_stock || 0;
                  const status = getStockStatus(product);
                  
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          {product.description && (
                            <div className="text-sm text-gray-500">{product.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{product.product_categories?.name || '-'}</TableCell>
                      <TableCell>${product.unit_price.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{stock}</span>
                          {stock <= product.low_stock_threshold && stock > 0 && (
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedProduct(product);
                            setShowStockDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Adjust Stock
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Stock Movements */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Stock Movements</CardTitle>
            <CardDescription>
              Track recent inventory changes and adjustments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentMovements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>
                      {new Date(movement.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{movement.products?.name}</TableCell>
                    <TableCell>
                      <Badge variant={movement.quantity > 0 ? 'default' : 'destructive'}>
                        {movement.movement_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {movement.quantity > 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className={movement.quantity > 0 ? 'text-green-600' : 'text-red-600'}>
                          {Math.abs(movement.quantity)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{movement.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add Product Dialog */}
        <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
              <DialogDescription>
                Add a new retail product to your inventory
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <Label htmlFor="name">Product Name</Label>
                <Input
                  id="name"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={productForm.category_id}
                  onValueChange={(value) => setProductForm({ ...productForm, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={productForm.sku}
                  onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="unit_price">Unit Price</Label>
                  <Input
                    id="unit_price"
                    type="number"
                    step="0.01"
                    value={productForm.unit_price}
                    onChange={(e) => setProductForm({ ...productForm, unit_price: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="cost_price">Cost Price</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    step="0.01"
                    value={productForm.cost_price}
                    onChange={(e) => setProductForm({ ...productForm, cost_price: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="threshold">Low Stock Threshold</Label>
                <Input
                  id="threshold"
                  type="number"
                  value={productForm.low_stock_threshold}
                  onChange={(e) => setProductForm({ ...productForm, low_stock_threshold: e.target.value })}
                  required
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowProductDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Product</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Adjust Stock Dialog */}
        <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adjust Stock</DialogTitle>
              <DialogDescription>
                Update stock levels for {selectedProduct?.name}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleStockAdjustment} className="space-y-4">
              <div>
                <Label htmlFor="movement_type">Movement Type</Label>
                <Select
                  value={stockForm.movement_type}
                  onValueChange={(value) => setStockForm({ ...stockForm, movement_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchase">Purchase</SelectItem>
                    <SelectItem value="sale">Sale</SelectItem>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                    <SelectItem value="return">Return</SelectItem>
                    <SelectItem value="damage">Damage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={stockForm.quantity}
                  onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={stockForm.notes}
                  onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })}
                  placeholder="Optional notes about this adjustment"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowStockDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">Update Stock</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}