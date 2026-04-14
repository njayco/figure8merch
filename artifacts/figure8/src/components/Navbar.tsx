import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, ShoppingBag, User as UserIcon, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useGetCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: cart } = useGetCart({ query: { enabled: !!user, queryKey: getGetCartQueryKey() } });

  const isHome = location === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { name: "New Arrivals", href: "/shop?category=new" },
    { name: "Collections", href: "/shop" },
    { name: "Athleisure", href: "/shop?category=athleisure" },
    { name: "Our Story", href: "/about" },
  ];

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md transition-all duration-300",
      isHome && !scrolled ? "opacity-0 pointer-events-none -translate-y-full" : "opacity-100 translate-y-0"
    )}>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Mobile Menu Toggle */}
        <button
          className="lg:hidden text-foreground hover:text-primary transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center space-x-8 flex-1">
          {navLinks.map((link) => (
            <Link key={link.name} href={link.href} className="text-sm uppercase tracking-wider text-foreground/80 hover:text-primary transition-colors font-medium">
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Logo */}
        <div className="flex-1 lg:flex-none flex justify-center lg:justify-center">
          <Link href="/" className="font-serif text-2xl tracking-widest text-primary font-bold">
            FIGURE 8
          </Link>
        </div>

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center space-x-6 flex-1 justify-end">
          <Link href="/wishlist" className="text-foreground/80 hover:text-primary transition-colors">
            <Heart className="h-5 w-5" />
          </Link>
          
          {user ? (
            <div className="flex items-center space-x-4">
              <Link href="/orders" className="text-sm uppercase tracking-wider text-foreground/80 hover:text-primary transition-colors font-medium">
                Orders
              </Link>
              {user.isAdmin && (
                <Link href="/admin" className="text-sm uppercase tracking-wider text-foreground/80 hover:text-primary transition-colors font-medium">
                  Admin
                </Link>
              )}
              <button onClick={() => logout()} className="text-sm uppercase tracking-wider text-foreground/80 hover:text-primary transition-colors font-medium">
                Logout
              </button>
            </div>
          ) : (
            <Link href="/login" className="text-foreground/80 hover:text-primary transition-colors">
              <UserIcon className="h-5 w-5" />
            </Link>
          )}
          
          <Link href="/cart" className="relative text-foreground/80 hover:text-primary transition-colors group">
            <ShoppingBag className="h-5 w-5" />
            {cart && cart.itemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                {cart.itemCount}
              </span>
            )}
          </Link>
        </div>

        {/* Mobile Actions */}
        <div className="lg:hidden flex items-center space-x-4">
          <Link href="/cart" className="relative text-foreground hover:text-primary transition-colors">
            <ShoppingBag className="h-6 w-6" />
            {cart && cart.itemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                {cart.itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={cn("lg:hidden absolute top-16 left-0 w-full bg-background border-b border-border shadow-lg transition-all duration-300 ease-in-out origin-top", isOpen ? "scale-y-100 opacity-100 visible" : "scale-y-0 opacity-0 invisible")}>
        <div className="flex flex-col p-4 space-y-4">
          {navLinks.map((link) => (
            <Link key={link.name} href={link.href} className="text-lg uppercase tracking-wider text-foreground hover:text-primary transition-colors" onClick={() => setIsOpen(false)}>
              {link.name}
            </Link>
          ))}
          <div className="w-full h-px bg-border my-2" />
          <Link href="/wishlist" className="text-lg uppercase tracking-wider text-foreground hover:text-primary transition-colors" onClick={() => setIsOpen(false)}>
            Wishlist
          </Link>
          {user ? (
            <>
              <Link href="/orders" className="text-lg uppercase tracking-wider text-foreground hover:text-primary transition-colors" onClick={() => setIsOpen(false)}>
                Orders
              </Link>
              {user.isAdmin && (
                <Link href="/admin" className="text-lg uppercase tracking-wider text-foreground hover:text-primary transition-colors" onClick={() => setIsOpen(false)}>
                  Admin Dashboard
                </Link>
              )}
              <button onClick={() => { logout(); setIsOpen(false); }} className="text-lg uppercase tracking-wider text-left text-foreground hover:text-primary transition-colors">
                Logout
              </button>
            </>
          ) : (
            <Link href="/login" className="text-lg uppercase tracking-wider text-foreground hover:text-primary transition-colors" onClick={() => setIsOpen(false)}>
              Login / Register
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
