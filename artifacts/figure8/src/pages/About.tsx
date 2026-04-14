import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Truck, RotateCcw, Droplets, MapPin, Mail, Phone } from "lucide-react";

export function About() {
  return (
    <main className="w-full">
      {/* Hero */}
      <section className="bg-primary text-primary-foreground py-24 px-4">
        <div className="container mx-auto max-w-3xl text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-serif font-bold">About Figure 8</h1>
          <p className="text-lg md:text-xl font-light text-primary-foreground/90 leading-relaxed">
            We believe activewear should honor your body, not restrict it. 
            Premium athleisure designed for the modern woman who demands both performance and uncompromising style.
          </p>
        </div>
      </section>

      {/* Info Blocks */}
      <section className="py-20 px-4 container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-16 w-16 bg-secondary rounded-full flex items-center justify-center text-primary">
              <Droplets className="h-8 w-8" />
            </div>
            <h3 className="font-serif text-xl font-bold">Care Instructions</h3>
            <p className="text-muted-foreground text-sm">
              To maintain the integrity of our compressive fabrics: gentle wash cold with like colors. Do not bleach. Air dry only—never tumble dry.
            </p>
          </div>
          
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-16 w-16 bg-secondary rounded-full flex items-center justify-center text-primary">
              <Truck className="h-8 w-8" />
            </div>
            <h3 className="font-serif text-xl font-bold">NYC Same-Day Delivery</h3>
            <p className="text-muted-foreground text-sm">
              Available across the 4 boroughs (Manhattan, Brooklyn, Queens, Bronx) for all orders over $150 placed before 2 PM EST.
            </p>
          </div>
          
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-16 w-16 bg-secondary rounded-full flex items-center justify-center text-primary">
              <MapPin className="h-8 w-8" />
            </div>
            <h3 className="font-serif text-xl font-bold">Designed in NY</h3>
            <p className="text-muted-foreground text-sm">
              Every silhouette is meticulously prototyped and wear-tested in our New York studio before production.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ & Contact */}
      <section className="bg-muted/30 py-20 px-4">
        <div className="container mx-auto max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-16">
          
          {/* FAQ */}
          <div>
            <h2 className="text-3xl font-serif font-bold mb-8">Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-left font-medium">What is your return policy?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  We accept returns for full refunds to the original payment method within 5 days of delivery. The items must be unworn, unwashed, and have original tags attached.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger className="text-left font-medium">Do you offer store credit?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  Yes, you have up to 365 days to return items for store credit, provided they meet our return conditions (unworn, unwashed, tags attached).
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger className="text-left font-medium">How long does shipping take?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  Please allow 2-5 business days for order processing. Once shipped, standard delivery takes 3-4 business days. NYC Same-Day delivery is available for eligible orders.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger className="text-left font-medium">How can I track my order?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  Once your order ships, you will receive an email containing a tracking number and a link to monitor your shipment's progress.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Contact */}
          <div>
            <div className="bg-background border border-border p-8 shadow-sm">
              <h2 className="text-2xl font-serif font-bold mb-6">Contact Us</h2>
              <p className="text-muted-foreground mb-8 text-sm">
                Have a question about sizing, fit, or an existing order? Our concierge team is here to help.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <Mail className="h-6 w-6 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">Email</h4>
                    <a href="mailto:F8merch@gmail.com" className="text-muted-foreground hover:text-primary transition-colors">
                      F8merch@gmail.com
                    </a>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <Phone className="h-6 w-6 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">Phone</h4>
                    <a href="tel:786-967-9149" className="text-muted-foreground hover:text-primary transition-colors">
                      (786) 967-9149
                    </a>
                    <p className="text-xs text-muted-foreground mt-1">Mon-Fri, 9am - 5pm EST</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>
    </main>
  );
}
