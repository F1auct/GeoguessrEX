import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerQuestionRoutes } from "./routes/questions.js";
import { registerSubmitRoute } from "./routes/submit.js";
import { registerUploadRoutes } from "./routes/uploads.js";
import { initDatabase } from "./services/database.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiRoot = path.resolve(__dirname, "..");

initDatabase();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(apiRoot, "uploads")));

registerHealthRoute(app);
registerAuthRoutes(app);
registerUploadRoutes(app);
registerQuestionRoutes(app);
registerSubmitRoute(app);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
