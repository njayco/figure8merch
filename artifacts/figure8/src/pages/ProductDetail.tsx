import { useState } from "react";
import { useRoute } from "wouter";
import { ShoppingBag, Heart, ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useGetProduct, getGetProductQueryKey, useAddToCart, getGetCartQueryKey, useAddToWishlist, useGetWishlist, getGetWishlistQueryKey, useRemoveFromWishlist } from "@workspace/api-client-react";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export function ProductDetail() {
  const [, params] = useRoute("/shop/:id");
  const id = params?.id || "";
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const { data: product, isLoading, isError } = useGetProduct(id, {
    query: {
      enabled: !!id,
      queryKey: getGetProductQueryKey(id),
    }
  });

  const { data: wishlist } = useGetWishlist({
    query: { enabled: !!user, queryKey: getGetWishlistQueryKey() }
  });

  const isFavorited = wishlist?.some((p: { id: string }) => p.id === id) ?? false;
  
  const addToCart = useAddToCart();
  const addToWishlist = useAddToWishlist();
  const removeFromWishlist = useRemoveFromWishlist();

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center">
        <h2 className="text-3xl font-serif font-bold mb-4">Product Not Found</h2>
        <p className="text-muted-foreground mb-8">The product you are looking for does not exist or has been removed.</p>
        <Button variant="outline" className="rounded-none uppercase tracking-widest" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shop
        </Button>
      </div>
    );
  }

  const handleAddToCart = () => {
    const hasSizes = product?.sizes && product.sizes.length > 0;
    if (hasSizes && !selectedSize) {
      toast({
        variant: "destructive",
        title: "Please select a size",
        description: "You must select a size before adding to cart.",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Please login",
        description: "You need to be logged in to add items to your cart.",
      });
      return;
    }

    addToCart.mutate(
      { data: { productId: product.id, quantity: 1, size: selectedSize ?? "" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
          toast({
            title: "Added to cart",
            description: selectedSize
              ? `${product.name} (${selectedSize}) has been added to your cart.`
              : `${product.name} has been added to your cart.`,
          });
        }
      }
    );
  };

  const toggleWishlist = () => {
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
    <main className="w-full flex flex-col min-h-screen pb-20">
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24">
          
          {/* Image */}
          <div className="bg-muted aspect-[3/4] relative">
            <img 
              src={product.imageUrl} 
              alt={product.name} 
              className="w-full h-full object-cover object-center"
            />
          </div>

          {/* Details */}
          <div className="flex flex-col">
            <div className="mb-8">
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">{product.name}</h1>
              <p className="text-2xl font-medium text-muted-foreground">${product.price.toFixed(2)}</p>
            </div>

            <div className="prose prose-sm text-foreground/80 mb-10 max-w-none">
              <p>{product.description}</p>
            </div>

            {/* Size Selector */}
            {product.sizes.length > 0 && (
              <div className="mb-10">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider">Size</h3>
                  <button className="text-xs text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors underline underline-offset-4">
                    Size Guide
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {product.sizes.map((size: string) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={cn(
                        "h-12 min-w-[3rem] px-4 border flex items-center justify-center text-sm font-medium transition-all",
                        selectedSize === size 
                          ? "border-primary bg-primary text-primary-foreground" 
                          : "border-border hover:border-primary hover:text-primary bg-transparent text-foreground"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4 mb-12">
              <Button 
                className="flex-1 rounded-none uppercase tracking-widest font-bold h-14"
                disabled={addToCart.isPending}
                onClick={handleAddToCart}
              >
                {addToCart.isPending ? (
                  <Spinner className="h-5 w-5 mr-2" />
                ) : (
                  <ShoppingBag className="h-5 w-5 mr-2" />
                )}
                Add to Cart
              </Button>
              
              <Button 
                variant="outline"
                className="rounded-none h-14 w-14 p-0 border-border hover:bg-muted"
                onClick={toggleWishlist}
              >
                <Heart className={cn("h-5 w-5", isFavorited ? "fill-primary text-primary" : "text-foreground")} />
              </Button>
            </div>

            {/* Accordions */}
            <Accordion type="multiple" className="w-full">
              <AccordionItem value="details">
                <AccordionTrigger className="uppercase tracking-wider text-sm font-bold">Product Details</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Premium compressive fabric blend</li>
                    <li>Designed for medium to high impact</li>
                    <li>Moisture-wicking and breathable</li>
                    <li>Imported</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="shipping">
                <AccordionTrigger className="uppercase tracking-wider text-sm font-bold">Shipping & Returns</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed space-y-4">
                  <p className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-primary shrink-0" />
                    <span>Free express shipping on NYC orders over $150. Standard shipping takes 3-4 business days.</span>
                  </p>
                  <p>Returns accepted within 5 days for full refund. Store credit available for up to 365 days on unworn items with tags attached.</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>
    </main>
  );
}
