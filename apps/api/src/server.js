import express from "express";
import cors from "cors";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerQuestionRoutes } from "./routes/questions.js";
import { registerSubmitRoute } from "./routes/submit.js";

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json());

registerHealthRoute(app);
registerAuthRoutes(app);
registerQuestionRoutes(app);
registerSubmitRoute(app);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
