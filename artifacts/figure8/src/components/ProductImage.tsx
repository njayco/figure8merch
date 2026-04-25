import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  productId?: string | number;
  className?: string;
  imgClassName?: string;
  placeholderIconClassName?: string;
  placeholderLabelClassName?: string;
}

export function ProductImage({
  src,
  alt,
  productId,
  className,
  imgClassName,
  placeholderIconClassName,
  placeholderLabelClassName,
}: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPlaceholder = !src || failedSrc === src;

  if (showPlaceholder) {
    return (
      <div
        data-testid={productId ? `product-image-placeholder-${productId}` : "product-image-placeholder"}
        className={cn(
          "w-full h-full flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground",
          className,
        )}
        role="img"
        aria-label={`${alt} image unavailable`}
      >
        <ImageOff className={cn("h-10 w-10", placeholderIconClassName)} strokeWidth={1.25} />
        <span className={cn("text-xs uppercase tracking-widest", placeholderLabelClassName)}>
          Image unavailable
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailedSrc(src)}
      className={cn("w-full h-full object-cover object-center", imgClassName)}
    />
  );
}
