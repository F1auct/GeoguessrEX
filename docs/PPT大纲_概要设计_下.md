# GeoguessrEX 概要设计 —— PPT 大纲（下）

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
