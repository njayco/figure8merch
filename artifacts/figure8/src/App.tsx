import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useCallback } from "react";
import NotFound from "@/pages/not-found";

import { AuthProvider } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { EmailModal } from "@/components/EmailModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SplashScreen } from "@/components/SplashScreen";

import { Home } from "@/pages/Home";
import { Shop } from "@/pages/Shop";
import { ProductDetail } from "@/pages/ProductDetail";
import { Cart } from "@/pages/Cart";
import { Checkout } from "@/pages/Checkout";
import { Wishlist } from "@/pages/Wishlist";
import { Orders } from "@/pages/Orders";
import { Admin } from "@/pages/Admin";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { About } from "@/pages/About";
import { Community } from "@/pages/Community";
import { OrderSuccess } from "@/pages/OrderSuccess";

const queryClient = new QueryClient();

const hasSeenSplash = () => {
  try {
    return sessionStorage.getItem("f8_splash_seen") === "true";
  } catch {
    return false;
  }
};

function Router() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <EmailModal />
      <div className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/shop" component={Shop} />
          <Route path="/shop/:id" component={ProductDetail} />
          <Route path="/cart" component={Cart} />
          <Route path="/checkout" component={Checkout} />
          <Route path="/wishlist" component={Wishlist} />
          <Route path="/orders" component={Orders} />
          <Route path="/order-success" component={OrderSuccess} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/about" component={About} />
          <Route path="/community" component={Community} />
          <Route path="/admin">
            {() => (
              <ProtectedRoute adminOnly>
                <Admin />
              </ProtectedRoute>
            )}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </div>
      <Footer />
    </div>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(() => !hasSeenSplash());

  const handleSplashComplete = useCallback(() => {
    try {
      sessionStorage.setItem("f8_splash_seen", "true");
    } catch {
    }
    setShowSplash(false);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
