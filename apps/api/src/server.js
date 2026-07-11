import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerBadgeRoutes } from "./routes/badges.js";
import { registerDailyRoutes } from "./routes/daily.js";
import { registerGameModeRoutes } from "./routes/gameModes.js";
import { registerBountyRoutes } from "./routes/bounties.js";
import { registerCommunityRoutes } from "./routes/community.js";
import { registerGameRoutes } from "./routes/games.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerLeaderboardRoutes } from "./routes/leaderboard.js";
import { registerMarketplaceRoutes } from "./routes/marketplace.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { registerTeamRoutes } from "./routes/teams.js";
import { registerQuestionRoutes } from "./routes/questions.js";
import { registerReviewRoutes } from "./routes/reviews.js";
import { registerSeasonRoutes } from "./routes/season.js";
import { registerSocialRoutes } from "./routes/social.js";
import { registerSubmitRoute } from "./routes/submit.js";
import { registerUploadRoutes } from "./routes/uploads.js";
import { registerWalletRoutes } from "./routes/wallet.js";
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
registerLeaderboardRoutes(app);
registerNotificationRoutes(app);
registerAuthRoutes(app);
registerBadgeRoutes(app);
registerDailyRoutes(app);
registerGameModeRoutes(app);
registerWalletRoutes(app);
registerBountyRoutes(app);
registerGameRoutes(app);
registerCommunityRoutes(app);
registerReviewRoutes(app);
registerSeasonRoutes(app);
registerMarketplaceRoutes(app);
registerTeamRoutes(app);
registerSocialRoutes(app);
registerUploadRoutes(app);
registerQuestionRoutes(app);
registerSubmitRoute(app);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
