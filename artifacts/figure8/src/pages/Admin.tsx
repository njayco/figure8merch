import { useGetAdminStats, useListAdminOrders, useListProducts, useListCustomers } from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ShoppingBag, DollarSign, Package, ExternalLink } from "lucide-react";
import { format } from "date-fns";

export function Admin() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: orders, isLoading: ordersLoading } = useListAdminOrders();
  const { data: products, isLoading: productsLoading } = useListProducts();
  const { data: customers, isLoading: customersLoading } = useListCustomers();

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
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-serif font-bold">Products ({products?.length ?? 0})</h2>
              <Button
                asChild
                className="rounded-none uppercase tracking-widest text-xs"
              >
                <a
                  href="https://dashboard.stripe.com/products"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Manage in Stripe
                </a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Products are managed directly in the Stripe Dashboard. Changes sync automatically to the shop.
            </p>
            <div className="bg-background border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="uppercase tracking-wider font-bold">Product</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Category</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Price</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Featured</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Stripe ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products?.map((product: Product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-10 w-8 object-cover bg-muted shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <span className="font-medium">{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{product.category}</TableCell>
                      <TableCell>${product.price.toFixed(2)}</TableCell>
                      <TableCell>{product.isFeatured ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{product.id}</TableCell>
                    </TableRow>
                  ))}
                  {(!products || products.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No products found.</TableCell>
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
    </div>
  );
}
