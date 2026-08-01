---
tags:
  - prd
  - 需求文档
  - geoguessrex
  - 图寻
aliases:
  - PRD v1.0
  - 需求分析说明书
  - 产品需求文档
cssclass: prd
created: 2026-07-29
version: v1.0.0
status: 已实现
---

# GeoguessrEX 产品需求文档 (PRD)

> [!NOTE] 文档元信息
> 版本：v1.0.0 ｜ 日期：2026-07-29 ｜ 状态：已实现

---

## 1. 项目背景

### 1.1 产品定位

GeoguessrEX 是一款**以地理图寻为核心玩法、融合竞技与社交的游戏平台**。用户在 Google 街景或上传图片中观察场景，判断地理位置，在高德地图上标记猜测点，系统根据 Haversine 距离公式计算得分。平台围绕图寻核心玩法，构建了排位竞技、社交互动、UGC 题库、赛季通行证等完整游戏生态。

### 1.2 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | Vite 7 + React 18 + React Router 7 | 用户端 Web 应用 |
| 地图 | 高德 AMap JSAPI 2.0 + Google Maps Embed API + Leaflet | 猜点/结果地图 + 街景展示 |
| 后端 | Express 4 (Node.js) | RESTful API |
| 数据库 | SQLite (better-sqlite3) | 同步绑定，零配置 |
| 认证 | PBKDF2 (SHA-512, 120k iterations) + HMAC-SHA256 Bearer Token | 7 天有效期 |
| 评分 | Haversine 距离公式 + 指数衰减 | 满分 5000，衰减常数 2000km |
| 坐标 | WGS-84 (后端) + 前端 WGS-84 ↔ GCJ-02 互转 | 国标合规 |
| 包管理 | pnpm workspace (monorepo) | `apps/web` + `apps/api` |

---

## 2. 用户角色

| 角色 | 权限范围 | 特征 |
|---|---|---|
| **游客** | 浏览社区、排行榜 | 需注册后才能游戏 |
| **注册用户** | 全部玩法功能：图寻挑战、排位、PvP、上传题目、社交 | 核心用户群 |
| **审核员 (MOD)** | 题库审核权限 + 注册用户全部权限 | 可由管理员任命 |
| **管理员** | 管理后台全部权限：题库、用户、系统配置 | 最高权限 |

---

<!-- 📸 截图插入点 1：用例图 → 编译 docs/diagrams/07-用例图.puml，截图后替换此行 -->
> ![系统用例图](../out/docs/diagrams/07-用例图/07-用例图.png)

---

## 3. 功能模块总览

```
GeoguessrEX
├── 3.1 用户系统       注册/登录/个人主页/XP等级
├── 3.2 图寻核心       单人练习/街景+图片双模式/评分算法/坐标转换
├── 3.3 题库系统       题库CRUD/Google Maps URL导入/图片上传/审核流程
├── 3.4 竞技模式
│   ├── 3.4.1 排位赛    7段位升降星/匹配队列/排行榜
│   ├── 3.4.2 巅峰赛    ELO积分制/钻石准入/盲选/限时开放
│   ├── 3.4.3 PvP对战   1v1回合制/房间码/角色卡牌技能
│   └── 3.4.4 大逃杀    多人房间/淘汰制
├── 3.5 特色玩法
│   ├── 3.5.1 环球之旅  预设路线/多站街景/文化笔记/护照印章
│   ├── 3.5.2 每日挑战  每日题目/签到打卡/连胜奖励
│   ├── 3.5.3 国家连击  猜国家模式/连击记录/排行榜
│   └── 3.5.4 悬赏答题  金币悬赏/多人竞猜
├── 3.6 赛季系统       赛季通行证/等级奖励/任务系统(日常/周常/赛季)
├── 3.7 社交系统       好友/关注/评论/点赞/通知
├── 3.8 社区系统       帖子发布(失物/寻物/寻人/公告)/审核/媒体上传
├── 3.9 经济系统       虚拟钱包/金币充值/交易记录
├── 3.10 市场系统      题库买卖/定价/购买记录
├── 3.11 战队系统      创建/加入/成员管理
├── 3.12 角色卡牌系统  角色选择/卡牌技能/使用追踪
├── 3.13 藏宝游戏       GPS打卡/推理闯关/报名审核
├── 3.14 排行榜         全局/周榜/日榜/排位榜/巅峰榜/好友榜
└── 3.15 管理后台      题库审核/用户管理/内容审查
```

<!-- 📸 截图插入点 2：游戏流程图 → 编译 docs/diagrams/08-游戏流程图.puml，截图后替换此行 -->
> ![游戏流程图](../out/docs/diagrams/08-游戏流程图/08-游戏流程图.png)

---

## 4. 功能详细说明

### 4.1 用户系统

#### 4.1.1 注册与登录

| 项 | 说明 |
|---|---|
| 注册方式 | 邮箱 + 用户名 + 密码 |
| 密码安全 | PBKDF2-SHA512 哈希，120,000 次迭代，独立随机盐值 |
| 认证方式 | HMAC-SHA256 Bearer Token，7 天有效期 |
| 角色 | user / mod / admin，注册默认 user |
| 管理注册码 | 环境变量 `ADMIN_REGISTER_CODE` 控制管理员账户创建 |

#### 4.1.2 个人主页

| 区域 | 内容 |
|---|---|
| 头部 | 头像、昵称、等级、注册时间 |
| 数据面板 | 总游戏局数、平均分、XP、段位、巅峰积分 |
| 动态列表 | 用户最近发布的社区动态 |

#### 4.1.3 XP 与等级系统

| 项 | 说明 |
|---|---|
| XP 获取 | 完成游戏、PvP 获胜、每日挑战、悬赏答题、赛季任务等 |
| 等级计算 | XP 累积升级，影响赛季通行证奖励解锁 |
| 展示 | 个人主页、排行榜、对战结算 |

---

### 4.2 图寻核心

#### 4.2.1 单人练习

| 项 | 说明 |
|---|---|
| 题目来源 | 从已通过审核的题库中随机抽取 |
| 题目展示 | Google 街景 iframe 嵌入 或 上传图片展示 |
| 猜点地图 | 高德 AMap，点击/拖拽放置标记 |
| 提交后展示 | 双标记结果地图（猜测点 + 答案点）、距离（km）、得分 |
| 结算面板 | 总分、平均距离 |

#### 4.2.2 题目展示方式

| 模式 | 数据来源 | 展示形式 |
|---|---|---|
| **街景模式** | Google Maps Street View | iframe 嵌入 360° 全景 |
| **图片模式** | 用户上传的静态图片 | 图片全屏/大图展示 |

#### 4.2.3 评分算法

| 项 | 说明 |
|---|---|
| 距离计算 | Haversine 大圆距离公式 |
| 评分公式 | 指数衰减：`score = 5000 × e^(-distance / 2000)` |
| 满分 | 5000 分（距离 = 0km） |
| 坐标系统 | 后端统一 WGS-84；前端高德地图使用 GCJ-02，通过 coordTransform 互转 |

---

### 4.3 题库系统

#### 4.3.1 数据模型

**题库 (question_banks)**

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | TEXT PK | 题库唯一标识 |
| `title` | TEXT | 题库名称 |
| `owner_user_id` | TEXT FK | 所有者 |
| `price` | INTEGER | 市场售价（0 = 免费） |
| `is_listed` | INTEGER | 是否在市场挂牌 |

**题目 (questions)**

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | TEXT PK | 题目唯一标识 |
| `bank_id` | TEXT FK | 所属题库 |
| `description` | TEXT | 出题者备注（不对答题者展示） |
| `source_type` | TEXT | `street_view` 或 `image` |
| `lat / lng` | REAL | 答案坐标（WGS-84） |
| `heading / pitch / fov` | REAL | 街景视角参数 |
| `pano_id` | TEXT | Google 街景全景 ID |
| `image_path` | TEXT | 上传图片路径 |

#### 4.3.2 题目上传

**方式一：Google Maps URL 导入**

用户粘贴 Google Maps URL → 系统自动解析经纬度、视角参数 → 用户补充描述 → 提交。

**支持的 URL 格式**：街景分享链接 (`@...`)、地点详情链接 (`place/...`)、Embed 链接。

**方式二：手动录入**

用户手动输入经纬度 + 上传图片（JPG/PNG/WebP，≤10MB）。

#### 4.3.3 审核流程

```
用户提交 → pending → 审核员认领 → 查验（坐标/图片/合规）
  ├── 通过 → approved → 进入公共题库
  └── 驳回 → rejected + reviewNote → 通知用户 → 用户可修改重提
```

| 状态 | 含义 | 可见范围 |
|---|---|---|
| `pending` | 待审核 | 仅上传者和管理后台 |
| `approved` | 已通过 | 全员可用 |
| `rejected` | 已驳回 | 仅上传者可见 |

---

### 4.4 竞技模式

#### 4.4.1 排位赛

| 项 | 说明 |
|---|---|
| 段位体系 | 青铜 → 白银 → 黄金 → 铂金 → 钻石 → 大师 → 王者（7 段位） |
| 升降星 | 每胜 +1★，满 5★ 晋级；每败 -1★ |
| 匹配机制 | 进入匹配队列，自动配对同段位对手 |
| 匹配记录 | rank_matches 表记录每局胜负、段位变化 |
| 前端页面 | RankedPage — 段位徽章、星数、匹配动画、周胜率、战绩记录 |

#### 4.4.2 巅峰赛

| 项 | 说明 |
|---|---|
| 准入条件 | ≥ 钻石段位 + 完成 ≥20 局排位 |
| 积分制 | ELO 评分（K=32），初始 1200 分 |
| 盲选模式 | 对战时隐藏对手昵称 |
| 限时开放 | 每日 18:00–24:00 |
| 前端页面 | PeakPage — 资格校验、积分榜、战绩、匹配动画 |

#### 4.4.3 PvP 对战

| 项 | 说明 |
|---|---|
| 模式 | 1v1 回合制，默认 5 回合 |
| 房间系统 | 创建房间 → 生成房间码 → 对手加入 → 开始对战 |
| 角色与卡牌 | 对战前选择角色和卡牌，可使用技能 |
| 计分 | 每回合独立评分，累计总分定胜负 |
| 回合历史 | 记录每回合猜测和得分 |

#### 4.4.4 大逃杀 (Battle Royale)

| 项 | 说明 |
|---|---|
| 模式 | 多人同时竞技，淘汰制 |
| 房间 | 大厅等待 → 满员/房主开始 → 逐轮淘汰 |
| 人数 | 默认最多 8 人 |
| 角色卡牌 | 支持角色和卡牌技能 |

---

### 4.5 特色玩法

#### 4.5.1 环球之旅

| 项 | 说明 |
|---|---|
| 概念 | 预设主题路线，每站一个街景点，完成后获得护照印章 |
| 预置路线 | 丝绸之路（6站）、环太平洋之旅（6站）、欧洲古堡之旅（6站） |
| 游玩流程 | 路线列表 → 详情预览 → 开始旅程 → 逐站街景探索 → 提交答案 |
| 文化笔记 | 每站提交后展示该地点的历史文化知识卡片 |
| 奖励 | 路线完成获得 XP + 金币 |
| 难度分级 | easy / medium / hard |

**预置路线明细**

| 路线 | 难度 | 站点 |
|---|---|---|
| 🐫 丝绸之路 | medium | 西安钟楼 → 敦煌莫高窟 → 喀什老城 → 撒马尔罕 → 德黑兰大巴扎 → 伊斯坦布尔 |
| 🌋 环太平洋之旅 | medium | 东京涩谷 → 马尼拉王城 → 雅加达老城 → 奥克兰 → 圣地亚哥 → 西雅图 |
| 🏰 欧洲古堡之旅 | easy | 爱丁堡城堡 → 香波堡 → 新天鹅堡 → 布拉格城堡 → 渔人堡 → 锡吉什瓦拉 |

#### 4.5.2 每日挑战

| 项 | 说明 |
|---|---|
| 每日题目 | 每天固定题目，所有玩家面对相同挑战 |
| 签到系统 | check_ins 表记录每日签到，连续签到累计 streak |
| 排名 | 每日挑战独立排名 |
| 奖励 | XP + 签到连胜奖励 |

#### 4.5.3 国家连击

| 项 | 说明 |
|---|---|
| 玩法 | 连续猜对所属国家，中断则重置 |
| 记录 | 当前连击数 / 最佳连击数 |
| 排行榜 | 独立的国家连击排行榜 |
| 组件复用 | GoogleStreetView + AmapGuessMap |

#### 4.5.4 悬赏答题

| 项 | 说明 |
|---|---|
| 创建悬赏 | 用户发布题目 + 设置金币赏金 + 截止时间 |
| 参与竞猜 | 其他用户提交答案 |
| 结算 | 悬赏者可选择最佳答案作为获胜者，赏金自动转账 |
| 状态 | active → closed / expired |

---

### 4.6 赛季系统

#### 4.6.1 赛季通行证

| 项 | 说明 |
|---|---|
| 赛季结构 | season 表定义赛季周期（起止日期、主题） |
| 等级体系 | 累积 XP 升级，每级有对应奖励 |
| 进度条 | 赛季英雄区展示环形进度条和当前等级 |
| 奖励面板 | 逐级展示可解锁奖励（未解锁🔒 / 当前🔓 / 已领取✅） |

#### 4.6.2 赛季任务

**预置 13 个任务**：

| 类型 | 数量 | 示例 |
|---|---|---|
| 📅 日常任务 | 5 个 | 排位高手（3局排位）、亚洲通（猜对5次）、精准一击（单局≥4000分）、对战之星（PvP 1胜）、贡献者（提交1题） |
| 📆 周常任务 | 5 个 | 排位狂热（10胜）、环球旅行家（5国）、坚持不懈（7天签到）、巅峰之路（3局巅峰赛）、环球旅者（完成1条路线） |
| 🏅 赛季任务 | 3 个 | 黄金强者（达黄金段位）、排位百战、巅峰强者（巅峰赛3胜） |

| 功能 | 说明 |
|---|---|
| 进度追踪 | 实时显示 current_count / target_count + 进度条 |
| 奖励领取 | 完成后显示"领取"按钮，领取即 claimed |
| XP + 金币 | 每个任务有独立 reward_xp 和 reward_coin |

---

### 4.7 社交系统

#### 4.7.1 好友与关注

| 功能 | 说明 |
|---|---|
| 关注系统 | follows 表：follower_id → following_id |
| 好友列表 | 展示头像、昵称、最近活跃时间 |

#### 4.7.2 评论与点赞

| 功能 | 说明 |
|---|---|
| 评论 | comments 表，支持 target_type + target_id 通用绑定，支持嵌套回复 (parent_id) |
| 点赞 | likes 表，唯一约束防重复点赞 |

#### 4.7.3 通知系统

| 功能 | 说明 |
|---|---|
| 通知类型 | 好友申请、审核结果、悬赏结果、赛季更新等 |
| 已读/未读 | is_read 标记，未读数量展示 |
| 通知链接 | 每条通知可附带跳转链接 |

---

### 4.8 社区系统

#### 4.8.1 帖子分类

| 分类 | 说明 |
|---|---|
| `lost_item` | 失物招领 |
| `found_item` | 拾获物品 |
| `missing_person` | 寻人启事 |
| `announcement` | 公告 |
| `other` | 其他 |

#### 4.8.2 帖子功能

| 功能 | 说明 |
|---|---|
| 发布 | 标题 + 内容 + 分类 + 地区 + 联系方式 + 媒体附件 |
| 审核 | 帖子需审核（pending_review → approved / rejected / revoked） |
| 媒体 | 支持图片上传（media_list JSON 数组） |
| 互动 | 评论 + 点赞 |

---

### 4.9 经济系统

| 功能 | 说明 |
|---|---|
| 虚拟钱包 | wallets 表：user_id → balance_coin |
| 交易记录 | coin_transactions 表：recharge / withdraw / bounty_reward / bounty_create / bounty_refund |
| 金币获取 | 悬赏奖励、赛季任务、路线完成、每日挑战 |
| 金币使用 | 创建悬赏、购买题库 |

---

### 4.10 市场系统

| 功能 | 说明 |
|---|---|
| 挂牌出售 | 题库所有者设置 price，is_listed = 1 |
| 购买 | 其他用户金币购买，记录到 bank_purchases |
| 已购买题库 | 可在游戏中使用 |

---

### 4.11 战队系统

| 功能 | 说明 |
|---|---|
| 创建战队 | 设置名称、描述 |
| 加入战队 | 通过战队 ID 或邀请 |
| 角色 | owner / member |
| 前端页面 | TeamsPage — 创建/加入/成员列表 |

---

### 4.12 角色卡牌系统

#### 4.12.1 角色

| 功能 | 说明 |
|---|---|
| 角色选择 | 用户可选择角色（默认 explorer） |
| 使用追踪 | character_usage 表记录使用次数 |
| 对战集成 | PvP/BR 房间记录 creator_character / joiner_character |

#### 4.12.2 卡牌

| 功能 | 说明 |
|---|---|
| 卡牌系统 | 传说卡牌，每张限用一次 |
| 使用记录 | user_used_cards 表追踪 |
| 对战技能 | PvP/BR 中可使用卡牌技能 |

#### 4.12.3 技能

| 功能 | 说明 |
|---|---|
| 技能使用 | PvP 中：creator_skill_used / joiner_skill_used |
| 冷却机制 | BR 中：skill_cooldown 字段 |
| 锁定机制 | 选择截止时间 select_deadline |

---

### 4.13 藏宝游戏

| 功能 | 说明 |
|---|---|
| 类型 | `treasure_hunt`（GPS 打卡寻宝）/ `reasoning`（推理闯关） |
| 任务点 | location_tasks 表：GPS 校验 / 图片上传 |
| 报名审核 | 玩家提交报名 → 主办方审核 → 开始游戏 |
| 进度追踪 | game_progress 表：current_step + completed_steps |
| 前端页面 | GameCreatePage / GameDetailPage / GamesHubPage / MyEventsPage |

---

### 4.14 排行榜

| 榜单 | 说明 | 重置周期 |
|---|---|---|
| 总积分榜 | 累计得分排名 | 不重置 |
| 周榜 | 本周得分排名 | 每周一 00:00 |
| 日榜 | 今日得分排名 | 每日 00:00 |
| 排位榜 | 排位段位 + 星数排名 | 赛季重置 |
| 巅峰榜 | ELO 积分排名 | 赛季重置 |
| 国家连击榜 | 最佳连击排名 | 不重置 |
| 好友榜 | 好友间排名 | 跟随全局榜单 |

---

### 4.15 管理后台

| 功能 | 说明 |
|---|---|
| 题库审核 | AdminReviewPage — 待审列表、预览、通过/驳回/撤销 |
| 游戏审核 | 藏宝游戏审核（approve / reject / revoke） |
| 帖子审核 | 社区帖子审核 |
| 用户管理 | 用户列表、详情、角色分配 |
| 题目管理 | ManagePage — 题库 CRUD、创建题目 |

---

## 5. 系统架构

### 5.1 目录结构

```
GeoguessrEX/
├── apps/
│   ├── api/                     # 后端 API
│   │   ├── src/
│   │   │   ├── server.js        # Express 入口，路由注册
│   │   │   ├── routes/          # 路由层（24 个路由文件）
│   │   │   ├── services/        # 业务逻辑层（25 个服务文件）
│   │   │   ├── middleware/       # 中间件（auth 鉴权）
│   │   │   ├── utils/           # 工具（Haversine, Scoring, coordTransform）
│   │   │   └── data/            # 种子数据（questions.json, cards.json, characters.json）
│   │   └── data/                # 运行时 SQLite 数据库 + 上传文件
│   └── web/                     # 前端 Web 应用
│       └── src/
│           ├── main.jsx         # React 入口
│           ├── App.jsx          # 路由定义
│           ├── pages/           # 页面组件（30 个页面）
│           ├── components/      # 通用组件（20+ 个组件）
│           ├── services/        # API 调用封装（api.js, amapLoader.js, coordTransform.js）
│           ├── contexts/        # React Context（AuthContext）
│           └── styles/          # 样式（tokens.css, base.css, globals.css）
├── docs/                        # 文档 + 架构图
├── scripts/                     # 工具脚本
├── package.json                 # 根 monorepo 配置
└── pnpm-workspace.yaml          # pnpm workspace 配置
```

### 5.2 后端路由一览

| 路由文件 | 主要端点 | 职责 |
|---|---|---|
| `auth.js` | `POST /api/auth/register` `POST /api/auth/login` `GET /api/auth/me` | 注册/登录/当前用户 |
| `submit.js` | `POST /api/submit` | 图寻答案提交评分 |
| `questions.js` | `GET/POST /api/questions` `GET/PUT/DELETE /api/questions/:id` | 题库 CRUD |
| `uploads.js` | `POST /api/uploads/images` `POST /api/uploads/media` | 图片/媒体上传 |
| `reviews.js` | `GET /api/reviews/pending` `POST /api/reviews` `POST /api/reviews/revoke` | 审核操作 |
| `routes.js` | `GET /api/routes` `POST /api/routes/:id/start` `POST /api/routes/:id/submit` `GET /api/routes/:id/progress` | 环球之旅 |
| `ranked.js` | `POST /api/ranked/join` `POST /api/ranked/leave` `GET /api/ranked/status` `GET /api/ranked/matches` | 排位赛 |
| `peak.js` | `POST /api/peak/join` `POST /api/peak/leave` `GET /api/peak/status` `GET /api/peak/matches` `GET /api/peak/leaderboard` | 巅峰赛 |
| `quests.js` | `GET /api/quests` `POST /api/quests/:id/claim` | 赛季任务 |
| `season.js` | `GET /api/season` `GET /api/season/pass` `GET /api/season/leaderboard` | 赛季通行证 |
| `gameModes.js` | `POST /api/pvp/create|join|guess|status` `POST /api/br/create|join|start|guess` `POST /api/country-streak/submit` | PvP/BR/国家连击 |
| `daily.js` | `GET /api/daily/challenge` `POST /api/daily/submit` `POST /api/checkin` | 每日挑战+签到 |
| `bounties.js` | `GET/POST /api/bounties` `GET /api/bounties/:id` `POST /api/bounties/:id/submit` `POST /api/bounties/:id/close` | 悬赏系统 |
| `wallet.js` | `GET /api/wallet` `POST /api/wallet/recharge|withdraw` `GET /api/wallet/transactions` | 钱包 |
| `marketplace.js` | `GET /api/marketplace` `POST /api/marketplace/purchase` | 市场 |
| `teams.js` | `GET/POST /api/teams` `POST /api/teams/:id/join|leave` | 战队 |
| `games.js` | `GET/POST /api/games` `GET /api/games/:id` `POST /api/games/:id/register` | 藏宝游戏 |
| `community.js` | `GET/POST /api/community` `GET /api/community/:id` `DELETE /api/community/:id` | 社区帖子 |
| `social.js` | `POST /api/social/follow|unfollow` `GET /api/social/followers|following` `POST /api/comments` `POST /api/likes` | 社交互动 |
| `notifications.js` | `GET /api/notifications` `POST /api/notifications/:id/read` | 通知 |
| `leaderboard.js` | `GET /api/leaderboard` | 排行榜 |
| `badges.js` | `GET /api/badges` | 徽章系统 |
| `health.js` | `GET /api/health` | 健康检查 |

### 5.3 业务服务一览

| 服务文件 | 职责 |
|---|---|
| `database.js` | 数据库初始化、所有表创建、25+ 迁移函数、种子数据 |
| `authService.js` | PBKDF2 密码哈希、HMAC Token 签发/校验 |
| `gameService.js` | 答案评分（Haversine + 指数衰减） |
| `questionBank.js` | 题库 CRUD、JSON 种子导入 |
| `routeService.js` | 环球之旅：路线列表、开始、进度、提交 |
| `rankedService.js` | 排位赛：匹配队列、段位升降、记录 |
| `peakService.js` | 巅峰赛：ELO 积分、资格校验、匹配 |
| `questService.js` | 赛季任务：进度追踪、奖励领取 |
| `seasonService.js` | 赛季通行证：等级、XP、奖励 |
| `pvpService.js` | PvP 对战：房间管理、回合逻辑 |
| `gameModesService.js` | 国家连击、大逃杀等模式 |
| `dailyChallengeService.js` | 每日挑战生成、提交、排行 |
| `bountyService.js` | 悬赏创建、竞猜、结算 |
| `walletService.js` | 钱包余额、交易记录 |
| `marketplaceService.js` | 题库买卖 |
| `teamService.js` | 战队创建、加入、管理 |
| `treasureGameService.js` | 藏宝游戏 CRUD、报名 |
| `communityService.js` | 帖子 CRUD、媒体 |
| `socialService.js` | 关注、评论、点赞 |
| `notificationService.js` | 通知创建、已读 |
| `leaderboardService.js` | 排行榜查询 |
| `reviewService.js` | 审核（approve/reject/revoke） |
| `badgeService.js` | 徽章系统 |
| `characterService.js` | 角色选择、卡牌管理 |
| `xpService.js` | XP 增减、等级计算 |

<!-- 📸 截图插入点 3：服务类图 → 编译 docs/diagrams/09-服务类图.puml，截图后替换此行 -->
> ![后端服务类图](../out/docs/diagrams/09-服务类图/09-服务类图.png)

### 5.4 数据库表一览

| 表名 | 用途 | 关键字段 |
|---|---|---|
| `users` | 用户 | id, username, email, role, password_hash, xp, level, rank_tier, rank_stars, peak_score, org_name, selected_character |
| `question_banks` | 题库 | id, title, owner_user_id, price, is_listed |
| `questions` | 题目 | id, bank_id, lat, lng, heading, pitch, fov, pano_id, image_path, source_type |
| `wallets` | 钱包 | user_id, balance_coin |
| `coin_transactions` | 交易记录 | id, user_id, type, amount, balance_before, balance_after |
| `bounties` | 悬赏 | id, creator_id, title, reward_coin, deadline, status, winner_id |
| `bounty_submissions` | 悬赏提交 | id, bounty_id, user_id, guess_lat, guess_lng, distance_km, score |
| `treasure_games` | 藏宝游戏 | id, creator_id, title, game_type, region, status |
| `location_tasks` | 藏宝任务点 | id, game_id, target_lat, target_lng, task_type |
| `game_registrations` | 游戏报名 | id, game_id, user_id, player_info, status |
| `game_progress` | 游戏进度 | id, registration_id, current_step, completed_steps |
| `community_posts` | 社区帖子 | id, author_id, title, content, category, region, status, media_list |
| `reviews` | 审核记录 | id, target_type, target_id, reviewer_id, action, reason |
| `comments` | 评论 | id, target_type, target_id, user_id, content, parent_id |
| `likes` | 点赞 | id, target_type, target_id, user_id |
| `follows` | 关注 | id, follower_id, following_id |
| `notifications` | 通知 | id, user_id, type, title, body, link, is_read |
| `pvp_rooms` | PvP 房间 | id, code, creator_id, joiner_id, status, round_history, creator/joiner_character/card/skill |
| `country_streaks` | 国家连击 | id, user_id, streak, best_streak |
| `br_rooms` | BR 房间 | id, code, status, max_players |
| `br_players` | BR 玩家 | id, room_id, user_id, score, alive, character, card |
| `seasons` | 赛季 | id, name, season_number, start_date, end_date, theme |
| `season_pass` | 通行证 | id, user_id, season_id, level, xp |
| `daily_challenges` | 每日挑战 | id, date, question_data |
| `daily_challenge_submissions` | 每日挑战提交 | id, challenge_id, user_id, guess_lat, guess_lng, score |
| `check_ins` | 签到 | id, user_id, date, streak |
| `routes` | 环球路线 | id, title, subtitle, description, difficulty, xp_reward, coin_reward, status |
| `route_stops` | 路线站点 | id, route_id, order_index, title, lat, lng, heading, pitch, fov, cultural_note |
| `user_route_progress` | 路线进度 | id, user_id, route_id, current_stop, completed_stops, total_score |
| `rank_matches` | 排位记录 | id, winner_id, loser_id, winner/loser_tier/stars_before, stars_change |
| `rank_queue` | 排位队列 | id, user_id, tier, joined_at |
| `peak_matches` | 巅峰记录 | id, winner_id, loser_id, winner/loser_score_before/after/change |
| `peak_queue` | 巅峰队列 | id, user_id, peak_score, joined_at |
| `season_quests` | 赛季任务 | id, quest_type, title, target_type, target_count, reward_xp, reward_coin |
| `user_quest_progress` | 任务进度 | id, user_id, quest_id, current_count, completed, claimed, date |
| `teams` | 战队 | id, name, description, owner_id |
| `team_members` | 战队成员 | id, team_id, user_id, role |
| `bank_purchases` | 市场购买 | id, bank_id, buyer_id, price |
| `user_used_cards` | 卡牌使用 | id, user_id, card_id, used_at |
| `character_usage` | 角色使用 | id, user_id, character_id, usage_count |

<!-- 📸 截图插入点 4：ER图 → 编译 docs/diagrams/06-ER图.puml，截图后替换此行 -->
> ![数据库ER图](../out/docs/diagrams/06-ER图/06-ER图.png)

---

## 6. 前端页面一览

| 页面组件 | 路由 | 功能描述 |
|---|---|---|
| `HomePage` | `/` | 首页：模式入口、快捷导航 |
| `AuthPage` | `/auth` | 登录/注册 |
| `ProfilePage` | `/profile` | 个人主页：数据面板、动态列表 |
| `GamePage` | `/game` | 单人图寻：街景展示 + 猜点地图 + 结果 |
| `ManagePage` | `/manage` | 题库管理：CRUD、新建入口 |
| `CreateMapPage` | `/manage/create` | 题目创建：URL 导入 + 手动录入 |
| `AdminReviewPage` | `/admin/review` | 管理后台：题库审核 |
| `PvPPage` | `/pvp` | PvP 对战：创建/加入房间 |
| `BRPage` | `/br` | 大逃杀模式 |
| `CountryStreakPage` | `/country-streak` | 国家连击模式 |
| `DailyChallengePage` | `/daily` | 每日挑战 |
| `RankedPage` | `/ranked` | 排位赛：段位 + 匹配 |
| `PeakPage` | `/peak` | 巅峰赛：ELO + 限时 |
| `WorldTourPage` | `/world-tour` | 环球之旅：路线选择 + 游玩 |
| `SeasonPage` | `/season` | 赛季：通行证 + 任务 + 排行榜 |
| `BountiesPage` | `/bounties` | 悬赏列表 |
| `BountyCreatePage` | `/bounties/create` | 创建悬赏 |
| `BountyDetailPage` | `/bounties/:id` | 悬赏详情 + 提交 |
| `LeaderboardPage` | `/leaderboard` | 排行榜 |
| `CommunityPage` | `/community` | 社区帖子列表 |
| `CommunityCreatePage` | `/community/create` | 发布帖子 |
| `PostDetailPage` | `/community/:id` | 帖子详情 |
| `GamesHubPage` | `/treasure` | 藏宝游戏大厅 |
| `GameCreatePage` | `/treasure/create` | 创建藏宝游戏 |
| `GameDetailPage` | `/treasure/:id` | 藏宝游戏详情 + 报名 |
| `MyEventsPage` | `/my-events` | 我的活动 |
| `MarketplacePage` | `/marketplace` | 题库市场 |
| `TeamsPage` | `/teams` | 战队管理 |
| `NotificationsPage` | `/notifications` | 通知列表 |

---

## 7. 非功能需求

### 7.1 性能

| 指标 | 目标值 |
|---|---|
| API 响应时间（P95） | < 500ms |
| 单次查询 | SQLite 同步查询，单次 < 10ms |
| 并发在线用户 | ≥ 500 |
| 图片上传响应 | < 3s |

### 7.2 安全

| 项 | 措施 |
|---|---|
| 密码存储 | PBKDF2-SHA512 加盐哈希（120k 迭代） |
| 身份认证 | HMAC-SHA256 Bearer Token（7 天有效期） |
| 文件上传 | 校验文件扩展名 + MIME 类型 + 大小上限 |
| SQL 注入 | 参数化查询（better-sqlite3 prepared statements） |
| 权限控制 | requireAuth 中间件 + 角色检查 |

### 7.3 可维护性

| 项 | 措施 |
|---|---|
| API 规范 | RESTful，统一 `/api/` 前缀 |
| 数据库变更 | migration 函数顺序执行，兼容已存在表 |
| 种子数据 | 题库种子 + 路线种子 + 任务种子，仅在空表时插入 |
| 代码组织 | 路由层 → 服务层 → 数据层，职责分离 |

### 7.4 兼容性

| 端 | 要求 |
|---|---|
| 浏览器 | Chrome / Firefox / Edge 最新两个大版本 |
| Node.js | ≥ 18.0.0 |
| 分辨率 | 桌面端，最低支持 1280×720 |

---

## 8. 版本演进

| 版本 | 主题 | 主要交付 |
|---|---|---|
| **v0.1** | MVP | 单人图寻、街景+图片、Haversine 评分、本地 JSON 题库 |
| **v0.2** | 用户+题库 | 邮箱注册/登录、JWT 鉴权、题库 CRUD、审核流程、数据库迁移 |
| **v0.3** | 社交+竞技 | 好友/关注、社区帖子、评论/点赞/通知、PvP 对战、大逃杀、排行榜 |
| **v0.4** | 玩法扩展 | 每日挑战、国家连击、悬赏答题、藏宝游戏、市场、战队 |
| **v0.5** | 竞技深化 | 排位赛（7段位）、巅峰赛（ELO）、赛季通行证、赛季任务 |
| **v1.0** | 正式版 | 环球之旅、角色卡牌系统、管理后台完善、全面测试与缺陷修复 |

---

## 9. 开放问题

| 序号 | 问题 | 影响范围 |
|---|---|---|
| 1 | **生产数据库迁移**：当前使用 SQLite，高并发下建议迁移至 PostgreSQL + PostGIS | 性能、地理查询 |
| 2 | **文件存储升级**：当前本地文件系统，生产应迁移至对象存储（OSS/S3）+ CDN | 图片加载速度 |
| 3 | **Google 街景国内访问**：国内用户访问 Google 街景受限，需备选方案（如百度街景、腾讯街景） | 街景可用性 |
| 4 | **实时通信**：PvP/BR 当前基于 HTTP 轮询，建议升级至 WebSocket | 对战体验 |
| 5 | **国际化**：当前仅中文，是否预留多语言？ | 前端架构 |
| 6 | **敏感位置过滤**：是否过滤军事区、私人住宅等敏感坐标？ | 审核合规 |
| 7 | **题目去重**：同一坐标附近是否允许多道题目？ | 题库质量 |
