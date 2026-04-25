import { useListOrders, getListOrdersQueryKey } from "@workspace/api-client-react";
import type { Order, OrderItem } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Check, Package, Truck, Home } from "lucide-react";

function PaymentStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;

  const styles: Record<string, string> = {
    succeeded: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    failed: "bg-red-100 text-red-800",
    requires_action: "bg-orange-100 text-orange-800",
  };

  const labels: Record<string, string> = {
    succeeded: "Payment Successful",
    pending: "Payment Pending",
    failed: "Payment Failed",
    requires_action: "Action Required",
  };

  const cls = styles[status] ?? "bg-muted text-muted-foreground";
  const label = labels[status] ?? status;

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>
      {label}
    </span>
  );
}

const SHIPPING_STATUS_STYLES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const SHIPPING_STATUS_LABELS: Record<string, string> = {
  pending: "Order Received",
  processing: "Preparing to Ship",
  shipped: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function ShippingStatusBadge({ status }: { status: string }) {
  const cls = SHIPPING_STATUS_STYLES[status] ?? "bg-muted text-muted-foreground";
  const label = SHIPPING_STATUS_LABELS[status] ?? status;
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>
      {label}
    </span>
  );
}

const TRACKING_STEPS: Array<{ key: string; label: string; Icon: typeof Check }> = [
  { key: "pending", label: "Order Placed", Icon: Check },
  { key: "processing", label: "Processing", Icon: Package },
  { key: "shipped", label: "Shipped", Icon: Truck },
  { key: "delivered", label: "Delivered", Icon: Home },
];

const STEP_INDEX: Record<string, number> = {
  pending: 0,
  processing: 1,
  shipped: 2,
  delivered: 3,
};

function OrderProgress({ status }: { status: string }) {
  if (status === "cancelled") {
    return (
      <div className="bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
        This order was cancelled.
      </div>
    );
  }

  const currentIndex = STEP_INDEX[status] ?? 0;

  return (
    <div className="w-full">
      <div className="flex items-start justify-between gap-2 relative">
        {TRACKING_STEPS.map((step, idx) => {
          const completed = idx <= currentIndex;
          const isCurrent = idx === currentIndex;
          const Icon = step.Icon;
          return (
            <div key={step.key} className="flex-1 flex flex-col items-center relative">
              {idx > 0 && (
                <div
                  className={`absolute top-4 right-1/2 w-full h-0.5 -z-0 ${
                    idx <= currentIndex ? "bg-primary" : "bg-border"
                  }`}
                  aria-hidden="true"
                />
              )}
              <div
                className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  completed
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-background border-border text-muted-foreground"
                } ${isCurrent ? "ring-2 ring-primary/30" : ""}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p
                className={`mt-2 text-[11px] uppercase tracking-wider text-center ${
                  completed ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShippingDetails({ order }: { order: Order }) {
  if (order.status === "cancelled") return null;

  const lines: Array<{ label: string; value: string }> = [];

  if (order.shippedAt) {
    lines.push({
      label: "Shipped",
      value: format(new Date(order.shippedAt), "MMM dd, yyyy"),
    });
  }
  if (order.deliveredAt) {
    lines.push({
      label: "Delivered",
      value: format(new Date(order.deliveredAt), "MMM dd, yyyy"),
    });
  } else if (order.estimatedDeliveryAt && order.status !== "delivered") {
    lines.push({
      label: "Estimated Delivery",
      value: format(new Date(order.estimatedDeliveryAt), "MMM dd, yyyy"),
    });
  }
  if (order.carrier || order.trackingNumber) {
    const value = [order.carrier, order.trackingNumber].filter(Boolean).join(" • ");
    lines.push({ label: "Tracking", value });
  }

  if (lines.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border text-sm">
      {lines.map((line) => (
        <div key={line.label}>
          <p className="text-muted-foreground uppercase tracking-wider text-xs mb-1">
            {line.label}
          </p>
          <p className="font-medium">{line.value}</p>
        </div>
      ))}
    </div>
  );
}

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
                    <p className="text-muted-foreground uppercase tracking-wider text-xs mb-1">Shipping</p>
                    <ShippingStatusBadge status={order.status} />
                  </div>
                  <div>
                    <p className="text-muted-foreground uppercase tracking-wider text-xs mb-1">Order #</p>
                    <p className="font-medium">{order.id}</p>
                  </div>
                </div>
              </div>

              <div className="px-6 pt-4 pb-2 flex flex-wrap items-center gap-3">
                <PaymentStatusBadge status={order.stripePaymentStatus} />
                {order.cardLast4 && (
                  <span className="text-sm text-muted-foreground">
                    Paid with card ending in <span className="font-medium text-foreground">{order.cardLast4}</span>
                  </span>
                )}
              </div>

              <div className="px-6 py-6 border-t border-border mt-2">
                <OrderProgress status={order.status} />
                <ShippingDetails order={order} />
              </div>

              <div className="p-6 space-y-6 border-t border-border">
                {order.items.map((item: OrderItem, idx: number) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
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
