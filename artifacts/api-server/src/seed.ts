import { db, productsTable, usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

const products = [
  {
    name: "Brownin 3 Piece Set",
    description: "Premium three-piece athleisure set in rich brown tones. Includes sports bra, biker shorts, and matching leggings. Designed for power and style.",
    price: "19.00",
    imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&q=80",
    category: "sets",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    isFeatured: true,
    stock: 50,
  },
  {
    name: "De la Cream 3 Piece Set",
    description: "Luxurious three-piece set in signature cream colorway. Our most versatile look for pilates, yoga, or brunch.",
    price: "25.00",
    imageUrl: "https://images.unsplash.com/photo-1571945153237-4929e783af4a?w=600&q=80",
    category: "sets",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    isFeatured: true,
    stock: 40,
  },
  {
    name: "Figure 8 Sports Bra - Brown",
    description: "High-support sports bra with the iconic Figure 8 logo. Compressive yet breathable fabric. Perfect for high-intensity workouts.",
    price: "32.00",
    imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80",
    category: "tops",
    sizes: ["XS", "S", "M", "L", "XL"],
    isFeatured: false,
    stock: 75,
  },
  {
    name: "Figure 8 Sports Bra - Cream",
    description: "Signature cream sports bra for the modern athlete. Medium support with luxurious feel. Pairs beautifully with matching leggings.",
    price: "32.00",
    imageUrl: "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=600&q=80",
    category: "tops",
    sizes: ["XS", "S", "M", "L", "XL"],
    isFeatured: false,
    stock: 60,
  },
  {
    name: "High-Waist Leggings - Mocha",
    description: "Buttery smooth high-waist leggings in warm mocha. 4-way stretch with tummy control panel. Squat-proof fabric that moves with you.",
    price: "45.00",
    imageUrl: "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=600&q=80",
    category: "bottoms",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    isFeatured: true,
    stock: 90,
  },
  {
    name: "Figure 8 Biker Shorts",
    description: "Premium biker shorts with flattering high waist. Seamless construction for maximum comfort during any activity.",
    price: "28.00",
    imageUrl: "https://images.unsplash.com/photo-1554364266-52c8d3a4c9b5?w=600&q=80",
    category: "bottoms",
    sizes: ["XS", "S", "M", "L", "XL"],
    isFeatured: false,
    stock: 80,
  },
  {
    name: "Oversized Track Jacket",
    description: "The ultimate cozy layer. Oversized silhouette with Figure 8 emblem. Perfect for post-workout or everyday wear.",
    price: "65.00",
    imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80",
    category: "tops",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    isFeatured: true,
    stock: 35,
  },
  {
    name: "Figure 8 Zip Hoodie",
    description: "Lightweight zip-up hoodie in signature cream. French terry fabric with a flattering fit. The perfect transition piece.",
    price: "55.00",
    imageUrl: "https://images.unsplash.com/photo-1523381294911-8d3cead13475?w=600&q=80",
    category: "tops",
    sizes: ["XS", "S", "M", "L", "XL"],
    isFeatured: false,
    stock: 45,
  },
];

async function seed() {
  console.log("Seeding database...");

  const existingProducts = await db.select().from(productsTable);
  if (existingProducts.length === 0) {
    console.log("Inserting products...");
    await db.insert(productsTable).values(products);
    console.log(`Inserted ${products.length} products`);
  } else {
    console.log(`Skipping products seed: ${existingProducts.length} products already exist`);
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.warn("ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin seed");
  } else {
    const existingAdmin = await db.select().from(usersTable).where(eq(usersTable.email, adminEmail));
    if (existingAdmin.length === 0) {
      console.log("Creating admin user...");
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      await db.insert(usersTable).values({
        email: adminEmail,
        passwordHash: hashedPassword,
        name: "Figure 8 Admin",
        isAdmin: true,
      });
      console.log("Admin user created.");
    } else {
      console.log("Admin user already exists, skipping");
    }
  }

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
