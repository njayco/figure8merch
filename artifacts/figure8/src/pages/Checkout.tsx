import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useGetCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");

const contactSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(2, "First name required"),
  lastName: z.string().min(2, "Last name required"),
  address: z.string().min(5, "Address required"),
  city: z.string().min(2, "City required"),
  state: z.string().min(2, "State required"),
  zipCode: z.string().min(5, "Zip code required"),
});

type ContactValues = z.infer<typeof contactSchema>;

export function Checkout() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [stripeAvailable, setStripeAvailable] = useState<boolean | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { data: cart, isLoading } = useGetCart({
    query: {
      enabled: !!user,
      queryKey: getGetCartQueryKey(),
    },
  });

  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      email: user?.email || "",
      firstName: user?.name?.split(" ")[0] || "",
      lastName: user?.name?.split(" ").slice(1).join(" ") || "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
    },
  });

  // Check if Stripe is configured
  useEffect(() => {
    fetch(`${BASE}/api/stripe/config`)
      .then((r) => r.json())
      .then(({ publishableKey }) => setStripeAvailable(!!publishableKey))
      .catch(() => setStripeAvailable(false));
  }, []);

  if (isLoading || stripeAvailable === null) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    setLocation("/cart");
    return null;
  }

  const onSubmit = async (values: ContactValues) => {
    if (!stripeAvailable) return;

    const shippingAddress = `${values.firstName} ${values.lastName}, ${values.address}, ${values.city}, ${values.state} ${values.zipCode}`;

    setIsRedirecting(true);
    try {
      const successUrl = `${window.location.origin}${BASE}/order-success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${window.location.origin}${BASE}/checkout`;

      const resp = await fetch(`${BASE}/api/stripe/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ shippingAddress, successUrl, cancelUrl }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Could not create checkout session");
      }

      // Redirect to Stripe's hosted Checkout page
      window.location.href = data.url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to initialize checkout";
      toast({ variant: "destructive", title: "Checkout Error", description: message });
      setIsRedirecting(false);
    }
  };

  return (
    <main className="w-full min-h-screen py-12 px-4 bg-muted/10">
      <div className="container mx-auto max-w-6xl">
        <h1 className="text-3xl font-serif font-bold mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="bg-background border border-border p-6 shadow-sm">
                  <h2 className="text-lg font-serif font-bold mb-6">Contact Information</h2>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase tracking-wider">Email</FormLabel>
                        <FormControl>
                          <Input className="rounded-none border-border focus-visible:ring-primary" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="bg-background border border-border p-6 shadow-sm">
                  <h2 className="text-lg font-serif font-bold mb-6">Shipping Address</h2>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase tracking-wider">First Name</FormLabel>
                          <FormControl>
                            <Input className="rounded-none border-border focus-visible:ring-primary" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase tracking-wider">Last Name</FormLabel>
                          <FormControl>
                            <Input className="rounded-none border-border focus-visible:ring-primary" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase tracking-wider">Street Address</FormLabel>
                          <FormControl>
                            <Input className="rounded-none border-border focus-visible:ring-primary" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-6 gap-4">
                      <div className="col-span-3">
                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs uppercase tracking-wider">City</FormLabel>
                              <FormControl>
                                <Input className="rounded-none border-border focus-visible:ring-primary" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="col-span-1">
                        <FormField
                          control={form.control}
                          name="state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs uppercase tracking-wider">State</FormLabel>
                              <FormControl>
                                <Input className="rounded-none border-border focus-visible:ring-primary" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="col-span-2">
                        <FormField
                          control={form.control}
                          name="zipCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs uppercase tracking-wider">Zip Code</FormLabel>
                              <FormControl>
                                <Input className="rounded-none border-border focus-visible:ring-primary" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {stripeAvailable && (
                  <div className="bg-muted/30 border border-border p-4 text-sm text-muted-foreground">
                    <p>You will be redirected to Stripe's secure checkout page to enter your payment details.</p>
                  </div>
                )}

                {!stripeAvailable && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded p-3">
                    <p className="text-sm font-medium text-destructive">Payment Unavailable</p>
                    <p className="text-xs text-muted-foreground mt-1">Stripe is not configured for this environment. Please contact support.</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full rounded-none uppercase tracking-widest font-bold h-14 text-base"
                  disabled={isRedirecting || !stripeAvailable}
                >
                  {isRedirecting
                    ? "Redirecting to payment..."
                    : stripeAvailable
                    ? `Continue to Payment — $${cart.total.toFixed(2)}`
                    : "Payment Unavailable"}
                </Button>
              </form>
            </Form>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-muted/30 p-8 border border-border sticky top-24">
              <h2 className="text-xl font-serif font-bold mb-6">In Your Bag</h2>

              <div className="space-y-6 mb-8 max-h-[400px] overflow-y-auto pr-2">
                {cart.items.map((item: any) => (
                  <div key={`${item.product.id}-${item.size}`} className="flex gap-4">
                    <div className="w-16 h-20 bg-muted shrink-0 relative">
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute -top-2 -right-2 bg-foreground text-background text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <p className="text-sm font-medium leading-tight">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground mt-1 uppercase">Size: {item.size}</p>
                    </div>
                    <div className="flex items-center">
                      <p className="text-sm font-medium">${(item.product.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4 text-sm border-t border-border pt-6 mb-6">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">${cart.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-medium">Free</span>
                </div>
              </div>

              <div className="flex justify-between text-xl font-bold border-t border-border pt-6">
                <span>Total</span>
                <span>${cart.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
