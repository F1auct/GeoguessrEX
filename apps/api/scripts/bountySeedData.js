// 悬赏种子数据：标题 + 目标坐标（WGS-84）+ 占位图
// 供 seed.js 与 enrichBounties.js 共用，保证全新安装与已有库的数据一致。
import fs from "fs";
import path from "path";

export const bountyDefs = [
  { title: "猜猜这是哪个古镇", lat: 31.1149, lng: 120.8494 },     // 周庄古镇
  { title: "雪山之巅在哪里", lat: 27.9881, lng: 86.9250 },        // 珠穆朗玛峰
  { title: "热带海滩定位挑战", lat: 18.202, lng: 109.65 },        // 三亚亚龙湾
  { title: "欧洲古城堡识别", lat: 47.5573, lng: 10.7495 },        // 新天鹅堡
  { title: "沙漠中的绿洲", lat: 40.0859, lng: 94.6666 },          // 敦煌月牙泉
  { title: "港口城市挑战", lat: 31.2397, lng: 121.4998 },         // 上海外滩
  { title: "大学校园定位", lat: 30.5366, lng: 114.3617 },         // 武汉大学
  { title: "火车站识别挑战", lat: 39.8652, lng: 116.3786 },       // 北京南站
  { title: "中国古镇系列之周庄", lat: 31.1149, lng: 120.8494 },   // 周庄双桥
  { title: "日本寺庙定位", lat: 34.9949, lng: 135.785 },          // 京都清水寺
  { title: "南美雨林探秘", lat: -3.119, lng: -60.0217 },          // 亚马逊玛瑙斯
  { title: "北欧峡湾识别", lat: 62.1041, lng: 7.1464 }            // 盖朗厄尔峡湾
];

export function placeholderFileName(index) {
  return `bounty-${String(index + 1).padStart(2, "0")}.svg`;
}

export function placeholderUrl(index) {
  return `/uploads/questions/${placeholderFileName(index)}`;
}

function buildSvg(title, lat, lng) {
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
  <text x="480" y="356" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#ebe4d6">占位线索图 · 发布后可替换</text>
  <text x="480" y="560" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#ebe4d6" opacity="0.85">${lat.toFixed(4)}, ${lng.toFixed(4)}</text>
</svg>
`;
}

// 生成占位图到指定目录（不存在才写），返回占位图 url 列表
export function generatePlaceholderImages(uploadsDir) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  return bountyDefs.map((bd, i) => {
    const file = placeholderFileName(i);
    const target = path.join(uploadsDir, file);
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, buildSvg(bd.title, bd.lat, bd.lng), "utf8");
      console.log("Generated placeholder:", file);
    }
    return placeholderUrl(i);
  });
}
