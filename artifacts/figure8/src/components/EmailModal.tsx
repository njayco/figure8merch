import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useEmailSignup } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export function EmailModal() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const signup = useEmailSignup();

  useEffect(() => {
    const hasSeenModal = localStorage.getItem("f8_has_seen_modal");
    if (!hasSeenModal) {
      const timer = setTimeout(() => {
        setOpen(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      localStorage.setItem("f8_has_seen_modal", "true");
    }
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    signup.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({
            title: "Welcome to Figure 8",
            description: "Check your email for your 10% off code.",
          });
          setOpen(false);
          localStorage.setItem("f8_has_seen_modal", "true");
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Something went wrong. Please try again later.",
          });
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-background border-border text-center">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif text-primary">Enjoy 10% OFF your first order</DialogTitle>
          <DialogDescription className="text-muted-foreground mt-2">
            Join the Figure 8 community and get exclusive access to new arrivals, sales, and more.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Your email address" {...field} className="bg-white border-primary" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-none" disabled={signup.isPending}>
              {signup.isPending ? "SUBSCRIBING..." : "SUBSCRIBE"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
