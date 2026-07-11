import { db } from "./database.js";

const BADGE_DEFS = [
  { id: "newcomer", name: "初出茅庐", icon: "🌱", rarity: "普通", desc: "注册成为GeoGuessrEX用户" },
  { id: "first_answer", name: "首次答题", icon: "🎯", rarity: "普通", desc: "提交第一次答案" },
  { id: "first_bounty", name: "赏金猎人", icon: "💰", rarity: "稀有", desc: "赢得第一次悬赏" },
  { id: "bounty_master", name: "百发百中", icon: "🏹", rarity: "史诗", desc: "赢得5次悬赏" },
  { id: "first_hunt", name: "探险家", icon: "🗺️", rarity: "稀有", desc: "完成1次藏宝游戏" },
  { id: "hunt_master", name: "冒险王", icon: "👑", rarity: "史诗", desc: "完成5次藏宝游戏" },
  { id: "poster_5", name: "社区达人", icon: "✍️", rarity: "稀有", desc: "发布5篇社区帖子" },
  { id: "poster_10", name: "沟通桥梁", icon: "🌉", rarity: "史诗", desc: "发布10篇社区帖子" },
  { id: "rich", name: "大富翁", icon: "💎", rarity: "稀有", desc: "金币余额达到1000" },
  { id: "generous", name: "慈善家", icon: "🎁", rarity: "稀有", desc: "发布3次悬赏" },
  { id: "perfect", name: "完美主义者", icon: "⭐", rarity: "史诗", desc: "单次答题得分≥4500" },
  { id: "legend", name: "传说人物", icon: "🔥", rarity: "传说", desc: "集齐所有徽章" }
];

const RARITY_COLORS = {
  "普通": "#9ca3af",
  "稀有": "#244c47",
  "史诗": "#b44d28",
  "传说": "#f59e0b"
};

export function getUserBadges(userId) {
  // 统计用户数据
  const submissions = db.prepare("SELECT COUNT(*) AS c FROM bounty_submissions WHERE user_id = ?").get(userId).c;
  const bountyWins = db.prepare("SELECT COUNT(*) AS c FROM bounties WHERE winner_id = ?").get(userId).c;
  const huntCompletions = db.prepare("SELECT COUNT(*) AS c FROM game_progress WHERE user_id = ? AND completed_at IS NOT NULL").get(userId).c;
  const postCount = db.prepare("SELECT COUNT(*) AS c FROM community_posts WHERE author_id = ? AND status = 'approved'").get(userId).c;
  const wallet = db.prepare("SELECT balance_coin FROM wallets WHERE user_id = ?").get(userId);
  const balance = wallet?.balance_coin || 0;
  const bountiesCreated = db.prepare("SELECT COUNT(*) AS c FROM bounties WHERE creator_id = ?").get(userId).c;
  const bestScore = db.prepare("SELECT MAX(score) AS m FROM bounty_submissions WHERE user_id = ?").get(userId).m || 0;

  const earned = [];

  for (const def of BADGE_DEFS) {
    let ok = false;
    switch (def.id) {
      case "newcomer": ok = true; break;
      case "first_answer": ok = submissions >= 1; break;
      case "first_bounty": ok = bountyWins >= 1; break;
      case "bounty_master": ok = bountyWins >= 5; break;
      case "first_hunt": ok = huntCompletions >= 1; break;
      case "hunt_master": ok = huntCompletions >= 5; break;
      case "poster_5": ok = postCount >= 5; break;
      case "poster_10": ok = postCount >= 10; break;
      case "rich": ok = balance >= 1000; break;
      case "generous": ok = bountiesCreated >= 3; break;
      case "perfect": ok = bestScore >= 4500; break;
      case "legend": ok = earned.length >= BADGE_DEFS.length - 2; break; // 除传说自己和另一个
      default: break;
    }
    if (ok && def.id !== "legend") earned.push({ ...def, color: RARITY_COLORS[def.rarity] });
  }

  // 检查传说
  if (earned.length >= BADGE_DEFS.length - 2) {
    const legend = BADGE_DEFS.find((d) => d.id === "legend");
    earned.push({ ...legend, color: RARITY_COLORS[legend.rarity] });
  }

  return { badges: earned, total: BADGE_DEFS.length };
}
