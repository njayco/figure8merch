import { useGetAdminStats, useListAdminOrders, useListProducts, useListCustomers, useUpdateOrderStatus, useUpdateProductImage, useHealthCheck, useListLowStockInventory, useRestockVariant, getListProductsQueryKey, getListAdminOrdersQueryKey, getGetAdminStatsQueryKey, getListFeaturedProductsQueryKey, getGetProductQueryKey, getHealthCheckQueryKey, getListLowStockInventoryQueryKey, ApiError } from "@workspace/api-client-react";
import type { Product, ProductVariant, AdminOrder, UpdateOrderStatusBodyStatus, HealthStatus, LowStockVariant } from "@workspace/api-client-react";
import { useRef, useState } from "react";
import { NewProductDialog, EditProductDialog } from "@/components/ProductFormDialog";
import { ProductImage } from "@/components/ProductImage";
import { StockQuickEditDialog } from "@/components/StockQuickEditDialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, ShoppingBag, DollarSign, Package, ExternalLink, Info, AlertTriangle, TrendingUp, Pencil, PackageOpen, PackageX, Plus, Upload } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const RESTOCK_AMOUNT = 10;
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const ORDER_STATUS_OPTIONS: Array<{ value: UpdateOrderStatusBodyStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_BADGE_STYLES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const CARRIER_OPTIONS = ["UPS", "USPS", "FedEx", "DHL", "Other"] as const;
type CarrierOption = (typeof CARRIER_OPTIONS)[number];

function isCarrierOption(value: string | null | undefined): value is CarrierOption {
  return !!value && (CARRIER_OPTIONS as readonly string[]).includes(value);
}

type TrackingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: AdminOrder;
  pendingStatus: UpdateOrderStatusBodyStatus | null;
  isPending: boolean;
  onConfirm: (data: {
    status: UpdateOrderStatusBodyStatus;
    carrier: string | null;
    trackingNumber: string | null;
  }) => void;
};

function TrackingDialog({
  open,
  onOpenChange,
  order,
  pendingStatus,
  isPending,
  onConfirm,
}: TrackingDialogProps) {
  const initialCarrier: CarrierOption = isCarrierOption(order.carrier) ? order.carrier : "UPS";
  const initialOther = order.carrier && !isCarrierOption(order.carrier) ? order.carrier : "";
  const initialCarrierChoice: CarrierOption =
    order.carrier && !isCarrierOption(order.carrier) ? "Other" : initialCarrier;

  const [carrierChoice, setCarrierChoice] = useState<CarrierOption>(initialCarrierChoice);
  const [otherCarrier, setOtherCarrier] = useState(initialOther);
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? "");

  const isEdit = pendingStatus === null;
  const targetStatus: UpdateOrderStatusBodyStatus =
    pendingStatus ?? (order.status as UpdateOrderStatusBodyStatus);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setCarrierChoice(initialCarrierChoice);
      setOtherCarrier(initialOther);
      setTrackingNumber(order.trackingNumber ?? "");
    }
    onOpenChange(next);
  };

  const resolvedCarrier =
    carrierChoice === "Other" ? otherCarrier.trim() : carrierChoice;
  const trimmedTracking = trackingNumber.trim();
  const canConfirm = !!resolvedCarrier && !!trimmedTracking;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-none sm:max-w-md" data-testid="dialog-tracking">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {isEdit ? "Edit tracking info" : "Mark order as shipped"}
          </DialogTitle>
          <DialogDescription>
            Order #{order.id} · {order.customerName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor={`carrier-${order.id}`} className="uppercase tracking-wider text-xs">
              Carrier
            </Label>
            <Select
              value={carrierChoice}
              onValueChange={(v) => setCarrierChoice(v as CarrierOption)}
            >
              <SelectTrigger
                id={`carrier-${order.id}`}
                className="rounded-none"
                data-testid="select-carrier"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARRIER_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {carrierChoice === "Other" && (
              <Input
                placeholder="Carrier name"
                value={otherCarrier}
                onChange={(e) => setOtherCarrier(e.target.value)}
                className="rounded-none"
                data-testid="input-carrier-other"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`tracking-${order.id}`} className="uppercase tracking-wider text-xs">
              Tracking number
            </Label>
            <Input
              id={`tracking-${order.id}`}
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="e.g. 1Z999AA10123456784"
              className="rounded-none font-mono"
              data-testid="input-tracking-number"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-none uppercase tracking-widest text-xs"
            disabled={!canConfirm || isPending}
            onClick={() =>
              onConfirm({
                status: targetStatus,
                carrier: resolvedCarrier || null,
                trackingNumber: trimmedTracking || null,
              })
            }
            data-testid="button-confirm-tracking"
          >
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Mark shipped"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrderStatusControl({ order }: { order: AdminOrder }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<UpdateOrderStatusBodyStatus | null>(null);

  const { mutate, isPending } = useUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        toast.success("Order updated");
        setDialogOpen(false);
        setPendingStatus(null);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to update order");
      },
    },
  });

  const canEditTracking = order.status === "shipped" || order.status === "delivered";

  return (
    <div className="flex items-center justify-end gap-2">
      <span
        className={`px-2 py-1 text-xs rounded-full capitalize ${
          STATUS_BADGE_STYLES[order.status] ?? "bg-muted text-muted-foreground"
        }`}
      >
        {order.status}
      </span>
      <Select
        value={order.status}
        disabled={isPending}
        onValueChange={(value) => {
          if (value === order.status) return;
          const next = value as UpdateOrderStatusBodyStatus;
          if (next === "shipped") {
            setPendingStatus("shipped");
            setDialogOpen(true);
            return;
          }
          mutate({ id: order.id, data: { status: next } });
        }}
      >
        <SelectTrigger className="h-8 w-[140px] rounded-none text-xs" data-testid={`select-status-${order.id}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ORDER_STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {canEditTracking && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-none"
          title="Edit tracking info"
          onClick={() => {
            setPendingStatus(null);
            setDialogOpen(true);
          }}
          data-testid={`button-edit-tracking-${order.id}`}
        >
          <Pencil className="h-3.5 w-3.5" />
          <span className="sr-only">Edit tracking info</span>
        </Button>
      )}
      <TrackingDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setPendingStatus(null);
        }}
        order={order}
        pendingStatus={pendingStatus}
        isPending={isPending}
        onConfirm={({ status, carrier, trackingNumber }) => {
          mutate({
            id: order.id,
            data: { status, carrier, trackingNumber },
          });
        }}
      />
    </div>
  );
}

function InventoryRow({ item }: { item: LowStockVariant }) {
  const queryClient = useQueryClient();
  const { mutate, isPending } = useRestockVariant({
    mutation: {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: getListLowStockInventoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        toast.success(
          `Restocked ${updated.productName} (${updated.size}/${updated.color}) — now ${updated.stock} in stock`,
        );
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to restock variant");
      },
    },
  });

  const isOut = item.status === "out";

  return (
    <TableRow data-testid={`row-inventory-${item.id}`}>
      <TableCell>
        <div className="flex items-center gap-3">
          {item.productImageUrl ? (
            <img
              src={item.productImageUrl}
              alt={item.productName}
              className="h-10 w-8 object-cover bg-muted shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="h-10 w-8 bg-muted shrink-0" aria-hidden />
          )}
          <span className="font-medium">{item.productName}</span>
        </div>
      </TableCell>
      <TableCell>{item.size}</TableCell>
      <TableCell>{item.color}</TableCell>
      <TableCell>
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            isOut ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {isOut ? "Sold out" : "Low stock"}
        </span>
      </TableCell>
      <TableCell className="text-right font-mono">{item.stock}</TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-none uppercase tracking-widest text-xs"
          disabled={isPending}
          onClick={() => mutate({ id: item.id, data: { amount: RESTOCK_AMOUNT } })}
          data-testid={`button-restock-${item.id}`}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {isPending ? "Adding…" : `+${RESTOCK_AMOUNT} stock`}
        </Button>
      </TableCell>
    </TableRow>
  );
}

function priceDiffersFromCurrent(
  charged: number,
  current: number | null | undefined,
): current is number {
  if (current == null) return false;
  // Round to cents before comparing so a $19.99 vs $19.989999 from float math
  // doesn't get flagged as a real price change.
  return Math.round(charged * 100) !== Math.round(current * 100);
}

function OrderItemThumbnails({ items }: { items: AdminOrder["items"] }) {
  if (!items || items.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="order-item-thumbnails">
      {items.map((item, idx) => {
        const variantParts = [item.size, item.color].filter(
          (v): v is string => !!v && v.trim() !== "",
        );
        const variantLabel = variantParts.join(" · ");
        const currentPrice = item.currentPrice;
        const priceChanged = priceDiffersFromCurrent(item.price, currentPrice);
        const priceWentUp = priceChanged && currentPrice > item.price;
        return (
          <Tooltip key={`${item.productId}-${item.size}-${item.color ?? ""}-${idx}`}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="relative h-10 w-10 overflow-hidden border border-border bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                data-testid={`order-item-thumbnail-${item.productId}-${idx}`}
                aria-label={`${item.productName}${variantLabel ? ` (${variantLabel})` : ""}`}
              >
                <ProductImage
                  src={item.imageUrl}
                  alt={item.productName}
                  productId={`${item.productId}-${idx}`}
                  compact
                />
                {item.quantity > 1 && (
                  <span className="absolute bottom-0 right-0 bg-primary text-primary-foreground text-[9px] leading-none px-1 py-0.5 font-mono">
                    ×{item.quantity}
                  </span>
                )}
                {priceChanged && (
                  <span
                    className={`absolute top-0 left-0 ${
                      priceWentUp
                        ? "bg-emerald-600 text-white"
                        : "bg-amber-500 text-white"
                    } text-[9px] leading-none px-1 py-0.5 font-mono`}
                    aria-hidden="true"
                    data-testid={`order-item-price-diff-badge-${item.productId}-${idx}`}
                    title="Product price has changed since this order"
                  >
                    {priceWentUp ? "↑" : "↓"}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px]">
              <div className="font-medium">{item.productName}</div>
              {variantLabel && (
                <div className="opacity-80 mt-0.5">{variantLabel}</div>
              )}
              <div className="opacity-80 mt-0.5">Qty {item.quantity}</div>
              {priceChanged ? (
                <div
                  className="mt-1 pt-1 border-t border-border/40"
                  data-testid={`order-item-price-diff-${item.productId}-${idx}`}
                >
                  <div className="opacity-80">
                    Charged ${item.price.toFixed(2)}
                  </div>
                  <div className="opacity-80">
                    Now ${currentPrice.toFixed(2)}{" "}
                    <span
                      className={priceWentUp ? "text-emerald-300" : "text-amber-300"}
                    >
                      ({priceWentUp ? "+" : "−"}$
                      {Math.abs(currentPrice - item.price).toFixed(2)})
                    </span>
                  </div>
                </div>
              ) : (
                <div className="opacity-80 mt-0.5">
                  ${item.price.toFixed(2)} each
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function ProductImageUploadCell({ product }: { product: Product }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const updateImage = useUpdateProductImage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListFeaturedProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(product.id) });
        queryClient.invalidateQueries({ queryKey: getListLowStockInventoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        toast.success("Photo updated");
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to update photo");
      },
    },
  });

  const isPending = uploading || updateImage.isPending;
  const hasPhoto = !!product.imageUrl;
  const actionLabel = hasPhoto ? "Replace photo" : "Upload photo";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be 10MB or smaller");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const resp = await fetch(`${BASE}/api/upload/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Upload failed");
      }
      updateImage.mutate({ id: product.id, data: { imageUrl: data.url } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        data-testid={`input-upload-image-${product.id}`}
      />
      <button
        type="button"
        disabled={isPending}
        onClick={() => fileInputRef.current?.click()}
        title={actionLabel}
        aria-label={`${actionLabel} for ${product.name}`}
        className="group relative h-12 w-12 overflow-hidden border border-border bg-muted shrink-0 block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-wait"
        data-testid={`button-upload-image-${product.id}`}
      >
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          productId={product.id}
          compact
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/60 text-white transition-opacity",
            isPending
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          )}
        >
          {isPending ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
        </span>
      </button>
    </>
  );
}

export function Admin() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: orders, isLoading: ordersLoading } = useListAdminOrders();
  const { data: products, isLoading: productsLoading } = useListProducts();
  const { data: customers, isLoading: customersLoading } = useListCustomers();
  const { data: inventory, isLoading: inventoryLoading } = useListLowStockInventory();
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

  if (statsLoading || ordersLoading || productsLoading || customersLoading || inventoryLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/10">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  const lowStockThreshold = stats?.lowStockThreshold ?? 3;
  const lowStockCount = stats?.lowStockCount ?? 0;
  const outOfStockCount = stats?.outOfStockCount ?? 0;

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
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
          <Card
            className={`rounded-none border-border shadow-sm ${
              lowStockCount > 0 ? "border-amber-300 bg-amber-50/50" : ""
            }`}
            data-testid="card-low-stock"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">Low Stock Variants</CardTitle>
              <PackageOpen
                className={`h-4 w-4 ${lowStockCount > 0 ? "text-amber-600" : "text-muted-foreground"}`}
              />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-low-stock-count">
                {lowStockCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {lowStockCount > 0 ? `Stock at or below ${lowStockThreshold}` : "All variants well stocked"}
              </p>
            </CardContent>
          </Card>
          <Card
            className={`rounded-none border-border shadow-sm ${
              outOfStockCount > 0 ? "border-red-300 bg-red-50/50" : ""
            }`}
            data-testid="card-out-of-stock"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">Sold-Out Variants</CardTitle>
              <PackageX
                className={`h-4 w-4 ${outOfStockCount > 0 ? "text-red-600" : "text-muted-foreground"}`}
              />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-out-of-stock-count">
                {outOfStockCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {outOfStockCount > 0 ? "Need restocking now" : "Nothing fully sold out"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-none border-border shadow-sm mb-12">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg font-serif">Top Selling Products</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="uppercase tracking-wider font-bold">Product</TableHead>
                  <TableHead className="uppercase tracking-wider font-bold text-right">Units Sold</TableHead>
                  <TableHead className="uppercase tracking-wider font-bold text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.topProducts?.map((p) => (
                  <TableRow key={p.productId}>
                    <TableCell className="font-medium">{p.productName}</TableCell>
                    <TableCell className="text-right">{p.totalSold}</TableCell>
                    <TableCell className="text-right">${p.revenue.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {(!stats?.topProducts || stats.topProducts.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      No sales yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-border h-auto p-0 bg-transparent mb-8">
            <TabsTrigger value="orders" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none py-3 px-6 uppercase tracking-wider text-sm font-medium">Orders</TabsTrigger>
            <TabsTrigger value="products" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none py-3 px-6 uppercase tracking-wider text-sm font-medium">Products</TabsTrigger>
            <TabsTrigger
              value="inventory"
              className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none py-3 px-6 uppercase tracking-wider text-sm font-medium"
              data-testid="tab-inventory"
            >
              Inventory
              {(lowStockCount > 0 || outOfStockCount > 0) && (
                <span
                  className={`ml-2 px-1.5 py-0.5 text-[10px] rounded-full ${
                    outOfStockCount > 0
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                  data-testid="badge-inventory-count"
                >
                  {lowStockCount + outOfStockCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="customers" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none py-3 px-6 uppercase tracking-wider text-sm font-medium">Customers</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="bg-background border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="uppercase tracking-wider font-bold">Order ID</TableHead>
                  <TableHead className="uppercase tracking-wider font-bold">Customer</TableHead>
                  <TableHead className="uppercase tracking-wider font-bold">Items</TableHead>
                  <TableHead className="uppercase tracking-wider font-bold">Date</TableHead>
                  <TableHead className="uppercase tracking-wider font-bold">Total</TableHead>
                  <TableHead className="uppercase tracking-wider font-bold">Tracking</TableHead>
                  <TableHead className="uppercase tracking-wider font-bold text-right">Shipping Status</TableHead>
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
                    <TableCell>
                      <OrderItemThumbnails items={order.items} />
                    </TableCell>
                    <TableCell>{format(new Date(order.createdAt), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>${order.total.toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {order.trackingNumber || order.carrier ? (
                        <div className="flex flex-col">
                          {order.carrier && <span>{order.carrier}</span>}
                          {order.trackingNumber && <span className="font-mono">{order.trackingNumber}</span>}
                        </div>
                      ) : (
                        <span>—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <OrderStatusControl order={order} />
                    </TableCell>
                  </TableRow>
                ))}
                {(!orders || orders.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No orders yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="products">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-serif font-bold">Products ({products?.length ?? 0})</h2>
              <div className="flex items-center gap-2">
                <NewProductDialog />
                <Button
                  asChild
                  variant="outline"
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
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Create, edit, and adjust per-(size, color) stock here. Use the pencil icon to edit a product&rsquo;s details, or the inventory icon for a quick stock change. Changes sync to Stripe automatically.
            </p>
            <div className="bg-background border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="uppercase tracking-wider font-bold w-[72px]">Photo</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Product</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Category</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Price</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Sizes</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Colors</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Inventory</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Featured</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Stripe</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products?.map((product: Product) => (
                    <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                      <TableCell>
                        <div data-testid={`thumb-product-${product.id}`}>
                          <ProductImageUploadCell product={product} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{product.name}</span>
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
                      <TableCell>
                        {product.colors && product.colors.length > 0 ? (
                          <span className="text-sm">{product.colors.join(", ")}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.variants && product.variants.length > 0 ? (
                          <div className="flex flex-col gap-0.5 text-xs">
                            <span className="font-medium">
                              {product.variants.length} variants ·{" "}
                              {product.variants.reduce(
                                (sum: number, v: ProductVariant) => sum + v.stock,
                                0
                              )}{" "}
                              in stock
                            </span>
                            <span className="text-muted-foreground">
                              {product.variants.filter((v: ProductVariant) => v.stock === 0).length}{" "}
                              out of stock
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            Unlimited (legacy)
                          </span>
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
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <EditProductDialog product={product} />
                          {product.variants && product.variants.length > 0 && (
                            <StockQuickEditDialog product={product} />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!products || products.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No products found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="inventory">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-serif font-bold">
                Inventory ({inventory?.length ?? 0})
              </h2>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Showing variants with stock at or below {lowStockThreshold}
              </p>
            </div>
            <Alert className="rounded-none mb-4 bg-muted/30">
              <Info className="h-4 w-4" />
              <AlertTitle>How this list works</AlertTitle>
              <AlertDescription>
                Sold-out variants appear first, followed by low-stock variants
                (1–{lowStockThreshold} units left). Use the +{RESTOCK_AMOUNT} stock
                button to add inventory; the row will drop off the list once it goes back above
                the threshold.
              </AlertDescription>
            </Alert>
            <div className="bg-background border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="uppercase tracking-wider font-bold">Product</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Size</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Color</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold">Status</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold text-right">Stock</TableHead>
                    <TableHead className="uppercase tracking-wider font-bold text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory?.map((item) => (
                    <InventoryRow key={item.id} item={item} />
                  ))}
                  {(!inventory || inventory.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                        data-testid="text-inventory-empty"
                      >
                        Everything is well stocked. No variants at or below {lowStockThreshold} units.
                      </TableCell>
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
