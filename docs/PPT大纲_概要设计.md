# GeoguessrEX 概要设计 —— PPT 大纲

> 汇报时长：15-20 分钟 ｜ 总页数：20-25 页

---

## Slide 1 · 封面
- 项目名称：GeoguessrEX
- 副标题：以图寻游戏为载体的 UGC 社交平台
- 汇报人 / 日期

---

## Slide 2 · 项目背景与整体架构
- 定位：基于地理位置猜谜的社区驱动型社交游戏
- 三层架构：**Vite + React 18** → **Express 4** → **SQLite**
- Monorepo（`apps/web` + `apps/api`），pnpm workspace
- 核心玩法：街景/图片 → 地图标点 → Haversine 距离计分

---

## Slide 3 · 功能模块全景
- 一张模块总览图（之后每章展开一个模块）：
  - 用户认证 / 题库系统 / 游戏引擎 / 单人练习 / PvP 对战 / 大逃杀
  - 每日挑战 / 角色卡牌 / 社交系统 / 经济系统 / 赛季通行证
  - 寻宝游戏 / 管理后台 / 数据库 / API / 前端架构 / 安全

---

## 第1章 · 用户认证模块设计（2 页）

### Slide 4 — 角色与权限
- 四级角色：游客（限 3 局/日）→ 注册用户（全功能）→ 审核员（审题）→ 管理员（全权限）
- 注册：邮箱 + 密码 → PBKDF2（120000 次 SHA-512）+ 随机 salt
- 登录：返回 HMAC-SHA256 Bearer Token，7 天有效

### Slide 5 — 鉴权中间件
- `authMiddleware`：解析 token → 注入 `req.user`
- `adminMiddleware`：`role === 'admin'` 校验
- 前端：`AuthContext` + `ProtectedRoute`，前后端双层拦截

---

## 第2章 · 题库系统模块设计（2 页）

### Slide 6 — 数据模型与上传
- 两级结构：**题库 → 题目**，支持街景模式 + 图片模式
- 街景字段：lat/lng/heading/pitch/fov/panoId（WGS-84）
- 上传方式①：粘贴 Google Maps URL → 自动解析坐标
- 上传方式②：手动输入坐标 + 上传图片（≤10MB）

### Slide 7 — 审核状态机
```
pending → 审核员认领 → 查验（坐标/图片/合规）
  → approved（进入公共题库）
  → rejected（通知用户 → 修改 → 重提至 pending）
```

---

## 第3章 · 游戏核心引擎模块设计（1 页）

### Slide 8 — 评分算法与坐标转换
- **评分**：`score = max(0, round(5000 × e^(-distanceKm / 2000)))`
  - 0km→5000 分 | 500km→3894 分 | 2000km→1840 分
- **坐标管线**：题库 WGS-84 → 前端 GCJ-02（地图合规）→ 用户标点 → 提交前转回 WGS-84 → 后端 Haversine 计算
- 境外坐标透传不转换

---

## 第4章 · 单人练习模块设计（1 页）

### Slide 9 — 游戏流程
```
选择题库 → 展示街景/图片 → 地图标记猜测点 → 提交
→ 后端计算距离+分数 → 前端双标记地图 + 结算面板 → 下一题
```
- 可选 3/5/10 题，无时间限制
- 结算：总分、平均距离、最佳单题

---

## 第5章 · PvP 对战模块设计（2 页）

### Slide 10 — 对战流程
```
A 创建房间(生成房间码) → B 加入 → 双方选角色+卡牌(30s)
→ 多轮答题 → 每轮公布得分 → 总分高者胜
```
- 房间状态机：waiting → ready → selecting → playing → finished

### Slide 11 — 技能与卡牌交互
- 被动技能全程生效（如 Gambler 分数波动）
- 主动技能 1 次/局，手动触发
- 卡牌每轮最多用 1 张，传说卡使用后永久消耗

---

## 第6章 · 大逃杀模块设计（1 页）

### Slide 12 — 淘汰机制
- 最多 8 人，同题竞技 → 每轮最低分淘汰
- Guardian 被动：首次被淘汰时免疫一次 → 最后存活者获胜
- 数据表：`br_rooms` + `br_players`，与 PvP 共享角色/卡牌

---

## 第7章 · 每日挑战与国家连胜模块设计（1 页）

### Slide 13 — 两种轻量模式
- **每日挑战**：全服统一 3 题，签到打卡 + 连续奖励（`daily_challenges` / `check_ins`）
- **国家连胜**：只判国家不判坐标，猜对继续猜错归零，按最高连胜排行（`country_streaks`）

---

## 第8章 · 角色卡牌模块设计（1 页）

### Slide 14 — 6 角色 + 10 卡牌
| 角色 | 稀有度 | 被动 | 主动 |
|---|---|---|---|
| Explorer | 普通 | 距离偏移提示 | 额外积分 |
| Hunter | 普通 | 缩小范围 | 精准定位 |
| Seer | 稀有 | 显示区域轮廓 | 去干扰项 |
| Swift | 普通 | 减少超时惩罚 | 延时 |
| Guardian | 稀有 | BR 免死一次 | 护盾 |
| Gambler | 史诗 | 分数波动 | 双倍/归零 |

- 10 张卡牌（4 普通 / 3 稀有 / 2 史诗 / 1 传说），加权随机抽取
- 传说卡"The Chosen One"满分 5000，使用后永久消耗

---

## 第9章 · 社交系统模块设计（1 页）

### Slide 15 — 好友 + 社区 + 互动
- **好友**：搜索 → 申请 → 同意 → 双向关注（`follows`）
- **社区**：分享战绩 / 失物招领 / 寻人 / 公告，支持图片上传
- **互动**：评论（嵌套回复）+ 点赞（toggle）+ 单向关注（时间线）

---

## 第10章 · 经济系统模块设计（1 页）

### Slide 16 — 钱包 + 市场 + 悬赏
- **钱包**：虚拟币余额，交易流水表 `coin_transactions`（充值/提现为模拟环境）
- **题库市场**：上架出售 → 买家购买 → 平台抽 20%，卖家收 80%
- **悬赏**：创建者设奖金池（预扣）→ 参与者提交 → 胜者领取（平台不抽成）

---

## 第11章 · 赛季通行证与队伍模块设计（1 页）

### Slide 17 — 留存与社交裂变
- **赛季**：月度 20 级战令，XP 来自对局/挑战/互动，奖励金币/卡牌/角色/头像框
- **等级**：15 级用户成长，XP 递增，影响角色槽位和卡组容量
- **队伍**：创建 → 邀请 → 队伍排行榜（`teams` / `team_members`）

---

## 第12章 · 管理后台模块设计（1 页）

### Slide 18 — 审核与治理
- 统一审核表 `reviews`：题库 + 社区帖子 + 悬赏 + 寻宝游戏
- 审核流：待审 → 认领 → 查验 → 通过/驳回 → 通知
- 管理员：任命审核员、系统参数配置（限时/赛季/费率）、数据看板

---

## 第13章 · 数据库结构设计（1 页）

### Slide 19 — ER 关系与设计决策
```
users ──┬── question_banks ── questions
        ├── wallets ── coin_transactions
        ├── pvp_rooms / br_rooms / br_players
        ├── comments / likes / follows
        ├── teams / team_members
        ├── bounties / bounty_submissions
        ├── daily_challenges / check_ins / season_pass
        ├── treasure_games / location_tasks / game_registrations
        └── notifications / reviews
```
- SQLite + better-sqlite3，无 ORM，直接 SQL
- 27+ 张表，`migrate*()` 渐进演进

---

## 第14章 · API 接口设计（1 页）

### Slide 20 — 17 个路由模块
| 模块 | 端点 | 职责 |
|---|---|---|
| auth | `/api/auth` | 注册/登录/me |
| questions | `/api/questions` | 题库/题目 CRUD |
| submit | `/api/submit` | 答案提交+评分 |
| game-modes | `/api/game-modes` | PvP/BR/国家连胜 |
| social | `/api/social` | 评论/点赞/关注 |
| wallet | `/api/wallet` | 余额/充值/提现 |
| marketplace | `/api/marketplace` | 题库买卖 |
| bounties | `/api/bounties` | 悬赏系统 |
| season | `/api/season` | 赛季战令 |
| leaderboard | `/api/leaderboard` | 排行榜 |
| 其他 | community/teams/notifications/reviews/games/uploads | 社区/队伍/通知/审核/寻宝/上传 |

- 架构：Routes（校验+权限）→ Services（业务逻辑）→ Database

---

## 第15章 · 前端架构设计（1 页）

### Slide 21 — 路由与组件
- 24 个页面：`/login → / → /game/:id → /pvp → /br → /daily → /bounties → /community → /profile → /leaderboard → /marketplace → /teams → /season → /admin/reviews ...`
- 组件分层：地图（GuessMap/ResultMap/StreetView）→ 游戏（ResultPanel/BountyCard）→ 社交（CommentSection/PostCard）→ 通用（NavBar/ProtectedRoute/AuthContext）
- 状态管理：`AuthContext` 全局登录态 + `api.js` 统一 fetch 封装

---

## 第16章 · 安全设计（1 页）

### Slide 22 — 安全措施
| 层面 | 措施 |
|---|---|
| 密码 | PBKDF2 120000 次 + SHA-512 + 随机 16 字节 salt |
| Token | HMAC-SHA256 签名，7 天过期，AUTH_SECRET 密钥 |
| 管理员 | ADMIN_REGISTER_CODE 环境变量控制入口 |
| 权限 | auth → admin 中间件分层 |
| 输入 | 前端表单 + 后端路由双重校验 |
| 上传 | 限制 JPG/PNG/WebP，≤10MB |

---

## Slide 23 · 总结与展望
- **现状**：8 大功能模块、27+ 表、17 路由、24 页面、覆盖 PRD v0.1-v0.5
- **后续**：对象存储迁移 / 测试体系 / TS 迁移 / CI-CD / 移动端

---

## 附录：PPT 制作建议
- 每模块 1 页核心 slide，复杂模块（认证/PvP/经济）可拆 2 页
- 多用架构图和流程图，少放大段文字
- 配色统一深色主题，代码用等宽字体
