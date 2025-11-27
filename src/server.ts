import "dotenv/config";
import express from "express";
import cors from "cors";
import contactRouter from "./routes/contact";
import careersRouter from "./routes/careers";

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost",
      process.env.FRONTEND_ORIGIN || "",
    ].filter(Boolean),
  })
);

app.use(express.json());

app.use("/api", contactRouter);
app.use("/api", careersRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// 👇 importante para Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
