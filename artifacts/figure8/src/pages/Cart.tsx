import { Link } from "wouter";
import { Trash2, Plus, Minus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetCart, getGetCartQueryKey, useUpdateCartItem, useRemoveFromCart } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import { ProductImage } from "@/components/ProductImage";
import { useQueryClient } from "@tanstack/react-query";

export function Cart() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: cart, isLoading } = useGetCart({
    query: {
      enabled: !!user,
      queryKey: getGetCartQueryKey(),
    }
  });

  const updateCartItem = useUpdateCartItem();
  const removeFromCart = useRemoveFromCart();

  const handleUpdateQuantity = (
    productId: string,
    size: string,
    color: string,
    newQuantity: number
  ) => {
    if (newQuantity < 1) return;
    updateCartItem.mutate(
      {
        productId,
        size,
        data: { quantity: newQuantity },
        params: color ? { color } : undefined,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        },
      }
    );
  };

  const handleRemove = (productId: string, size: string, color: string) => {
    removeFromCart.mutate(
      { productId, size, params: color ? { color } : undefined },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        },
      }
    );
  };

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-3xl font-serif font-bold mb-4">Your Cart</h2>
        <p className="text-muted-foreground mb-8">Please log in to view your cart.</p>
        <Link href="/login">
          <Button className="rounded-none uppercase tracking-widest font-bold">Sign In</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-3xl font-serif font-bold mb-4">Your Cart is Empty</h2>
        <p className="text-muted-foreground mb-8">Discover our latest arrivals and premium athleisure.</p>
        <Link href="/shop">
          <Button className="rounded-none uppercase tracking-widest font-bold">Shop Now</Button>
        </Link>
      </div>
    );
  }

  return (
    <main className="w-full min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <h1 className="text-4xl font-serif font-bold mb-12 border-b border-border pb-4">Shopping Cart</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-8">
            {cart.items.map((item) => {
              const itemColor = item.color ?? "";
              const lineKey = `${item.product.id}-${item.size}-${itemColor}`;
              return (
                <div key={lineKey} className="flex flex-col sm:flex-row gap-6 border-b border-border pb-8" data-testid={`cart-item-${item.product.id}-${item.size}-${itemColor}`}>
                  {/* Image */}
                  <Link href={`/shop/${item.product.id}`} className="w-full sm:w-32 aspect-[3/4] bg-muted shrink-0 block">
                    <ProductImage
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      productId={item.product.id}
                    />
                  </Link>

                  {/* Details */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <Link href={`/shop/${item.product.id}`} className="text-lg font-medium hover:text-primary transition-colors">
                          {item.product.name}
                        </Link>
                        <p className="text-sm text-muted-foreground mt-1 uppercase tracking-wider">
                          Size: {item.size}
                          {itemColor && (
                            <>
                              <span className="mx-2 opacity-50">·</span>
                              Color: {itemColor}
                            </>
                          )}
                        </p>
                      </div>
                      <p className="font-medium">${(item.product.price * item.quantity).toFixed(2)}</p>
                    </div>

                    <div className="flex justify-between items-center mt-6 sm:mt-0">
                      {/* Quantity Selector */}
                      <div className="flex items-center border border-border">
                        <button
                          className="px-3 py-2 hover:bg-muted transition-colors disabled:opacity-50"
                          onClick={() => handleUpdateQuantity(item.product.id, item.size, itemColor, item.quantity - 1)}
                          disabled={item.quantity <= 1 || updateCartItem.isPending}
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          className="px-3 py-2 hover:bg-muted transition-colors"
                          onClick={() => handleUpdateQuantity(item.product.id, item.size, itemColor, item.quantity + 1)}
                          disabled={updateCartItem.isPending}
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleRemove(item.product.id, item.size, itemColor)}
                        disabled={removeFromCart.isPending}
                        className="text-sm text-muted-foreground hover:text-destructive flex items-center uppercase tracking-widest transition-colors font-medium"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-muted/30 p-8 border border-border sticky top-24">
              <h2 className="text-xl font-serif font-bold mb-6">Order Summary</h2>
              
              <div className="space-y-4 text-sm mb-6 border-b border-border pb-6">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">${cart.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-medium">Calculated at checkout</span>
                </div>
              </div>

              <div className="flex justify-between text-lg font-bold mb-8">
                <span>Total</span>
                <span>${cart.total.toFixed(2)}</span>
              </div>

              {cart.total > 150 && (
                <div className="bg-primary/10 text-primary p-4 mb-8 text-sm font-medium border border-primary/20">
                  You qualify for Free NYC Same-Day Delivery! (Eligible zip codes only)
                </div>
              )}

              <Link href="/checkout">
                <Button className="w-full rounded-none uppercase tracking-widest font-bold h-14">
                  Proceed to Checkout <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
