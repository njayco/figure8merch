import { useState } from "react";
import { Link } from "wouter";
import { Heart } from "lucide-react";
import type { Product } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useAddToWishlist, useRemoveFromWishlist, useGetWishlist, getGetWishlistQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/components/ProductImage";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isHovered, setIsHovered] = useState(false);

  const { data: wishlist } = useGetWishlist({
    query: {
      enabled: !!user,
      queryKey: getGetWishlistQueryKey(),
    }
  });

  const addToWishlist = useAddToWishlist();
  const removeFromWishlist = useRemoveFromWishlist();

  const isFavorited = wishlist?.some((p) => p.id === product.id) ?? false;

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast({
        title: "Please login",
        description: "You need to be logged in to save items to your wishlist.",
      });
      return;
    }

    if (isFavorited) {
      removeFromWishlist.mutate(
        { productId: product.id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetWishlistQueryKey() });
          }
        }
      );
    } else {
      addToWishlist.mutate(
        { productId: product.id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetWishlistQueryKey() });
            toast({
              title: "Added to wishlist",
              description: `${product.name} saved for later.`,
            });
          }
        }
      );
    }
  };

  return (
    <Link href={`/shop/${product.id}`} className="group block">
      <div 
        className="relative overflow-hidden aspect-[3/4] bg-muted mb-4"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          productId={product.id}
          imgClassName="transition-transform duration-700 group-hover:scale-105"
        />
        
        {/* Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {product.isFeatured && (
            <span className="bg-background text-foreground text-xs uppercase tracking-wider px-2 py-1 shadow-sm">
              Featured
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <button 
          onClick={toggleWishlist}
          className="absolute top-4 right-4 h-10 w-10 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center text-foreground hover:bg-background hover:text-primary transition-all shadow-sm z-10"
        >
          <Heart className={cn("h-5 w-5 transition-colors", isFavorited ? "fill-primary text-primary" : "")} />
        </button>

        {/* Quick Add Overlay */}
        <div className={cn(
          "absolute bottom-0 left-0 w-full p-4 transform transition-transform duration-300",
          isHovered ? "translate-y-0" : "translate-y-full"
        )}>
          <div className="bg-background/90 backdrop-blur-md text-foreground py-3 text-center uppercase tracking-widest text-sm font-medium shadow-lg hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
            Quick View
          </div>
        </div>
      </div>
      
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium text-foreground">{product.name}</h3>
          <p className="text-sm text-muted-foreground capitalize">{product.category}</p>
        </div>
        <p className="text-lg font-medium text-foreground">${product.price.toFixed(2)}</p>
      </div>
    </Link>
  );
}
