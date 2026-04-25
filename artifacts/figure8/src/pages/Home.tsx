import { Link } from "wouter";
import { ArrowRight, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListFeaturedProducts } from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { Spinner } from "@/components/ui/spinner";
import { LandingHero } from "@/components/LandingHero";
import ArmImage from "@assets/f8arm_1776198255495.JPG";

export function Home() {
  const { data: featuredProducts, isLoading } = useListFeaturedProducts();

  return (
    <main className="w-full flex flex-col">
      {/* Shipping Banner — sliding marquee at top of page */}
      <div className="bg-primary text-primary-foreground py-2 text-sm font-medium tracking-wide overflow-hidden whitespace-nowrap">
        <div className="inline-flex items-center gap-2 shipping-marquee">
          <Truck className="h-4 w-4 shrink-0" />
          <span>Free Express Shipping on NYC Orders over $150</span>
        </div>
        <style>{`
          .shipping-marquee {
            animation: shippingSlide 18s linear infinite;
            padding-left: 100%;
          }
          @keyframes shippingSlide {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>

      {/* Full-screen editorial landing hero */}
      <LandingHero />

      {/* Featured Pieces */}
      <section className="py-24 px-4 container mx-auto">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-2">Selected Pieces</h2>
            <p className="text-muted-foreground">The silhouettes everyone is talking about.</p>
          </div>
          <Link href="/shop" className="hidden md:flex items-center text-sm uppercase tracking-widest font-medium hover:text-primary transition-colors group">
            View All <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Spinner className="h-8 w-8 text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredProducts?.slice(0, 4).map((product: Product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        <div className="mt-8 flex justify-center md:hidden">
          <Link href="/shop">
            <Button variant="outline" className="rounded-none uppercase tracking-widest w-full">
              View All Pieces
            </Button>
          </Link>
        </div>
      </section>

      {/* Split Feature Section — "Power in Every Curve" */}
      <section className="bg-secondary/30">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="aspect-square lg:aspect-auto h-full min-h-[50vh] relative overflow-hidden">
            <img
              src={ArmImage}
              alt="Figure 8 Brand Detail"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            {/* Editorial overlay text on the image */}
            <div className="absolute inset-0 bg-black/30 flex items-end p-10">
              <p className="font-serif italic text-white text-3xl md:text-4xl font-light leading-tight">
                Power in Every Curve
              </p>
            </div>
          </div>
          <div className="flex flex-col justify-center p-12 md:p-24 lg:p-32 space-y-6">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground leading-tight">
              Built for Every Body
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              We believe activewear should honor your body, not restrict it. Our premium fabrics offer compressive support while maintaining luxurious softness. Designed in New York, engineered for confidence.
            </p>
            <div className="pt-4">
              <Link href="/about">
                <Button variant="link" className="px-0 uppercase tracking-widest font-bold hover:text-primary p-0 h-auto text-foreground decoration-primary underline-offset-8">
                  Read Our Story
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-24 px-4 bg-primary text-primary-foreground text-center">
        <div className="container mx-auto max-w-2xl space-y-6">
          <h2 className="text-3xl md:text-4xl font-serif font-bold">Join the List</h2>
          <p className="text-primary-foreground/80 pb-4">
            Sign up to receive 10% off your first order, plus early access to new drops.
          </p>
          <form className="flex max-w-md mx-auto" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Your email address"
              className="flex-1 bg-white/10 border border-white/30 text-white placeholder:text-white/60 px-4 py-3 outline-none focus:border-white transition-colors"
            />
            <Button type="submit" className="bg-white text-primary hover:bg-white/90 rounded-none px-8 uppercase tracking-widest font-bold h-auto">
              Subscribe
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
