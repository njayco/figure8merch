import { getUncachableStripeClient } from './stripeClient';

const FIGURE8_PRODUCTS = [
  {
    name: "The Signature Set",
    description: "Our best-selling two-piece set. Moisture-wicking fabric with four-way stretch. Available in Cream, Mocha, and Espresso.",
    price: 14800,
    category: "sets",
    images: ["https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=800&auto=format&fit=crop"],
    metadata: { category: "sets", featured: "true" },
  },
  {
    name: "The Elevated Legging",
    description: "High-waist compression legging with a buttery-soft finish. 25\" inseam.",
    price: 8800,
    category: "bottoms",
    images: ["https://images.unsplash.com/photo-1548690312-e3b507d8c110?w=800&auto=format&fit=crop"],
    metadata: { category: "bottoms", featured: "true" },
  },
  {
    name: "The Studio Bra",
    description: "Medium-support sports bra with removable cups and a sleek back strap design.",
    price: 6800,
    category: "tops",
    images: ["https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&auto=format&fit=crop"],
    metadata: { category: "tops", featured: "false" },
  },
  {
    name: "The Butter Short",
    description: "High-rise biker short in our signature butter fabric. 4\" inseam.",
    price: 7200,
    category: "bottoms",
    images: ["https://images.unsplash.com/photo-1594381898411-846e7d193883?w=800&auto=format&fit=crop"],
    metadata: { category: "bottoms", featured: "false" },
  },
  {
    name: "The Café Cardigan",
    description: "Oversized ribbed cardigan in a warm café brown. Perfect post-workout layering piece.",
    price: 11200,
    category: "outerwear",
    images: ["https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&auto=format&fit=crop"],
    metadata: { category: "outerwear", featured: "true" },
  },
  {
    name: "The Seamless Top",
    description: "Lightweight seamless fitted top. Minimal seam construction for zero chafing.",
    price: 6200,
    category: "tops",
    images: ["https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&auto=format&fit=crop"],
    metadata: { category: "tops", featured: "false" },
  },
];

async function seedProducts() {
  try {
    const stripe = await getUncachableStripeClient();
    console.log('Seeding Figure 8 products to Stripe...');

    for (const product of FIGURE8_PRODUCTS) {
      // Check if product already exists
      const existing = await stripe.products.search({
        query: `name:'${product.name}' AND active:'true'`
      });

      if (existing.data.length > 0) {
        console.log(`✓ Already exists: ${product.name}`);
        continue;
      }

      const created = await stripe.products.create({
        name: product.name,
        description: product.description,
        images: product.images,
        metadata: product.metadata,
      });

      await stripe.prices.create({
        product: created.id,
        unit_amount: product.price,
        currency: 'usd',
      });

      console.log(`✓ Created: ${product.name} — $${(product.price / 100).toFixed(2)}`);
    }

    console.log('\nAll Figure 8 products seeded successfully!');
    console.log('Run the server to sync them via syncBackfill.');
  } catch (err: any) {
    console.error('Error seeding products:', err.message);
    process.exit(1);
  }
}

seedProducts();
