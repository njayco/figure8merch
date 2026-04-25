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
  /**
   * When true, hide the text label inside the placeholder so it can fit in a
   * small container such as an admin table thumbnail.
   */
  compact?: boolean;
}

function getInitial(alt: string): string {
  const trimmed = alt.trim();
  if (!trimmed) return "?";
  const codePoint = trimmed.codePointAt(0);
  if (codePoint === undefined) return "?";
  return String.fromCodePoint(codePoint).toUpperCase();
}

export function ProductImage({
  src,
  alt,
  productId,
  className,
  imgClassName,
  placeholderIconClassName,
  placeholderLabelClassName,
  compact = false,
}: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasFailed = !!src && failedSrc === src;
  const isMissing = !src;

  if (isMissing) {
    const initial = getInitial(alt);
    return (
      <div
        data-testid={
          productId
            ? `product-image-missing-${productId}`
            : "product-image-missing"
        }
        title={compact ? "No photo uploaded" : undefined}
        className={cn(
          "w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted to-muted/60 text-muted-foreground select-none",
          compact ? "gap-0.5" : "gap-2",
          className,
        )}
        role="img"
        aria-label={`${alt} — no photo uploaded`}
      >
        <span
          aria-hidden="true"
          className={cn(
            "font-serif font-semibold text-foreground/70",
            compact ? "text-base leading-none" : "text-5xl leading-none",
            placeholderIconClassName,
          )}
        >
          {initial}
        </span>
        <span
          className={cn(
            "uppercase tracking-widest text-muted-foreground/80",
            compact ? "text-[8px]" : "text-[10px]",
            placeholderLabelClassName,
          )}
        >
          No photo
        </span>
      </div>
    );
  }

  if (hasFailed) {
    return (
      <div
        data-testid={
          productId
            ? `product-image-placeholder-${productId}`
            : "product-image-placeholder"
        }
        className={cn(
          "w-full h-full flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground",
          className,
        )}
        role="img"
        aria-label={`${alt} image unavailable`}
      >
        {compact ? (
          <ImageOff
            className={cn("h-5 w-5", placeholderIconClassName)}
            strokeWidth={1.5}
          />
        ) : (
          <>
            <ImageOff
              className={cn("h-10 w-10", placeholderIconClassName)}
              strokeWidth={1.25}
            />
            <span
              className={cn(
                "text-xs uppercase tracking-widest",
                placeholderLabelClassName,
              )}
            >
              Image unavailable
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <img
      src={src ?? undefined}
      alt={alt}
      onError={() => src && setFailedSrc(src)}
      className={cn("w-full h-full object-cover object-center", imgClassName)}
    />
  );
}

