import { useListOrders, getListOrdersQueryKey } from "@workspace/api-client-react";
import type { Order, OrderItem } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export function Orders() {
  const { user } = useAuth();
  const { data: orders, isLoading } = useListOrders({
    query: {
      enabled: !!user,
      queryKey: getListOrdersQueryKey(),
    }
  });

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-3xl font-serif font-bold mb-4">Order History</h2>
        <p className="text-muted-foreground mb-8">Please log in to view your orders.</p>
        <Link href="/login">
          <Button className="rounded-none uppercase tracking-widest font-bold">Sign In</Button>
        </Link>
      </div>
    );
  }

  return (
    <main className="w-full min-h-[80vh] flex flex-col px-4 py-12 container mx-auto max-w-5xl">
      <h1 className="text-4xl font-serif font-bold text-foreground mb-8">Order History</h1>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : orders && orders.length > 0 ? (
        <div className="space-y-8">
          {orders.map((order: Order) => (
            <div key={order.id} className="border border-border bg-background shadow-sm">
              <div className="border-b border-border bg-muted/30 px-6 py-4 flex flex-col sm:flex-row justify-between gap-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                  <div>
                    <p className="text-muted-foreground uppercase tracking-wider text-xs mb-1">Order Placed</p>
                    <p className="font-medium">{format(new Date(order.createdAt), 'MMM dd, yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground uppercase tracking-wider text-xs mb-1">Total</p>
                    <p className="font-medium">${order.total.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground uppercase tracking-wider text-xs mb-1">Status</p>
                    <p className="font-medium capitalize">{order.status}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground uppercase tracking-wider text-xs mb-1">Order #</p>
                    <p className="font-medium">{order.id}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {order.items.map((item: OrderItem, idx: number) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {/* Using a placeholder square since OrderItem might not have imageUrl in some schemas, but we can display the product name clearly */}
                      <div className="w-16 h-20 bg-muted shrink-0 flex flex-col items-center justify-center border border-border">
                         <span className="text-[10px] uppercase text-muted-foreground text-center">F8</span>
                      </div>
                      <div>
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-sm text-muted-foreground uppercase tracking-wider mt-1">Size: {item.size} | Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <div className="font-medium">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-20 bg-muted/20 border border-border">
          <h3 className="text-2xl font-serif font-bold mb-4">No Orders Yet</h3>
          <p className="text-muted-foreground mb-8 max-w-md">
            When you place orders, they will appear here for you to track and review.
          </p>
          <Link href="/shop">
            <Button className="rounded-none uppercase tracking-widest font-bold">Start Shopping</Button>
          </Link>
        </div>
      )}
    </main>
  );
}
