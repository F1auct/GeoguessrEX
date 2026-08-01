// 一次性脚本：为 7 个藏宝游戏下载对应内容的真实图片（Bing 检索 + 标题关键词过滤）
// 用法：node scripts/downloadGameImages.js
// 说明：下载到 apps/api/uploads/questions/game-01~07.jpg，不自动改数据库。
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, "../uploads/questions");
fs.mkdirSync(dir, { recursive: true });

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 每个游戏：检索词 + 标题必须包含的关键词（titleNeed）
const GAMES = [
  { file: "game-01.jpg", query: "武汉大学樱花城堡", titleNeed: /樱花|武大|武汉大学/ },
  { file: "game-02.jpg", query: "杭州西湖 断桥", titleNeed: /西湖/ },
  { file: "game-03.jpg", query: "北京故宫 太和殿", titleNeed: /故宫/ },
  { file: "game-04.jpg", query: "上海外滩夜景", titleNeed: /外滩/ },
  { file: "game-05.jpg", query: "厦门鼓浪屿", titleNeed: /鼓浪屿/ },
  { file: "game-06.jpg", query: "成都宽窄巷子", titleNeed: /宽窄巷子/ },
  { file: "game-07.jpg", query: "广州珠江新城", titleNeed: /珠江新城/ }
];

const BLOCK = /alicdn\.com|9k9k\.com|360buyimg|taobaocdn|tukuppt|renrendoc/;

async function search(query) {
  const url = `https://cn.bing.com/images/async?q=${encodeURIComponent(query)}&first=1&count=25&mmasync=1`;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Referer": "https://cn.bing.com/images/search" } });
  const html = await res.text();
  const out = [];
  const re = /m="(\{.*?\})"/g;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    try {
      const o = JSON.parse(raw);
      if (o.murl && /^https?:\/\//.test(o.murl) && !BLOCK.test(o.murl)) {
        out.push({ url: o.murl, title: o.t || "" });
      }
    } catch (e) { /* skip */ }
  }
  return out;
}

function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

async function dl(url, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA, "Referer": "https://cn.bing.com/" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 20000 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error("bad jpeg");
      return buf;
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(1000);
    }
  }
}

(async () => {
  for (const g of GAMES) {
    let done = false;
    try {
      const all = await search(g.query);
      // 标题含关键词的优先；否则回退全部候选
      let cands = all.filter((c) => g.titleNeed.test(c.title));
      console.log(`— ${g.file} (${g.query}) 候选 ${all.length}，标题命中 ${cands.length}`);
      if (cands.length === 0) cands = all;
      for (const c of cands.slice(0, 20)) {
        try {
          const buf = await dl(c.url);
          const size = jpegSize(buf);
          if (!size || size.width < 500 || size.height < 300) continue;
          fs.writeFileSync(path.join(dir, g.file), buf);
          console.log(`  OK ${g.file} ${size.width}x${size.height} ${(buf.length / 1024).toFixed(0)}KB\n     标题:${(c.title || "").slice(0, 50)}\n     ${c.url.slice(0, 60)}...`);
          done = true;
          break;
        } catch (e) { /* 下一张 */ }
      }
      if (!done) console.log(`  FAIL ${g.file}`);
    } catch (e) {
      console.log(`  FAIL ${g.file} (${e.message})`);
    }
    await sleep(800);
  }
  console.log("\n完成。");
})();
