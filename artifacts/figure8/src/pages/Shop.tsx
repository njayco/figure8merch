import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListProducts } from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { Spinner } from "@/components/ui/spinner";

export function Shop() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const categoryParams = searchParams.get("category");
  
  const [category, setCategory] = useState<string | undefined>(categoryParams || undefined);

  const { data: products, isLoading } = useListProducts({ category });

  const categories = [
    { name: "All", value: undefined },
    { name: "Sets", value: "sets" },
    { name: "Tops", value: "tops" },
    { name: "Bottoms", value: "bottoms" },
    { name: "Outerwear", value: "outerwear" },
  ];

  return (
    <main className="w-full flex flex-col min-h-screen">
      <section className="bg-muted py-12 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground">
          {category ? categories.find(c => c.value === category)?.name || "Shop" : "All Products"}
        </h1>
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
          Explore our collection of premium athleisure designed for power, confidence, and beauty in every curve.
        </p>
      </section>

      <section className="container mx-auto px-4 py-12 flex flex-col md:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="sticky top-24">
            <h3 className="font-serif text-lg font-bold mb-4 uppercase tracking-wider">Categories</h3>
            <ul className="space-y-3">
              {categories.map((c) => (
                <li key={c.name}>
                  <button
                    onClick={() => setCategory(c.value)}
                    className={`text-sm uppercase tracking-wider transition-colors hover:text-primary ${
                      category === c.value ? "text-primary font-bold" : "text-muted-foreground"
                    }`}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Product Grid */}
        <div className="flex-1">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Spinner className="h-8 w-8 text-primary" />
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
              {products.map((product: Product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <h3 className="text-2xl font-serif font-bold mb-2">No Products Found</h3>
              <p className="text-muted-foreground">We couldn't find any products in this category.</p>
              <button 
                onClick={() => setCategory(undefined)}
                className="mt-6 uppercase tracking-widest text-sm font-bold border-b border-foreground pb-1 hover:text-primary hover:border-primary transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
