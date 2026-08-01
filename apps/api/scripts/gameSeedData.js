// 藏宝/推理游戏种子数据：标题 + 区域 + 占位图
// 供 seed.js 使用；现有库由 downloadGameImages.js + 更新脚本写入真实图片。
import fs from "fs";
import path from "path";

export const gameDefs = [
  { title: "武大樱花季寻宝", region: "湖北武汉" },
  { title: "西湖十景打卡挑战", region: "浙江杭州" },
  { title: "故宫秘境探索", region: "北京" },
  { title: "外滩夜景追踪", region: "上海" },
  { title: "鼓浪屿海岛探险", region: "福建厦门" },
  { title: "宽窄巷子美食之旅", region: "四川成都" },
  { title: "珠江新城摩天楼定位", region: "广东广州" }
];

export function gameImageUrl(index) {
  return `/uploads/questions/game-${String(index + 1).padStart(2, "0")}.svg`;
}

function buildSvg(title, region) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#244c47"/>
      <stop offset="55%" stop-color="#3a6b5c"/>
      <stop offset="100%" stop-color="#b44d28"/>
    </linearGradient>
  </defs>
  <rect width="960" height="640" fill="url(#bg)"/>
  <circle cx="760" cy="120" r="64" fill="#fbf6ee" opacity="0.85"/>
  <rect y="440" width="960" height="200" fill="#131a1e" opacity="0.35"/>
  <text x="480" y="300" text-anchor="middle" font-family="sans-serif" font-size="38" font-weight="700" fill="#fbf6ee">${title}</text>
  <text x="480" y="356" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#ebe4d6">${region || ""} · 占位图</text>
</svg>
`;
}

// 全新安装时生成 SVG 占位图（与真实图片 game-XX.jpg 互不冲突）
export function generateGamePlaceholderImages(uploadsDir) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  return gameDefs.map((gd, i) => {
    const file = `game-${String(i + 1).padStart(2, "0")}.svg`;
    const target = path.join(uploadsDir, file);
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, buildSvg(gd.title, gd.region), "utf8");
      console.log("Generated game placeholder:", file);
    }
    return gameImageUrl(i);
  });
}
