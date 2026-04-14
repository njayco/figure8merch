import { Link } from "wouter";
import { SiVisa, SiMastercard, SiApplepay, SiPaypal, SiInstagram, SiTiktok } from "react-icons/si";

export function Footer() {
  return (
    <footer className="bg-foreground text-background py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1 space-y-4">
            <Link href="/" className="font-serif text-2xl tracking-widest font-bold block">
              FIGURE 8
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Premium athleisure designed for every body. Power, confidence, and beauty in every curve.
            </p>
            <div className="flex space-x-4 pt-2">
              <a href="#" className="text-muted-foreground hover:text-background transition-colors">
                <SiInstagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-background transition-colors">
                <SiTiktok className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Shop Links */}
          <div className="space-y-4">
            <h4 className="font-serif text-lg tracking-wider">SHOP</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/shop" className="hover:text-background transition-colors">All Products</Link></li>
              <li><Link href="/shop?category=new" className="hover:text-background transition-colors">New Arrivals</Link></li>
              <li><Link href="/shop?category=athleisure" className="hover:text-background transition-colors">Athleisure</Link></li>
              <li><Link href="/shop?category=accessories" className="hover:text-background transition-colors">Accessories</Link></li>
            </ul>
          </div>

          {/* Help Links */}
          <div className="space-y-4">
            <h4 className="font-serif text-lg tracking-wider">HELP</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/about" className="hover:text-background transition-colors">FAQ</Link></li>
              <li><Link href="/about" className="hover:text-background transition-colors">Shipping & Returns</Link></li>
              <li><Link href="/about" className="hover:text-background transition-colors">Care Instructions</Link></li>
              <li><Link href="/about" className="hover:text-background transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="col-span-1 md:col-span-1 space-y-4">
            <h4 className="font-serif text-lg tracking-wider">STAY IN THE LOOP</h4>
            <p className="text-sm text-muted-foreground">Subscribe for 10% off your first order.</p>
            <form className="flex border-b border-muted-foreground/30 focus-within:border-background transition-colors pb-2 pt-2" onSubmit={(e) => e.preventDefault()}>
              <input 
                type="email" 
                placeholder="Email address" 
                className="bg-transparent w-full text-sm outline-none placeholder:text-muted-foreground/50 text-background"
              />
              <button type="submit" className="text-xs tracking-wider uppercase font-medium hover:text-primary transition-colors">
                Join
              </button>
            </form>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-muted-foreground/20 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} FIGURE 8. All rights reserved.
          </p>
          <div className="flex items-center space-x-4 text-muted-foreground opacity-70">
            <SiVisa className="h-6 w-8" />
            <SiMastercard className="h-6 w-8" />
            <SiApplepay className="h-8 w-10" />
            <SiPaypal className="h-5 w-5" />
          </div>
        </div>
      </div>
    </footer>
  );
}
