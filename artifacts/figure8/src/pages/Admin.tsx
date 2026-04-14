import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAdminStats,
  useListAdminOrders,
  useListProducts,
  useListCustomers,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Users, ShoppingBag, DollarSign, Package, Plus, Pencil, Trash2, Upload } from "lucide-react";
import { format } from "date-fns";
import { getToken } from "@/lib/auth";

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  category: string;
  sizes: string;
  stock: string;
  isFeatured: boolean;
}

const emptyForm: ProductFormData = {
  name: "",
  description: "",
  price: "",
  imageUrl: "",
  category: "tops",
  sizes: "XS,S,M,L,XL",
  stock: "0",
  isFeatured: false,
};

function ProductFormDialog({
  open,
  onOpenChange,
  initialData,
  productId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: ProductFormData;
  productId?: number;
  onDone: () => void;
}) {
  const [form, setForm] = useState<ProductFormData>(initialData ?? emptyForm);
  const [imageMode, setImageMode] = useState<"url" | "upload">("url");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const isEdit = !!productId;

  const handleChange = (key: keyof ProductFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const token = getToken();
      if (!token) throw new Error("Not authenticated");
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload/image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Upload failed");
      }
      const { url } = await res.json() as { url: string };
      handleChange("imageUrl", url);
      toast({ title: "Image uploaded successfully" });
    } catch (e) {
      toast({ variant: "destructive", title: "Image upload failed", description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!form.name || !form.description || !form.price || !form.imageUrl) {
      toast({ variant: "destructive", title: "Please fill all required fields" });
      return;
    }
    const payload = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      imageUrl: form.imageUrl,
      category: form.category,
      sizes: form.sizes.split(",").map((s) => s.trim()).filter(Boolean),
      stock: parseInt(form.stock, 10) || 0,
      isFeatured: form.isFeatured,
    };

    if (isEdit && productId) {
      updateProduct.mutate(
        { id: productId, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            toast({ title: "Product updated" });
            onDone();
            onOpenChange(false);
          },
          onError: () => toast({ variant: "destructive", title: "Failed to update product" }),
        }
      );
    } else {
      createProduct.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            toast({ title: "Product created" });
            onDone();
            onOpenChange(false);
          },
          onError: () => toast({ variant: "destructive", title: "Failed to create product" }),
        }
      );
    }
  };

  const isPending = createProduct.isPending || updateProduct.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Product" : "Add New Product"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => handleChange("name", e.target.value)} placeholder="Product name" />
          </div>
          <div className="grid gap-1.5">
            <Label>Description *</Label>
            <Input value={form.description} onChange={(e) => handleChange("description", e.target.value)} placeholder="Product description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Price ($) *</Label>
              <Input type="number" step="0.01" value={form.price} onChange={(e) => handleChange("price", e.target.value)} placeholder="0.00" />
            </div>
            <div className="grid gap-1.5">
              <Label>Stock</Label>
              <Input type="number" value={form.stock} onChange={(e) => handleChange("stock", e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Product Image *</Label>
              <div className="flex rounded-md border text-xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => setImageMode("url")}
                  className={`px-2 py-1 ${imageMode === "url" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                >
                  URL
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode("upload")}
                  className={`px-2 py-1 ${imageMode === "upload" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                >
                  Upload
                </button>
              </div>
            </div>
            {imageMode === "url" ? (
              <Input value={form.imageUrl} onChange={(e) => handleChange("imageUrl", e.target.value)} placeholder="https://..." />
            ) : (
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-none"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Uploading..." : "Choose Image File"}
                </Button>
                {form.imageUrl && (
                  <p className="text-xs text-muted-foreground truncate">Uploaded: {form.imageUrl}</p>
                )}
              </div>
            )}
            {form.imageUrl && (
              <img src={form.imageUrl} alt="Preview" className="h-20 w-20 object-cover rounded border" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.category}
                onChange={(e) => handleChange("category", e.target.value)}
              >
                <option value="sets">Sets</option>
                <option value="tops">Tops</option>
                <option value="bottoms">Bottoms</option>
                <option value="accessories">Accessories</option>
                <option value="new">New Arrivals</option>
                <option value="athleisure">Athleisure</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Sizes (comma separated)</Label>
              <Input value={form.sizes} onChange={(e) => handleChange("sizes", e.target.value)} placeholder="XS,S,M,L,XL" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isFeatured"
              checked={form.isFeatured}
              onChange={(e) => handleChange("isFeatured", e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <Label htmlFor="isFeatured" className="cursor-pointer">Featured product</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-none">Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending} className="rounded-none uppercase tracking-widest">
            {isPending ? "Saving..." : isEdit ? "Update Product" : "Create Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Admin() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: orders, isLoading: ordersLoading } = useListAdminOrders();
  const { data: products, isLoading: productsLoading } = useListProducts();
  const { data: customers, isLoading: customersLoading } = useListCustomers();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteProduct = useDeleteProduct();

  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowProductForm(true);
  };

  const handleDelete = (productId: number) => {
    deleteProduct.mutate(
      { id: productId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          toast({ title: "Product deleted" });
          setDeleteConfirm(null);
        },
        onError: () => toast({ variant: "destructive", title: "Failed to delete product" }),
      }
    );
  };

  if (statsLoading || ordersLoading || productsLoading || customersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/10">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/10 pb-20">
      <header className="bg-primary text-primary-foreground py-12 px-6 shadow-md">
        <div className="container mx-auto">
          <h1 className="text-3xl font-serif font-bold">Admin Dashboard</h1>
          <p className="text-primary-foreground/80 mt-2">Manage store, inventory, and orders.</p>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="rounded-none border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats?.totalRevenue.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="rounded-none border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">Orders</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalOrders}</div>
            </CardContent>
          </Card>
          <Card className="rounded-none border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalCustomers}</div>
            </CardContent>
          </Card>
          <Card className="rounded-none border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalProducts}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-border h-auto p-0 bg-transparent mb-8">
            <TabsTrigger value="orders" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none py-3 px-6 uppercase tracking-wider text-sm font-medium">Orders</TabsTrigger>
            <TabsTrigger value="products" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none py-3 px-6 uppercase tracking-wider text-sm font-medium">Products</TabsTrigger>
            <TabsTrigger value="customers" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none py-3 px-6 uppercase tracking-wider text-sm font-medium">Customers</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="bg-background border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="uppercase tracking-wider font-bold">Order ID</TableHead>
                  <TableHead className="uppercase tracking-wider font-bold">Customer</TableHead>
                  <TableHead className="uppercase tracking-wider font-bold">Date</TableHead>
                  <TableHead className="uppercase tracking-wider font-bold">Total</TableHead>
                  <TableHead className="uppercase tracking-wider font-bold text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">#{order.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{order.customerName}</span>
                        <span className="text-xs text-muted-foreground">{order.customerEmail}</span>
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(order.createdAt), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>${order.total.toFixed(2)}</TableCell>
                    <TableCell className="text-right capitalize font-medium">
                      <span className={`px-2 py-1 text-xs rounded-full ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                        {order.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {(!orders || orders.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No orders yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="products">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-serif font-bold">Products ({products?.length ?? 0})</h2>
              <Button
                onClick={() => { setEditingProduct(null); setShowProductForm(true); }}
                className="rounded-none uppercase tracking-widest text-xs"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Product
              </Button>
            </div>
            <div className="bg-background border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="uppercase tracking-wider font-bold">ID</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Product</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Category</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Price</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Stock</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Featured</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products?.map((product: Product) => (
                    <TableRow key={product.id}>
                      <TableCell>#{product.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img src={product.imageUrl} alt={product.name} className="h-10 w-8 object-cover bg-muted shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          <span className="font-medium">{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{product.category}</TableCell>
                      <TableCell>${product.price.toFixed(2)}</TableCell>
                      <TableCell>{product.stock}</TableCell>
                      <TableCell>{product.isFeatured ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-none h-8"
                            onClick={() => handleEdit(product)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-none h-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm(product.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!products || products.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No products yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="customers" className="bg-background border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="uppercase tracking-wider font-bold">ID</TableHead>
                  <TableHead className="uppercase tracking-wider font-bold">Name</TableHead>
                  <TableHead className="uppercase tracking-wider font-bold">Email</TableHead>
                  <TableHead className="uppercase tracking-wider font-bold text-right">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers?.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>#{customer.id}</TableCell>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell className="text-right">{format(new Date(customer.createdAt), 'MMM dd, yyyy')}</TableCell>
                  </TableRow>
                ))}
                {(!customers || customers.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No customers yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </div>

      <ProductFormDialog
        open={showProductForm}
        onOpenChange={setShowProductForm}
        initialData={editingProduct ? {
          name: editingProduct.name,
          description: editingProduct.description,
          price: String(editingProduct.price),
          imageUrl: editingProduct.imageUrl,
          category: editingProduct.category,
          sizes: (editingProduct.sizes ?? []).join(","),
          stock: String(editingProduct.stock),
          isFeatured: editingProduct.isFeatured,
        } : undefined}
        productId={editingProduct?.id}
        onDone={() => setEditingProduct(null)}
      />

      <Dialog open={deleteConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">Are you sure you want to delete this product? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="rounded-none">Cancel</Button>
            <Button
              variant="destructive"
              className="rounded-none"
              disabled={deleteProduct.isPending}
              onClick={() => deleteConfirm !== null && handleDelete(deleteConfirm)}
            >
              {deleteProduct.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
