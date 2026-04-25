import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const checkoutSnapshotsTable = pgTable("checkout_snapshots", {
  sessionId: text("session_id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  shippingAddress: text("shipping_address").notNull().default(""),
  items: text("items").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
