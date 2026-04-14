import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "./logger";

export async function initAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    logger.warn("ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin init");
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, adminEmail));

    if (existing?.isAdmin) {
      logger.info("Admin user already up to date");
      return;
    }

    // Check if there is any admin user with a different email (e.g. old hardcoded one)
    const [anyAdmin] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.isAdmin, true));

    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    if (anyAdmin) {
      await db
        .update(usersTable)
        .set({ email: adminEmail, passwordHash: hashedPassword })
        .where(eq(usersTable.id, anyAdmin.id));
      logger.info("Admin credentials updated");
    } else {
      await db.insert(usersTable).values({
        email: adminEmail,
        passwordHash: hashedPassword,
        name: "Figure 8 Admin",
        isAdmin: true,
      });
      logger.info("Admin user created");
    }
  } catch (err) {
    logger.error({ err }, "Failed to initialize admin user");
  }
}
