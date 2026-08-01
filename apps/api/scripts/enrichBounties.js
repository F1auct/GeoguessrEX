// 一次性脚本：为现有数据库里的悬赏补上目标坐标 + 线索占位图
// 用法：node scripts/enrichBounties.js
// 说明：已存在的 12 条种子悬赏 question_data 为 '{}'（无坐标无图），
//       此脚本按标题匹配更新为 { lat, lng, mediaList }。用户自建悬赏不受影响。
import path from "path";
import { fileURLToPath } from "url";
import { db, initDatabase } from "../src/services/database.js";
import { bountyDefs, generatePlaceholderImages, placeholderUrl } from "./bountySeedData.js";

initDatabase();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, "../uploads/questions");

generatePlaceholderImages(uploadsDir);

const findBounty = db.prepare("SELECT id FROM bounties WHERE title = ?");
const updateBounty = db.prepare("UPDATE bounties SET question_data = ? WHERE id = ?");

let updated = 0;
const missing = [];

bountyDefs.forEach((bd, i) => {
  const row = findBounty.get(bd.title);
  const mediaList = [{ url: placeholderUrl(i), type: "image", name: bd.title }];
  const questionData = JSON.stringify({ lat: bd.lat, lng: bd.lng, mediaList });
  if (row) {
    updateBounty.run(questionData, row.id);
    updated++;
    console.log(`Updated: ${bd.title} -> (${bd.lat}, ${bd.lng})`);
  } else {
    missing.push(bd.title);
  }
});

console.log(`\nDone. 更新 ${updated} 条悬赏。未找到：${missing.length ? missing.join("、") : "无"}`);
