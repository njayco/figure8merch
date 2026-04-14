import { Router, type IRouter } from "express";
import { db, emailSignupsTable } from "@workspace/db";
import { EmailSignupBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/email-signup", async (req, res): Promise<void> => {
  const parsed = EmailSignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email } = parsed.data;

  const existing = await db.select().from(emailSignupsTable).where(eq(emailSignupsTable.email, email));
  if (existing.length === 0) {
    await db.insert(emailSignupsTable).values({ email });
  }

  res.json({ message: "Thank you! Your 10% discount code is F8FIRST" });
});

export default router;
