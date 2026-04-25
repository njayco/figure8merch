import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getGetCartQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");

type Status = "waiting-auth" | "loading" | "success" | "error";

export function OrderSuccess() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("waiting-auth");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const called = useRef(false);

  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");

  useEffect(() => {
    // Redirect immediately if there's no session ID — nothing to complete
    if (!sessionId) {
      setLocation("/orders");
      return;
    }

    // Wait until auth has finished loading before making any decisions
    if (authLoading) {
      setStatus("waiting-auth");
      return;
    }

    // Now auth is resolved — if no user, it's a real auth error
    if (!user) {
      setStatus("error");
      setErrorMsg("You must be logged in to complete your order.");
      return;
    }

    // Prevent duplicate calls (e.g. StrictMode double-effect)
    if (called.current) return;
    called.current = true;

    setStatus("loading");

    const token = localStorage.getItem("token");
    fetch(`${BASE}/api/stripe/complete-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.orderId) {
          setOrderId(data.orderId);
          setStatus("success");
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        } else {
          throw new Error(data.error || "Could not complete order");
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "An error occurred";
        setErrorMsg(message);
        setStatus("error");
      });
  }, [authLoading, user, sessionId, setLocation, queryClient]);

  if (status === "waiting-auth" || status === "loading") {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <Spinner className="h-8 w-8 text-primary" />
        <p className="text-sm text-muted-foreground">
          {status === "waiting-auth" ? "Loading..." : "Confirming your order..."}
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 px-4 text-center">
        <h1 className="text-2xl font-serif font-bold">Something went wrong</h1>
        <p className="text-muted-foreground max-w-md">
          {errorMsg || "We could not confirm your order. If your payment went through, contact support."}
        </p>
        <Button className="rounded-none uppercase tracking-widest" onClick={() => setLocation("/orders")}>
          View Orders
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-3xl font-serif font-bold">Order Confirmed</h1>
      {orderId && (
        <p className="text-muted-foreground">
          Order <span className="font-medium text-foreground">#{orderId}</span> has been placed successfully.
        </p>
      )}
      <p className="text-sm text-muted-foreground max-w-sm">
        Thank you for shopping with Figure 8. You will receive a confirmation email shortly.
      </p>
      <div className="flex gap-4">
        <Button variant="outline" className="rounded-none uppercase tracking-widest" onClick={() => setLocation("/orders")}>
          View Orders
        </Button>
        <Button className="rounded-none uppercase tracking-widest" onClick={() => setLocation("/shop")}>
          Continue Shopping
        </Button>
      </div>
    </div>
  );
}
