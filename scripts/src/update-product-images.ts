import { getUncachableStripeClient } from './stripeClient';

const PRODUCT_IMAGES: Record<string, string> = {
  "The Signature Set": "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=800&auto=format&fit=crop",
  "The Elevated Legging": "https://images.unsplash.com/photo-1548690312-e3b507d8c110?w=800&auto=format&fit=crop",
  "The Studio Bra": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&auto=format&fit=crop",
  "The Butter Short": "https://images.unsplash.com/photo-1594381898411-846e7d193883?w=800&auto=format&fit=crop",
  "The Café Cardigan": "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&auto=format&fit=crop",
  "The Seamless Top": "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&auto=format&fit=crop",
};

async function updateProductImages() {
  try {
    const stripe = await getUncachableStripeClient();
    console.log('Updating Figure 8 product images in Stripe...');

    for (const [name, imageUrl] of Object.entries(PRODUCT_IMAGES)) {
      const existing = await stripe.products.search({
        query: `name:'${name}' AND active:'true'`
      });

      if (existing.data.length === 0) {
        console.log(`✗ Not found: ${name}`);
        continue;
      }

      const product = existing.data[0];

      if (product.images && product.images.length > 0) {
        console.log(`✓ Already has image: ${name}`);
        continue;
      }

      await stripe.products.update(product.id, {
        images: [imageUrl],
      });

      console.log(`✓ Updated image: ${name}`);
    }

    console.log('\nAll product images updated successfully!');
  } catch (err: any) {
    console.error('Error updating product images:', err.message);
    process.exit(1);
  }
}

updateProductImages();
