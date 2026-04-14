import { useGetWishlist, getGetWishlistQueryKey } from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { ProductCard } from "@/components/ProductCard";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function Wishlist() {
  const { user } = useAuth();
  const { data: wishlist, isLoading } = useGetWishlist({
    query: {
      enabled: !!user,
      queryKey: getGetWishlistQueryKey(),
    }
  });

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-3xl font-serif font-bold mb-4">Your Wishlist</h2>
        <p className="text-muted-foreground mb-8">Please log in to view your saved items.</p>
        <Link href="/login">
          <Button className="rounded-none uppercase tracking-widest font-bold">Sign In</Button>
        </Link>
      </div>
    );
  }

  return (
    <main className="w-full min-h-[80vh] flex flex-col px-4 py-12 container mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-serif font-bold text-foreground">Wishlist</h1>
        <p className="mt-4 text-muted-foreground">Your curated collection of favorites.</p>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : wishlist && wishlist.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
          {wishlist.map((product: Product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
          <h3 className="text-2xl font-serif font-bold mb-4">No Favorites Yet</h3>
          <p className="text-muted-foreground mb-8 max-w-md">
            Save your favorite pieces by clicking the heart icon on products. They'll be waiting for you here.
          </p>
          <Link href="/shop">
            <Button className="rounded-none uppercase tracking-widest font-bold">Discover Collection</Button>
          </Link>
        </div>
      )}
    </main>
  );
}
