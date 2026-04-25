import { useState, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateProduct,
  getListProductsQueryKey,
  getGetAdminStatsQueryKey,
} from "@workspace/api-client-react";
import type { CreateProductBody } from "@workspace/api-client-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Plus, X, Upload } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface VariantState {
  size: string;
  color: string;
  stock: string;
}

export function NewProductDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);

  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sizes, setSizes] = useState<string[]>([]);
  const [sizeInput, setSizeInput] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [colorInput, setColorInput] = useState("");

  const [stockMap, setStockMap] = useState<Record<string, string>>({});

  const createProduct = useCreateProduct();

  const reset = () => {
    setName("");
    setDescription("");
    setPrice("");
    setCategory("");
    setIsFeatured(false);
    setImageUrl("");
    setSizes([]);
    setSizeInput("");
    setColors([]);
    setColorInput("");
    setStockMap({});
  };

  const handleClose = (next: boolean) => {
    if (createProduct.isPending) return;
    setOpen(next);
    if (!next) reset();
  };

  const addSize = () => {
    const v = sizeInput.trim().toUpperCase();
    if (!v || sizes.includes(v)) {
      setSizeInput("");
      return;
    }
    setSizes((prev) => [...prev, v]);
    setSizeInput("");
  };

  const removeSize = (s: string) => {
    setSizes((prev) => prev.filter((x) => x !== s));
    setStockMap((prev) => {
      const next: Record<string, string> = {};
      for (const k of Object.keys(prev)) {
        if (!k.startsWith(`${s}::`)) next[k] = prev[k];
      }
      return next;
    });
  };

  const addColor = () => {
    const v = colorInput.trim();
    if (!v || colors.includes(v)) {
      setColorInput("");
      return;
    }
    setColors((prev) => [...prev, v]);
    setColorInput("");
  };

  const removeColor = (c: string) => {
    setColors((prev) => prev.filter((x) => x !== c));
    setStockMap((prev) => {
      const next: Record<string, string> = {};
      for (const k of Object.keys(prev)) {
        if (!k.endsWith(`::${c}`)) next[k] = prev[k];
      }
      return next;
    });
  };

  const setStockCell = (size: string, color: string, value: string) => {
    setStockMap((prev) => ({ ...prev, [`${size}::${color}`]: value }));
  };

  const variants = useMemo(() => {
    const out: VariantState[] = [];
    for (const s of sizes) {
      for (const c of colors) {
        out.push({
          size: s,
          color: c,
          stock: stockMap[`${s}::${c}`] ?? "",
        });
      }
    }
    return out;
  }, [sizes, colors, stockMap]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be 10MB or smaller");
      return;
    }
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const resp = await fetch(`${BASE}/api/upload/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Upload failed");
      }
      setImageUrl(data.url);
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const trimmedCategory = category.trim();
    const numericPrice = Number(price);

    if (!trimmedName || !trimmedDescription || !trimmedCategory) {
      toast.error("Name, description, and category are required");
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      toast.error("Price must be a positive number");
      return;
    }
    if (sizes.length === 0) {
      toast.error("Add at least one size");
      return;
    }
    if (colors.length === 0) {
      toast.error("Add at least one color");
      return;
    }

    const variantBody: Array<{ size: string; color: string; stock: number }> = [];
    for (const v of variants) {
      const stockNum = Number(v.stock);
      if (v.stock === "" || !Number.isFinite(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) {
        toast.error(`Stock for ${v.size}/${v.color} must be a non-negative whole number`);
        return;
      }
      variantBody.push({ size: v.size, color: v.color, stock: stockNum });
    }

    const body: CreateProductBody = {
      name: trimmedName,
      description: trimmedDescription,
      price: numericPrice,
      imageUrl,
      category: trimmedCategory,
      sizes,
      colors,
      variants: variantBody,
      isFeatured,
    };

    createProduct.mutate(
      { data: body },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
          toast.success("Product created");
          handleClose(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to create product");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button
          className="rounded-none uppercase tracking-widest text-xs"
          data-testid="button-new-product"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Product
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-none">
        <DialogHeader>
          <DialogTitle className="font-serif">Create new product</DialogTitle>
          <DialogDescription>
            Adds a product to Stripe and creates a per-(size, color) inventory grid.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="np-name" className="text-xs uppercase tracking-wider">Name</Label>
              <Input
                id="np-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-none"
                data-testid="input-product-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np-category" className="text-xs uppercase tracking-wider">Category</Label>
              <Input
                id="np-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. tops"
                className="rounded-none"
                data-testid="input-product-category"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="np-description" className="text-xs uppercase tracking-wider">Description</Label>
            <Textarea
              id="np-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-none min-h-[100px]"
              data-testid="input-product-description"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="np-price" className="text-xs uppercase tracking-wider">Price (USD)</Label>
              <Input
                id="np-price"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="rounded-none"
                data-testid="input-product-price"
              />
            </div>
            <div className="flex items-end gap-2">
              <input
                id="np-featured"
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="h-4 w-4"
                data-testid="checkbox-product-featured"
              />
              <Label htmlFor="np-featured" className="text-xs uppercase tracking-wider">
                Featured on home page
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider">Photo</Label>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                data-testid="input-product-image"
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-none uppercase tracking-widest text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageUploading}
                data-testid="button-upload-image"
              >
                {imageUploading ? (
                  <Spinner className="h-4 w-4 mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {imageUrl ? "Replace photo" : "Upload photo"}
              </Button>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="h-16 w-16 object-cover bg-muted border border-border"
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider">Sizes</Label>
            <div className="flex gap-2">
              <Input
                value={sizeInput}
                onChange={(e) => setSizeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSize();
                  }
                }}
                placeholder="e.g. S, M, L"
                className="rounded-none"
                data-testid="input-size"
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                onClick={addSize}
                data-testid="button-add-size"
              >
                Add
              </Button>
            </div>
            {sizes.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2" data-testid="list-sizes">
                {sizes.map((s) => (
                  <Badge
                    key={s}
                    variant="secondary"
                    className="rounded-none uppercase tracking-wider gap-2"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => removeSize(s)}
                      className="hover:text-destructive"
                      aria-label={`Remove size ${s}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider">Colors</Label>
            <div className="flex gap-2">
              <Input
                value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addColor();
                  }
                }}
                placeholder="e.g. Black, Olive"
                className="rounded-none"
                data-testid="input-color"
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                onClick={addColor}
                data-testid="button-add-color"
              >
                Add
              </Button>
            </div>
            {colors.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2" data-testid="list-colors">
                {colors.map((c) => (
                  <Badge
                    key={c}
                    variant="secondary"
                    className="rounded-none gap-2"
                  >
                    {c}
                    <button
                      type="button"
                      onClick={() => removeColor(c)}
                      className="hover:text-destructive"
                      aria-label={`Remove color ${c}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {sizes.length > 0 && colors.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider">Stock per variant</Label>
              <div className="border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium uppercase tracking-wider text-xs">Size \ Color</th>
                      {colors.map((c) => (
                        <th
                          key={c}
                          className="px-3 py-2 font-medium uppercase tracking-wider text-xs text-left"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sizes.map((s) => (
                      <tr key={s} className="border-t border-border">
                        <td className="px-3 py-2 font-medium uppercase tracking-wider text-xs bg-muted/20">
                          {s}
                        </td>
                        {colors.map((c) => (
                          <td key={c} className="px-2 py-2">
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={stockMap[`${s}::${c}`] ?? ""}
                              onChange={(e) => setStockCell(s, c, e.target.value)}
                              placeholder="0"
                              className="rounded-none h-9 w-20"
                              data-testid={`input-stock-${s}-${c}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-none uppercase tracking-widest text-xs"
              onClick={() => handleClose(false)}
              disabled={createProduct.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-none uppercase tracking-widest text-xs"
              disabled={createProduct.isPending || imageUploading}
              data-testid="button-submit-product"
            >
              {createProduct.isPending && <Spinner className="h-4 w-4 mr-2" />}
              Create product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
