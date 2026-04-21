import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
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
import {
  useGetCart,
  getGetCartQueryKey,
  useCreateOrder,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import { useQueryClient } from "@tanstack/react-query";

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

// Inner form rendered inside <Elements>
function StripeCheckoutForm({
  cart,
  contactValues,
}: {
  cart: any;
  contactValues: ContactValues;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const createOrder = useCreateOrder();

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);

    // Confirm payment with Stripe.js
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${BASE}/orders`,
      },
      redirect: "if_required",
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Payment Failed",
        description: error.message || "Your card was declined.",
      });
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      const fullAddress = `${contactValues.firstName} ${contactValues.lastName}, ${contactValues.address}, ${contactValues.city}, ${contactValues.state} ${contactValues.zipCode}`;
      createOrder.mutate(
        {
          data: {
            shippingAddress: fullAddress,
            paymentMethodId: paymentIntent.id,
          },
        },
        {
          onSuccess: (order) => {
            queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
            toast({
              title: "Order Confirmed",
              description: `Order #${order.id} placed successfully.`,
            });
            setLocation("/orders");
          },
          onError: () => {
            toast({
              variant: "destructive",
              title: "Order Error",
              description: "Payment succeeded but order creation failed. Contact support.",
            });
            setSubmitting(false);
          },
        }
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-background border border-border p-6 shadow-sm">
        <h2 className="text-lg font-serif font-bold mb-6">Payment</h2>
        <p className="text-sm text-muted-foreground mb-6">
          All transactions are secure and encrypted.
        </p>
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>

      <Button
        type="button"
        onClick={handlePay}
        className="w-full rounded-none uppercase tracking-widest font-bold h-16 text-lg"
        disabled={!stripe || !elements || submitting}
      >
        {submitting ? "Processing..." : `Pay $${cart.total.toFixed(2)}`}
      </Button>
    </div>
  );
}

// Outer shell: collects contact/shipping info, then loads Stripe Elements
export function Checkout() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [stripePromise, setStripePromise] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [step, setStep] = useState<"contact" | "payment">("contact");
  const [contactValues, setContactValues] = useState<ContactValues | null>(null);

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

  // Load Stripe publishable key
  useEffect(() => {
    fetch(`${BASE}/api/stripe/config`)
      .then((r) => r.json())
      .then(({ publishableKey }) => {
        if (publishableKey) {
          setStripePromise(loadStripe(publishableKey));
        }
      })
      .catch(() => {
        // Stripe not configured — fall back to simulated checkout
      });
  }, []);

  if (isLoading) {
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

  const onContactSubmit = async (values: ContactValues) => {
    setContactValues(values);

    if (!stripePromise) {
      // Fallback: no Stripe configured, go straight to simulated payment
      setStep("payment");
      return;
    }

    // Create PaymentIntent on the server
    try {
      const amountInCents = Math.round(cart.total * 100);
      const resp = await fetch(`${BASE}/api/stripe/create-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ amount: amountInCents }),
      });
      const data = await resp.json();
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setStep("payment");
      } else {
        throw new Error(data.error || "Could not initialize payment");
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Payment Setup Failed",
        description: err.message || "Unable to initialize checkout.",
      });
    }
  };

  return (
    <main className="w-full min-h-screen py-12 px-4 bg-muted/10">
      <div className="container mx-auto max-w-6xl">
        <h1 className="text-3xl font-serif font-bold mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Checkout Form */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Contact + Shipping */}
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onContactSubmit)}
                className="space-y-6"
              >
                <div className="bg-background border border-border p-6 shadow-sm">
                  <h2 className="text-lg font-serif font-bold mb-6">
                    Contact Information
                  </h2>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase tracking-wider">
                          Email
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="rounded-none border-border focus-visible:ring-primary"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="bg-background border border-border p-6 shadow-sm">
                  <h2 className="text-lg font-serif font-bold mb-6">
                    Shipping Address
                  </h2>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase tracking-wider">
                            First Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="rounded-none border-border focus-visible:ring-primary"
                              {...field}
                            />
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
                          <FormLabel className="text-xs uppercase tracking-wider">
                            Last Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="rounded-none border-border focus-visible:ring-primary"
                              {...field}
                            />
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
                          <FormLabel className="text-xs uppercase tracking-wider">
                            Street Address
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="rounded-none border-border focus-visible:ring-primary"
                              {...field}
                            />
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
                              <FormLabel className="text-xs uppercase tracking-wider">
                                City
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="rounded-none border-border focus-visible:ring-primary"
                                  {...field}
                                />
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
                              <FormLabel className="text-xs uppercase tracking-wider">
                                State
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="rounded-none border-border focus-visible:ring-primary"
                                  {...field}
                                />
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
                              <FormLabel className="text-xs uppercase tracking-wider">
                                Zip Code
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="rounded-none border-border focus-visible:ring-primary"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {step === "contact" && (
                  <Button
                    type="submit"
                    className="w-full rounded-none uppercase tracking-widest font-bold h-14 text-base"
                  >
                    Continue to Payment
                  </Button>
                )}
              </form>
            </Form>

            {/* Step 2: Stripe Payment */}
            {step === "payment" && contactValues && (
              <>
                {stripePromise && clientSecret ? (
                  <Elements
                    stripe={stripePromise}
                    options={{
                      clientSecret,
                      appearance: {
                        theme: "stripe",
                        variables: {
                          colorPrimary: "#3d2b1f",
                          fontFamily: "inherit",
                          borderRadius: "0px",
                        },
                      },
                    }}
                  >
                    <StripeCheckoutForm
                      cart={cart}
                      contactValues={contactValues}
                    />
                  </Elements>
                ) : (
                  <SimulatedPayment cart={cart} contactValues={contactValues} />
                )}
              </>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-5">
            <div className="bg-muted/30 p-8 border border-border sticky top-24">
              <h2 className="text-xl font-serif font-bold mb-6">In Your Bag</h2>

              <div className="space-y-6 mb-8 max-h-[400px] overflow-y-auto pr-2">
                {cart.items.map((item: any) => (
                  <div
                    key={`${item.product.id}-${item.size}`}
                    className="flex gap-4"
                  >
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
                      <p className="text-sm font-medium leading-tight">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 uppercase">
                        Size: {item.size}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <p className="text-sm font-medium">
                        ${(item.product.price * item.quantity).toFixed(2)}
                      </p>
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

// Fallback when Stripe is not yet configured
function SimulatedPayment({
  cart,
  contactValues,
}: {
  cart: any;
  contactValues: ContactValues;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const createOrder = useCreateOrder();

  const handlePay = () => {
    const fullAddress = `${contactValues.firstName} ${contactValues.lastName}, ${contactValues.address}, ${contactValues.city}, ${contactValues.state} ${contactValues.zipCode}`;
    createOrder.mutate(
      {
        data: {
          shippingAddress: fullAddress,
          paymentMethodId: "pm_simulated",
        },
      },
      {
        onSuccess: (order) => {
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
          toast({
            title: "Order Confirmed",
            description: `Order #${order.id} placed successfully.`,
          });
          setLocation("/orders");
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Checkout Failed",
            description: "There was an error processing your order.",
          });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-background border border-border p-6 shadow-sm">
        <h2 className="text-lg font-serif font-bold mb-4">Payment</h2>
        <div className="bg-amber-50 border border-amber-200 rounded p-3">
          <p className="text-sm font-medium text-amber-800">
            Test Mode — Stripe not yet connected
          </p>
          <p className="text-xs text-amber-700 mt-1">
            This checkout is simulated. No real payment will be processed.
          </p>
        </div>
      </div>

      <Button
        type="button"
        onClick={handlePay}
        disabled={createOrder.isPending}
        className="w-full rounded-none uppercase tracking-widest font-bold h-16 text-lg"
      >
        {createOrder.isPending
          ? "Processing..."
          : `Place Order — $${cart.total.toFixed(2)}`}
      </Button>
    </div>
  );
}
