// Seed script: populate database with demo data
// Run: node scripts/seed.js

import { db, initDatabase } from "../src/services/database.js";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { bountyDefs, generatePlaceholderImages, placeholderUrl } from "./bountySeedData.js";
import { gameDefs, generateGamePlaceholderImages, gameImageUrl } from "./gameSeedData.js";

initDatabase();

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var uploadsDir = path.resolve(__dirname, "../uploads/questions");

var now = new Date().toISOString();
var uuid = function() { return crypto.randomUUID(); };

// helpers

function hashPassword(password) {
  var salt = crypto.randomBytes(16).toString("hex");
  var hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return { hash: hash, salt: salt, iterations: 120000, keyLength: 64, digest: "sha512" };
}

function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// weighted random pick
function weightedIndex(weights) {
  var total = weights.reduce(function(a, b) { return a + b; }, 0);
  var r = Math.random() * total;
  for (var i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

// check if already seeded
var existingUsers = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
if (existingUsers > 5) {
  console.log("Already seeded (" + existingUsers + " users). Skipping.");
  process.exit(0);
}

// users

var pwd = hashPassword("password123");

var userDefs = [
  { username: "SkyWalker",   role: "admin", xp: 14200, level: 15, coins: 8500,  rank_tier: "diamond",  rank_stars: 4, peak: 1850, weight: 10 },
  { username: "GeoHunter",   xp: 11800, level: 12, coins: 6200,  rank_tier: "diamond",  rank_stars: 2, peak: 1720, weight: 10 },
  { username: "MapExplorer", xp: 9600,  level: 10, coins: 4800,  rank_tier: "platinum", rank_stars: 5, peak: 1680, weight: 10 },
  { username: "StreetViewPro", xp: 7200, level: 8,  coins: 3200, rank_tier: "platinum", rank_stars: 3, peak: 1550, weight: 6 },
  { username: "AtlasNomad",    xp: 5800, level: 7,  coins: 2400, rank_tier: "gold",     rank_stars: 5, peak: 1480, weight: 6 },
  { username: "LatLongMaster", xp: 4900, level: 6,  coins: 1800, rank_tier: "gold",     rank_stars: 3, peak: 1420, weight: 6 },
  { username: "ChinaMapper",   xp: 4100, level: 5,  coins: 1500, rank_tier: "gold",     rank_stars: 1, peak: 1360, weight: 6 },
  { username: "GlobeTrotter",  xp: 2800, level: 4,  coins: 900,  rank_tier: "silver",   rank_stars: 5, peak: 1280, weight: 3 },
  { username: "PinPointer",    xp: 1800, level: 3,  coins: 550,  rank_tier: "silver",   rank_stars: 3, peak: 1200, weight: 3 },
  { username: "CompassRose",   xp: 1200, level: 3,  coins: 320,  rank_tier: "silver",   rank_stars: 1, peak: 1150, weight: 3 },
  { username: "PixelHunter",   xp: 800,  level: 2,  coins: 200,  rank_tier: "bronze",   rank_stars: 4, peak: 1100, weight: 3 },
  { username: "WaypointX",     xp: 450,  level: 2,  coins: 120,  rank_tier: "bronze",   rank_stars: 2, peak: 1050, weight: 1 },
  { username: "PixelTraveler", xp: 250,  level: 1,  coins: 60,   rank_tier: "bronze",   rank_stars: 0, peak: 1020, weight: 1 },
  { username: "CityRover",     xp: 150,  level: 1,  coins: 35,   rank_tier: "bronze",   rank_stars: 0, peak: 1000, weight: 1 },
  { username: "NomadLens",     xp: 80,   level: 1,  coins: 20,   rank_tier: "bronze",   rank_stars: 0, peak: 1000, weight: 1 },
];

var weights = userDefs.map(function(u) { return u.weight; });
var userIds = [];

var insertUser = db.prepare(
  "INSERT INTO users (id, username, username_key, email, email_key, role, xp, level, rank_tier, rank_stars, peak_score, password_hash, password_salt, password_iterations, password_key_length, password_digest, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);
var insertWallet = db.prepare("INSERT OR IGNORE INTO wallets (user_id, balance_coin, created_at, updated_at) VALUES (?, ?, ?, ?)");

for (var i = 0; i < userDefs.length; i++) {
  var u = userDefs[i];
  var id = uuid();
  userIds.push(id);
  var email = u.username.toLowerCase() + "@example.com";
  insertUser.run(
    id, u.username, u.username.toLowerCase(), email, email.toLowerCase(),
    u.role || "user", u.xp, u.level, u.rank_tier, u.rank_stars, u.peak,
    pwd.hash, pwd.salt, pwd.iterations, pwd.keyLength, pwd.digest,
    daysAgo(randInt(1, 90))
  );
  insertWallet.run(id, u.coins, now, now);
}

var adminId = userIds[0];

function wUser() { return weightedIndex(weights); }
function wUserTop(skew) {
  skew = skew || 0.5;
  return Math.random() < skew ? randInt(0, 2) : wUser();
}

console.log("Created " + userDefs.length + " users");

// teams

var insertTeam = db.prepare("INSERT INTO teams (id, name, description, owner_id, created_at) VALUES (?, ?, ?, ?, ?)");
var insertMember = db.prepare("INSERT OR IGNORE INTO team_members (id, team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)");

var teams = [
  { name: "中国地图联盟", desc: "专注中国地理，从长城到南海，一起探索祖国的大好河山。", owner: 0, members: [0, 2, 6, 11, 13] },
  { name: "Global Explorers", desc: "环球旅行爱好者，足迹遍布七大洲。", owner: 1, members: [1, 3, 5, 7, 12] },
  { name: "街景猎人公会", desc: "以Street View为猎场，精准定位是我们的信仰。", owner: 3, members: [3, 4, 9, 14] },
  { name: "新手训练营", desc: "欢迎所有新加入的玩家，一起练习一起进步。", owner: 10, members: [10, 11, 12, 13, 14] },
  { name: "巅峰竞技场", desc: "排位赛和巅峰赛高手聚集地，只收Gold及以上段位。", owner: 0, members: [0, 1, 2, 3, 4] },
];

for (var ti = 0; ti < teams.length; ti++) {
  var t = teams[ti];
  var tid = uuid();
  insertTeam.run(tid, t.name, t.desc, userIds[t.owner], daysAgo(randInt(5, 40)));
  for (var mi = 0; mi < t.members.length; mi++) {
    var mIdx = t.members[mi];
    insertMember.run(uuid(), tid, userIds[mIdx], mIdx === t.owner ? "owner" : "member", daysAgo(randInt(1, 35)));
  }
}
console.log("Created " + teams.length + " teams");

// community posts

var insertPost = db.prepare(
  "INSERT INTO community_posts (id, author_id, title, content, category, region, contact_info, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?)"
);

var posts = [
  { author: 0, title: "高德地图VS腾讯地图坐标偏移对比", content: "做了一个详细的测试，列出各大城市在两个地图平台上的GCJ-02偏移差异。对做题库的朋友应该有帮助。附上了具体数据和换算方法。", category: "other", region: "" },
  { author: 1, title: "北京老胡同摄影集", content: "用街景模式走遍了南锣鼓巷、什刹海周边的每一条胡同。这些照片记录了正在消失的老北京生活，分享给大家。每条胡同都标注了最佳拍摄角度。", category: "other", region: "北京" },
  { author: 2, title: "成都街头美食地图", content: "花了三个周末走遍成都大街小巷，整理了一份地道美食坐标合集，从春熙路到玉林路，每个点位都经过实测。欢迎补充！", category: "other", region: "四川成都" },
  { author: 3, title: "西安古城墙骑行路线分享", content: "绕着明城墙骑了一圈，在每个城门拍了360度街景。这条路线适合骑行也适合做题库素材，附坐标。全程约14公里。", category: "other", region: "陕西西安" },
  { author: 4, title: "求助：寻找南京玄武区走失老人", content: "家中老人于三天前在玄武湖公园附近走失，身高约170cm，白发，穿深蓝色夹克。有线索请联系我，万分感谢！", category: "missing_person", region: "江苏南京" },
  { author: 5, title: "西湖周边失踪的背包", content: "上周六在断桥附近遗失一个黑色双肩包，内有重要证件和一台银色笔记本。拾到者请联系我，重谢！", category: "lost_item", region: "浙江杭州" },
  { author: 6, title: "青岛海边发现一串钥匙", content: "在栈桥附近沙滩上捡到一串钥匙，共5把，有一个蓝色门禁卡。失主看到可以描述一下钥匙链样式来认领。", category: "found_item", region: "山东青岛" },
  { author: 7, title: "校园卡招领：张三", content: "在武汉大学樱花大道捡到一张校园卡，姓名张三，学号2021开头。请失主或认识的同学联系我。", category: "found_item", region: "湖北武汉" },
  { author: 8, title: "请大家帮忙找一只猫", content: "白色长毛猫，蓝眼睛，戴红色项圈，在深圳南山区科技园附近走失。有看到的请私信我，必有酬谢！", category: "lost_item", region: "广东深圳" },
  { author: 0, title: "题库制作经验分享", content: "做了将近200道题了，总结一下经验：1) 选有明显地标的位置 2) 注意光照角度 3) 避免纯野外。希望对大家有帮助。", category: "other", region: "" },
  { author: 1, title: "排位赛上分心得", content: "从Bronze一路打到Diamond，最大的感悟是：不要急着猜，先看植被类型、车牌、路标文字，这些比建筑风格更可靠。", category: "other", region: "" },
  { author: 5, title: "新人报到+一点心得", content: "刚玩了几天，从开始的几千公里误差到现在偶尔能猜中100km以内，进步明显。感谢社区各位大佬分享的技巧帖！", category: "announcement", region: "" },
  { author: 4, title: "广州塔周边有流浪猫群", content: "在广州塔下面的花城广场发现了一群流浪猫，大概十几只，有好心人在定期投喂。希望有动物救助组织能关注一下。", category: "announcement", region: "广东广州" },
  { author: 11, title: "大家好我是新来的", content: "被朋友安利了这个游戏，昨天刚注册，目前最好成绩是距离目标点32公里。有没有新手攻略推荐？", category: "announcement", region: "" },
];

for (var pi = 0; pi < posts.length; pi++) {
  var p = posts[pi];
  insertPost.run(uuid(), userIds[p.author], p.title, p.content, p.category, p.region, "", daysAgo(randInt(0, 30)));
}
console.log("Created " + posts.length + " community posts");

// bounties

var insertBounty = db.prepare(
  "INSERT INTO bounties (id, creator_id, title, description, reward_coin, deadline, question_data, status, winner_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);
var insertBountySub = db.prepare(
  "INSERT INTO bounty_submissions (id, bounty_id, user_id, guess_lat, guess_lng, distance_km, score, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
);

generatePlaceholderImages(uploadsDir);

for (var bi = 0; bi < bountyDefs.length; bi++) {
  var bd = bountyDefs[bi];
  var bid = uuid();
  var creator = wUser();
  var isClosed = bi < 8;
  var winner = isClosed ? wUserTop(0.6) : null;
  var mediaList = [{ url: placeholderUrl(bi), type: "image", name: bd.title }];
  var questionData = JSON.stringify({ lat: bd.lat, lng: bd.lng, mediaList });

  insertBounty.run(
    bid, userIds[creator], bd.title,
    "悬赏任务：" + bd.title + "。考验你的地理知识！",
    randInt(50, 500), daysAgo(-randInt(1, 14)),
    questionData,
    isClosed ? "closed" : "active",
    isClosed ? userIds[winner] : null,
    daysAgo(randInt(0, 40))
  );

  var numSubs = randInt(4, 12);
  for (var sj = 0; sj < numSubs; sj++) {
    var uid = wUserTop(0.4);
    var dist = randInt(5, 6000);
    var score = Math.max(0, Math.round(5000 * Math.exp(-dist / 2000)));
    insertBountySub.run(
      uuid(), bid, userIds[uid],
      30 + Math.random() * 15, 105 + Math.random() * 25,
      dist, score, daysAgo(randInt(0, 30))
    );
  }
}
console.log("Created " + bountyDefs.length + " bounties");

// treasure games

var insertGame = db.prepare(
  "INSERT INTO treasure_games (id, creator_id, title, description, game_type, region, status, media_list, created_at, updated_at) VALUES (?, ?, ?, ?, 'treasure_hunt', ?, 'active', ?, ?, ?)"
);
var insertReg = db.prepare(
  "INSERT INTO game_registrations (id, game_id, user_id, player_info, status, created_at) VALUES (?, ?, ?, '{}', 'approved', ?)"
);
var insertGP = db.prepare(
  "INSERT INTO game_progress (id, registration_id, user_id, game_id, current_step, completed_steps, started_at, completed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
);

generateGamePlaceholderImages(uploadsDir);

var regEntries = [];

for (var gi = 0; gi < gameDefs.length; gi++) {
  var g = gameDefs[gi];
  var gid = uuid();
  var gameMedia = [{ url: gameImageUrl(gi), type: "image", name: g.title }];
  insertGame.run(gid, userIds[wUser()], g.title, "在" + g.region + "完成一系列定位任务", g.region, JSON.stringify(gameMedia), now, now);

  var numPlayers = randInt(3, 8);
  for (var j = 0; j < numPlayers; j++) {
    var rid = uuid();
    var uidIdx = wUserTop(0.5);
    insertReg.run(rid, gid, userIds[uidIdx], daysAgo(randInt(1, 25)));
    regEntries.push({ rid: rid, uid: uidIdx, gid: gid });
  }
}

for (var ei = 0; ei < regEntries.length; ei++) {
  var e = regEntries[ei];
  if (Math.random() > 0.7) continue;
  var steps = randInt(1, 6);
  var completedArr = [];
  for (var s = 0; s < steps; s++) completedArr.push(s);
  var completeChance = e.uid <= 2 ? 0.8 : e.uid <= 6 ? 0.5 : 0.2;
  var isCompleted = Math.random() < completeChance;
  insertGP.run(
    uuid(), e.rid, userIds[e.uid], e.gid,
    steps, JSON.stringify(completedArr),
    daysAgo(randInt(5, 35)),
    isCompleted ? daysAgo(randInt(0, 5)) : null,
    now
  );
}
console.log("Created " + gameDefs.length + " treasure games");

// season pass

var seasonRow = db.prepare("SELECT id FROM seasons ORDER BY season_number DESC LIMIT 1").get();
if (seasonRow) {
  var insertSP = db.prepare("INSERT OR IGNORE INTO season_pass (id, user_id, season_id, level, xp) VALUES (?, ?, ?, ?, ?)");
  var PASS_XP = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3300, 4000, 4800, 5700, 6700, 7800, 9000, 10400, 12000, 14000];
  for (var si = 0; si < userIds.length; si++) {
    var maxLvl = si <= 2 ? 15 : si <= 6 ? 10 : si <= 10 ? 6 : 3;
    var level = randInt(1, maxLvl);
    var baseXp = PASS_XP[Math.min(level - 1, PASS_XP.length - 1)] || 0;
    var nextXp = PASS_XP[Math.min(level, PASS_XP.length - 1)] || (baseXp + 500);
    var xp = baseXp + randInt(0, Math.floor(nextXp - baseXp));
    insertSP.run(uuid(), userIds[si], seasonRow.id, level, xp);
  }
  console.log("Created season pass entries");
}

// ranked matches

var insertRanked = db.prepare(
  "INSERT INTO rank_matches (id, winner_id, loser_id, winner_tier_before, winner_stars_before, loser_tier_before, loser_stars_before, winner_stars_change, loser_stars_change, room_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);

for (var ri = 0; ri < 50; ri++) {
  var w = wUserTop(0.55);
  var l = wUserTop(0.3);
  while (l === w) l = wUser();
  insertRanked.run(
    uuid(), userIds[w], userIds[l],
    userDefs[w].rank_tier, randInt(0, 5),
    userDefs[l].rank_tier, randInt(0, 5),
    randInt(1, 3), randInt(0, 2) * -1,
    null,
    daysAgo(randInt(0, 30))
  );
}
console.log("Created 50 ranked matches");

// peak matches

var insertPeak = db.prepare(
  "INSERT INTO peak_matches (id, winner_id, loser_id, winner_score_before, winner_score_after, loser_score_before, loser_score_after, winner_score_change, loser_score_change, season_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);

for (var pi2 = 0; pi2 < 30; pi2++) {
  var pw = wUserTop(0.6);
  var pl = wUserTop(0.3);
  while (pl === pw) pl = wUser();
  var wBefore = userDefs[pw].peak - randInt(0, 100);
  var lBefore = userDefs[pl].peak + randInt(0, 50);
  var change = randInt(8, 25);
  insertPeak.run(
    uuid(), userIds[pw], userIds[pl],
    wBefore, wBefore + change,
    lBefore, lBefore - change,
    change, -change,
    null,
    daysAgo(randInt(0, 21))
  );
}
console.log("Created 30 peak matches");

// country streaks

var insertStreak = db.prepare("INSERT OR IGNORE INTO country_streaks (id, user_id, streak, best_streak, updated_at) VALUES (?, ?, ?, ?, ?)");
for (var ci = 0; ci < userIds.length; ci++) {
  var best = ci <= 2 ? randInt(8, 20) : ci <= 6 ? randInt(4, 12) : randInt(0, 5);
  insertStreak.run(uuid(), userIds[ci], randInt(0, best), best, now);
}
console.log("Created country streaks");

// follows

var insertFollow = db.prepare("INSERT OR IGNORE INTO follows (id, follower_id, following_id, created_at) VALUES (?, ?, ?, ?)");
for (var fi = 0; fi < 40; fi++) {
  var fa = wUser();
  var fb = wUser();
  while (fb === fa) fb = wUser();
  insertFollow.run(uuid(), userIds[fa], userIds[fb], daysAgo(randInt(0, 40)));
}
console.log("Created 40 follows");

// likes

var allPosts = db.prepare("SELECT id FROM community_posts").all();
var insertLike = db.prepare("INSERT OR IGNORE INTO likes (id, target_type, target_id, user_id, created_at) VALUES (?, 'community_post', ?, ?, ?)");

for (var ai = 0; ai < allPosts.length; ai++) {
  var numLikes = randInt(1, 9);
  for (var lj = 0; lj < numLikes; lj++) {
    insertLike.run(uuid(), allPosts[ai].id, userIds[wUser()], daysAgo(randInt(0, 20)));
  }
}
console.log("Created likes");

// comments

var commentTexts = [
  "太好了，收藏了！", "感谢分享，非常有用", "这个位置我去过！", "哈哈太有意思了",
  "请问这个具体在哪里？", "支持！", "学到了学到了", "期待更多内容",
  "楼主辛苦了", "这个系列可以多出几期吗", "Mark一下", "前排围观",
];

var insertComment = db.prepare("INSERT INTO comments (id, target_type, target_id, user_id, content, parent_id, created_at) VALUES (?, 'community_post', ?, ?, ?, NULL, ?)");

for (var api = 0; api < allPosts.length; api++) {
  var numComments = randInt(0, 5);
  for (var cj = 0; cj < numComments; cj++) {
    insertComment.run(uuid(), allPosts[api].id, userIds[wUser()], pick(commentTexts), daysAgo(randInt(0, 14)));
  }
}
console.log("Created comments");

// check-ins

var insertCheckin = db.prepare("INSERT OR IGNORE INTO check_ins (id, user_id, date, streak, created_at) VALUES (?, ?, ?, ?, ?)");
for (var ii = 0; ii < userIds.length; ii++) {
  var streak = ii <= 2 ? randInt(10, 30) : ii <= 6 ? randInt(3, 14) : randInt(0, 5);
  for (var d = 0; d < streak; d++) {
    insertCheckin.run(uuid(), userIds[ii], daysAgo(d).slice(0, 10), streak - d, daysAgo(d));
  }
}
console.log("Created check-in records");

// ── marketplace: question banks for sale ──

var insertBank = db.prepare(
  "INSERT INTO question_banks (id, title, owner_user_id, price, is_listed, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)"
);
var insertQ = db.prepare(
  "INSERT INTO questions (id, bank_id, description, source_type, lat, lng, heading, pitch, fov, pano_id, image_path, created_at, updated_at) VALUES (?, ?, ?, 'street_view', ?, ?, ?, ?, ?, NULL, NULL, ?, ?)"
);
var insertPurchase = db.prepare(
  "INSERT OR IGNORE INTO bank_purchases (id, bank_id, buyer_id, price, created_at) VALUES (?, ?, ?, ?, ?)"
);

var marketBanks = [
  { owner: 0, title: "中国古镇精选合集", price: 200, descs: ["丽江古城四方街", "平遥古城南大街", "凤凰古城沱江边", "周庄双桥", "乌镇西栅"] },
  { owner: 1, title: "全球地标挑战", price: 350, descs: ["埃菲尔铁塔", "自由女神像", "悉尼歌剧院", "大本钟", "泰姬陵", "金字塔"] },
  { owner: 2, title: "日本城市定位集", price: 180, descs: ["东京涩谷十字路口", "大阪道顿堀", "京都清水寺", "札幌钟楼"] },
  { owner: 3, title: "欧洲古城漫步", price: 250, descs: ["布拉格老城广场", "罗马斗兽场", "巴黎圣母院", "维也纳美泉宫", "布达佩斯渔人堡"] },
  { owner: 4, title: "大学校园挑战", price: 120, descs: ["清华大学二校门", "北京大学未名湖", "武汉大学樱花大道", "浙江大学玉泉校区"] },
  { owner: 5, title: "自然奇观系列", price: 300, descs: ["张家界天子山", "九寨沟五花海", "黄山迎客松", "桂林漓江", "青海湖"] },
  { owner: 6, title: "东南亚热带风情", price: 150, descs: ["曼谷大皇宫", "吴哥窟", "新加坡滨海湾", "巴厘岛海神庙"] },
  { owner: 8, title: "新手友好题库", price: 50, descs: ["北京天安门广场", "上海外滩", "广州塔", "成都春熙路"] },
];

var coords = [
  { lat: 26.8667, lng: 100.2333 }, { lat: 37.2019, lng: 112.1762 }, { lat: 27.9500, lng: 109.6000 },
  { lat: 31.1867, lng: 120.9600 }, { lat: 30.7500, lng: 120.4833 }, { lat: 48.8584, lng: 2.2945 },
  { lat: 40.6892, lng: -74.0445 }, { lat: -33.8568, lng: 151.2153 }, { lat: 51.5007, lng: -0.1246 },
  { lat: 27.1750, lng: 78.0422 }, { lat: 29.9792, lng: 31.1342 }, { lat: 35.6595, lng: 139.7004 },
  { lat: 34.6687, lng: 135.5014 }, { lat: 35.0038, lng: 135.7855 }, { lat: 43.0621, lng: 141.3544 },
  { lat: 50.0878, lng: 14.4205 }, { lat: 41.8902, lng: 12.4922 }, { lat: 48.8530, lng: 2.3499 },
  { lat: 48.1849, lng: 16.3125 }, { lat: 47.5020, lng: 19.0340 }, { lat: 40.0000, lng: 116.3260 },
  { lat: 39.9920, lng: 116.3100 }, { lat: 30.5400, lng: 114.3600 }, { lat: 30.2600, lng: 120.1200 },
  { lat: 29.3400, lng: 110.4600 }, { lat: 33.2000, lng: 103.9000 }, { lat: 30.1300, lng: 118.1700 },
  { lat: 25.0300, lng: 110.3000 }, { lat: 36.6300, lng: 100.4700 }, { lat: 13.7500, lng: 100.5000 },
  { lat: 13.4100, lng: 103.8600 }, { lat: 1.2900, lng: 103.8500 }, { lat: -8.7200, lng: 115.1700 },
  { lat: 39.9050, lng: 116.3970 }, { lat: 31.2390, lng: 121.4900 }, { lat: 23.1300, lng: 113.2600 },
  { lat: 30.6600, lng: 104.0630 },
];

var coordIdx = 0;
for (var mbi = 0; mbi < marketBanks.length; mbi++) {
  var mb = marketBanks[mbi];
  var bankId = uuid();
  var createdAt = daysAgo(randInt(3, 30));
  insertBank.run(bankId, mb.title, userIds[mb.owner], mb.price, createdAt, createdAt);

  // questions
  for (var qi = 0; qi < mb.descs.length; qi++) {
    var c = coords[coordIdx % coords.length];
    coordIdx++;
    insertQ.run(uuid(), bankId, mb.descs[qi], c.lat, c.lng, randInt(0, 360), randInt(-10, 20), randInt(60, 120), createdAt, createdAt);
  }

  // purchases from other users
  var numPurchases = mb.owner <= 2 ? randInt(3, 6) : mb.owner <= 6 ? randInt(1, 3) : randInt(0, 1);
  for (var pj = 0; pj < numPurchases; pj++) {
    var buyer = wUser();
    while (buyer === mb.owner) buyer = wUser();
    insertPurchase.run(uuid(), bankId, userIds[buyer], mb.price, daysAgo(randInt(0, 20)));
  }
}
console.log("Created " + marketBanks.length + " marketplace banks with questions");

console.log("\nDone! 15 users, password: password123");
console.log("Top accounts: SkyWalker(admin), GeoHunter, MapExplorer");
