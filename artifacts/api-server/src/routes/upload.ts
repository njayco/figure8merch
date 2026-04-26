import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAdmin, type AuthRequest } from "../middlewares/auth";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const router: IRouter = Router();

router.use("/uploads", (req, res, next) => {
  const filePath = path.join(UPLOADS_DIR, path.basename(req.path));
  res.sendFile(filePath, (err) => {
    if (err) next();
  });
});

router.post(
  "/upload/image",
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("image")(req, res, (err: unknown) => {
      if (err) {
        const message =
          err instanceof multer.MulterError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Upload failed";
        res.status(400).json({ error: message });
        return;
      }
      next();
    });
  },
  (req: AuthRequest, res): void => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const url = `/api/uploads/${req.file.filename}`;
    res.json({ url });
  }
);

export default router;
