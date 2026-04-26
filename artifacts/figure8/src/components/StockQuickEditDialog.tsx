import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUpdateProductVariantStock,
  getListProductsQueryKey,
  getGetAdminStatsQueryKey,
} from "@workspace/api-client-react";
import type { Product, ProductVariant } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Boxes, Check } from "lucide-react";
import { toast } from "sonner";

function variantKey(size: string, color: string): string {
  return `${size}::${color}`;
}

export function StockQuickEditDialog({ product }: { product: Product }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const variants = useMemo<ProductVariant[]>(
    () => [...(product.variants ?? [])].sort((a, b) => {
      if (a.size === b.size) return a.color.localeCompare(b.color);
      return a.size.localeCompare(b.size);
    }),
    [product.variants],
  );

  const initialDrafts = useMemo(() => {
    const next: Record<string, string> = {};
    for (const v of variants) {
      next[variantKey(v.size, v.color)] = v.stock.toString();
    }
    return next;
  }, [variants]);

  useEffect(() => {
    if (open) setDrafts(initialDrafts);
  }, [open, initialDrafts]);

  const { mutateAsync } = useUpdateProductVariantStock();

  const handleClose = (next: boolean) => {
    if (savingKey !== null) return;
    setOpen(next);
  };

  const saveOne = async (size: string, color: string) => {
    const key = variantKey(size, color);
    const raw = drafts[key] ?? "";
    const num = Number(raw);
    if (raw === "" || !Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
      toast.error(`Stock for ${size}/${color} must be a non-negative whole number`);
      return;
    }
    setSavingKey(key);
    try {
      await mutateAsync({
        id: product.id,
        data: { size, color, stock: num },
      });
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
      toast.success(`Updated ${size}/${color} stock`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update stock");
    } finally {
      setSavingKey(null);
    }
  };

  if (variants.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-none"
          title="Quick stock edit"
          data-testid={`button-quick-stock-${product.id}`}
        >
          <Boxes className="h-3.5 w-3.5" />
          <span className="sr-only">Edit stock</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="rounded-none sm:max-w-md max-h-[80vh] overflow-y-auto"
        data-testid="dialog-quick-stock"
      >
        <DialogHeader>
          <DialogTitle className="font-serif">Adjust stock</DialogTitle>
          <DialogDescription>
            {product.name} — change a single variant&rsquo;s stock and save.
          </DialogDescription>
        </DialogHeader>
        <div className="border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium uppercase tracking-wider text-xs">
                  Size
                </th>
                <th className="text-left px-3 py-2 font-medium uppercase tracking-wider text-xs">
                  Color
                </th>
                <th className="text-left px-3 py-2 font-medium uppercase tracking-wider text-xs">
                  Stock
                </th>
                <th className="px-3 py-2 font-medium uppercase tracking-wider text-xs"></th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => {
                const key = variantKey(v.size, v.color);
                const draft = drafts[key] ?? "";
                const original = v.stock.toString();
                const dirty = draft !== original;
                const isSaving = savingKey === key;
                return (
                  <tr key={key} className="border-t border-border">
                    <td className="px-3 py-2 font-medium uppercase tracking-wider text-xs">
                      {v.size}
                    </td>
                    <td className="px-3 py-2 text-xs">{v.color}</td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={draft}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="rounded-none h-9 w-20"
                        data-testid={`input-quick-stock-${v.size}-${v.color}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-none h-8 uppercase tracking-widest text-xs"
                        disabled={!dirty || isSaving || savingKey !== null}
                        onClick={() => saveOne(v.size, v.color)}
                        data-testid={`button-save-stock-${v.size}-${v.color}`}
                      >
                        {isSaving ? (
                          <Spinner className="h-3 w-3" />
                        ) : (
                          <>
                            <Check className="h-3 w-3 mr-1" /> Save
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-none uppercase tracking-widest text-xs"
            onClick={() => handleClose(false)}
            disabled={savingKey !== null}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
