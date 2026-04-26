import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import productsRouter from "./products";
import cartRouter from "./cart";
import savedCartRouter from "./saved-cart";
import wishlistRouter from "./wishlist";
import ordersRouter from "./orders";
import emailRouter from "./email";
import uploadRouter from "./upload";
import stripeRouter from "./stripe";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(productsRouter);
router.use(cartRouter);
router.use(savedCartRouter);
router.use(wishlistRouter);
router.use(ordersRouter);
router.use(emailRouter);
router.use(uploadRouter);
router.use(stripeRouter);
router.use(adminRouter);

export default router;
