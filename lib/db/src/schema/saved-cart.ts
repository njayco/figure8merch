import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const savedCartItemsTable = pgTable(
  "saved_cart_items",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    quantity: integer("quantity").notNull().default(1),
    size: text("size").notNull(),
    color: text("color").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userProductSizeColorUnique: uniqueIndex("saved_cart_items_user_product_size_color_unique").on(
      table.userId,
      table.productId,
      table.size,
      table.color,
    ),
  }),
);

export const insertSavedCartItemSchema = createInsertSchema(savedCartItemsTable).omit({ id: true, createdAt: true });
export type InsertSavedCartItem = z.infer<typeof insertSavedCartItemSchema>;
export type SavedCartItem = typeof savedCartItemsTable.$inferSelect;
