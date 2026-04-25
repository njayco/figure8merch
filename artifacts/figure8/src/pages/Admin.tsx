import { useGetAdminStats, useListAdminOrders, useListProducts, useListCustomers, useHealthCheck, getHealthCheckQueryKey, ApiError } from "@workspace/api-client-react";
import type { Product, HealthStatus } from "@workspace/api-client-react";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Users, ShoppingBag, DollarSign, Package, ExternalLink, Info, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export function Admin() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: orders, isLoading: ordersLoading } = useListAdminOrders();
  const { data: products, isLoading: productsLoading } = useListProducts();
  const { data: customers, isLoading: customersLoading } = useListCustomers();
  const { data: health, error: healthError } = useHealthCheck({
    query: {
      retry: false,
      refetchOnWindowFocus: false,
      queryKey: getHealthCheckQueryKey(),
    },
  });

  const healthBody: HealthStatus | undefined =
    health ??
    (healthError instanceof ApiError &&
    healthError.data &&
    typeof healthError.data === "object"
      ? (healthError.data as HealthStatus)
      : undefined);

  const stripeFailed = healthBody?.stripe?.status === "failed";
  const stripeError = healthBody?.stripe?.error;

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
        {stripeFailed && (
          <Alert variant="destructive" className="mb-8 rounded-none" data-testid="alert-stripe-failed">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Payment features unavailable</AlertTitle>
            <AlertDescription>
              Stripe failed to initialize, so checkout, product sync, and revenue reporting will not work until it is restored.
              {stripeError && (
                <span className="block mt-2 font-mono text-xs opacity-90" data-testid="text-stripe-error">
                  {stripeError}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="rounded-none border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">Stripe Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats?.stripeRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">From succeeded payments</p>
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
            <Alert className="rounded-none mb-4 bg-muted/30">
              <Info className="h-4 w-4" />
              <AlertTitle>Configuring product sizes</AlertTitle>
              <AlertDescription>
                <p className="mb-2">
                  To show a size selector on a product page, add a metadata field to the product in Stripe:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Open the product in the Stripe Dashboard, scroll to <span className="font-medium">Metadata</span>, and add a key named{" "}
                    <code className="px-1 py-0.5 bg-muted text-foreground rounded text-xs font-mono">sizes</code>.
                  </li>
                  <li>
                    Set the value to a comma-separated list, for example{" "}
                    <code className="px-1 py-0.5 bg-muted text-foreground rounded text-xs font-mono">XS,S,M,L,XL</code>.
                  </li>
                  <li>
                    Save the product. The size selector will appear on the product page automatically.
                  </li>
                </ul>
                <p className="mt-2">
                  Other supported metadata fields:{" "}
                  <code className="px-1 py-0.5 bg-muted text-foreground rounded text-xs font-mono">category</code> and{" "}
                  <code className="px-1 py-0.5 bg-muted text-foreground rounded text-xs font-mono">featured</code> (set to{" "}
                  <code className="px-1 py-0.5 bg-muted text-foreground rounded text-xs font-mono">true</code>).
                </p>
              </AlertDescription>
            </Alert>
            <div className="bg-background border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="uppercase tracking-wider font-bold">Product</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Category</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Price</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Sizes</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Featured</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Stripe</TableHead>
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
                      <TableCell>
                        {product.sizes && product.sizes.length > 0 ? (
                          <span className="text-sm">{product.sizes.join(", ")}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>{product.isFeatured ? "Yes" : "No"}</TableCell>
                      <TableCell>
                        <a
                          href={`https://dashboard.stripe.com/products/${product.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary font-mono"
                          title="Open product in Stripe Dashboard"
                        >
                          {product.id}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!products || products.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No products found.</TableCell>
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
