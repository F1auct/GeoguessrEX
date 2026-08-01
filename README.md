# GeoGuessrEX

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)
![pnpm](https://img.shields.io/badge/pnpm-9-F69220?logo=pnpm)
![Node](https://img.shields.io/badge/Node-22-339933?logo=nodedotjs)

基于 Google 街景与高德地图的地理猜点游戏平台，支持多种竞技模式与社区功能。

## 功能概览

### 核心玩法

- 题库猜点：选择题库，看图猜位置，距离越近分数越高
- 街景模式：Google Street View 全景探索
- 图片模式：上传自定义图片作为题目

### 竞技模式

- 排位赛：Bronze - Grandmaster 段位系统，匹配对战
- 巅峰赛：ELO 积分制竞技
- 1v1 对战：创建/加入房间，实时对战
- 大逃杀：多人淘汰赛
- 每日挑战：每日题目 + 签到连击
- 国家连击：连续猜中国家得分

### 成长系统

- 经验值与等级（Lv.1 - Lv.15+）
- 赛季通行证（20 级奖励轨道 + 日常/周常/赛季任务）
- 金币系统：充值、悬赏、题库交易

### 社区功能

- 帖子发布（寻物、寻人、通告等分类）
- 评论、点赞、关注
- 团队系统（创建、加入、排行榜）

### 题库生态

- 题库市场：挂牌出售、金币购买（平台抽成 20%）
- 悬赏系统：发布悬赏任务，提交答案赢金币
- 藏宝游戏：多关卡定位闯关

### 环球之旅

- 丝绸之路、环太平洋、欧洲古堡三条预设路线
- 每站猜点 + 文化解说文字

## 技术栈

| 层         | 技术                            |
| --------- | ----------------------------- |
| 前端        | React 18 + Vite 7             |
| 地图（猜点/结果） | 高德地图 JSAPI v2                 |
| 街景展示      | Google Maps Embed API         |
| 后端        | Express 4 (ESM)               |
| 数据库       | SQLite（better-sqlite3，同步 API） |
| 包管理       | pnpm 9 workspace              |

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置 API 密钥

在 `apps/web/` 下创建 `.env.local`：

```bash
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_AMAP_API_KEY=your_amap_api_key
```

### 3. 启动服务

```bash
# 终端 1：后端（端口 3001）
pnpm dev:api

# 终端 2：前端（端口 5173）
pnpm dev:web
```

打开 `http://localhost:5173` 即可使用。

### 4. 演示账号

仓库内置了含种子数据的数据库，无需额外配置。所有演示用户密码均为 `password123`：

| 账号            | 段位       | 备注       |
| ------------- | -------- | -------- |
| skywalker     | Diamond  | 管理员      |
| geohunter     | Diamond  |          |
| mapexplorer   | Platinum |          |
| streetviewpro | Platinum |          |
| atlasnomad    | Gold     |          |
| ...           | ...      | 共 15 个用户 |

如需重置数据库，运行：

```bash
node apps/api/scripts/seed.js
```

## 环境变量

| 变量                         | 位置  | 说明                 | 默认值                             |
| -------------------------- | --- | ------------------ | ------------------------------- |
| `AUTH_SECRET`              | 后端  | Token 签名密钥         | `geoguesr-dev-auth-secret`      |
| `ADMIN_REGISTER_CODE`      | 后端  | 管理员注册码，不设置则无法注册管理员 | 空                               |
| `DATABASE_PATH`            | 后端  | SQLite 数据库路径       | `apps/api/data/geoguesr.sqlite` |
| `PORT`                     | 后端  | 服务端口               | `3001`                          |
| `VITE_GOOGLE_MAPS_API_KEY` | 前端  | Google 街景 API 密钥   | -                               |
| `VITE_AMAP_API_KEY`        | 前端  | 高德地图 API 密钥        | -                               |

## 坐标系统

- 题库坐标以 WGS-84 存储
- 高德地图使用 GCJ-02（中国加密坐标）
- 前端显示前：`WGS-84 → GCJ-02`
- 用户点击提交前：`GCJ-02 → WGS-84`
- 后端距离计算仅使用 WGS-84（Haversine 公式）
- 中国境外坐标两个函数均为恒等变换

## 目录结构

```
apps/
  api/                          Express 后端 (:3001)
    data/geoguesr.sqlite        SQLite 数据库（已入库）
    uploads/questions/          上传图片（gitignored）
    scripts/seed.js             种子数据脚本
    src/
      server.js                 入口，注册所有路由
      data/questions.json       种子题库
      middleware/auth.js        Bearer token 认证
      routes/                   路由模块
      services/                 业务逻辑层
      utils/haversine.js        大圆距离计算
      utils/scoring.js          距离 -> 分数（指数衰减）
  web/                          React 前端 (:5173)
    src/
      App.jsx                   根组件，页面路由 + 会话管理
      pages/                    页面组件
      components/               通用组件
      services/api.js           API 封装
      services/coordTransform.js 坐标转换
      styles/                   CSS
```

## 分支与提交规范

- 分支：`main`（稳定）、`feat/*`（功能）、`fix/*`（修复）、`chore/*`（工程）
- 提交：Conventional Commits — `feat:`、`fix:`、`docs:`、`chore:`、`refactor:`
