import { Link } from "wouter";
import { ArrowRight, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListFeaturedProducts } from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { Spinner } from "@/components/ui/spinner";
import MainHeroImage from "@assets/Main_Profile_Photo_1776194361813.jpg";
import ArmImage from "@assets/f8arm_1776194361813.JPG";

export function Home() {
  const { data: featuredProducts, isLoading } = useListFeaturedProducts();

  return (
    <main className="w-full flex flex-col">
      {/* Shipping Banner */}
      <div className="bg-primary text-primary-foreground py-2 px-4 text-center text-sm font-medium tracking-wide flex items-center justify-center gap-2">
        <Truck className="h-4 w-4" />
        <span>Free Express Shipping on NYC Orders over $150</span>
      </div>

      {/* Hero Section */}
      <section className="relative h-[85vh] w-full overflow-hidden">
        <img 
          src={MainHeroImage} 
          alt="Figure 8 Models" 
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/20" /> {/* Subtle overlay for text readability */}
        
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center">
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-4 drop-shadow-lg">
            FIGURE 8
          </h1>
          <p className="text-lg md:text-2xl font-light tracking-wide mb-8 max-w-2xl drop-shadow-md">
            Premium Athleisure, Designed for Every Body
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/shop?category=new">
              <Button size="lg" className="bg-white text-black hover:bg-white/90 rounded-none uppercase tracking-widest px-8 w-full sm:w-auto h-14 text-sm font-bold">
                Shop New Arrivals
              </Button>
            </Link>
            <Link href="/shop">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-black rounded-none uppercase tracking-widest px-8 w-full sm:w-auto h-14 text-sm font-bold bg-transparent">
                Our Bestsellers
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Pieces */}
      <section className="py-24 px-4 container mx-auto">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-2">Curated for You</h2>
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

      {/* Split Feature Section */}
      <section className="bg-secondary/30">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="aspect-square lg:aspect-auto h-full min-h-[50vh] relative">
            <img 
              src={ArmImage} 
              alt="Figure 8 Brand Detail" 
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
          </div>
          <div className="flex flex-col justify-center p-12 md:p-24 lg:p-32 space-y-6">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground leading-tight">
              Power in Every Curve
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
