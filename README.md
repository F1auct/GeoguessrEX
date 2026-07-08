# GeoGuesr MVP

最小可运行图寻框架，当前只包含单人基础玩法：

- 读取本地 JSON 题库
- 展示题目图片
- 地图点击猜位置
- 提交答案
- 使用 Haversine 计算距离
- 根据距离计算分数
- 展示结果页
- 支持下一题

## 技术栈

- 前端：Vite + React + AMap JSAPI
- 后端：Express
- 数据源：SQLite，本地 JSON 题库会在首次启动时导入
- 账号体系：SQLite 用户表 + Bearer token

## 端口规范

- 前端开发端口：`5173`
- 后端开发端口：`3001`

## 启动方式

优先支持 `npm`，如果本机装了 `pnpm` 也可以用。

### 方式一：根目录一键安装（推荐）

```bash
npm install
```

### 方式二：分别安装

1. 安装前端依赖
   `cd apps/web && npm install`
2. 安装后端依赖
   `cd apps/api && npm install`

### 启动

3. 启动后端
   `cd apps/api && npm run dev`
4. 启动前端
   `cd apps/web && npm run dev`

打开 `http://localhost:5173`。

## 目录说明

- `apps/web`：前端应用
- `apps/api`：后端 API

## 题库格式

题库文件位于 `apps/api/src/data/questions.json`。

字段示例：

```json
{
  "id": "q1",
  "title": "Nordic Harbor",
  "streetView": {
    "lat": 59.9139,
    "lng": 10.7522,
    "heading": 120,
    "pitch": 0,
    "fov": 100,
    "panoId": null
  }
}
```

## 地图约束

- 当前猜点地图默认使用 `AMap JSAPI`
- 主街景视图使用 `Google Maps Embed API`
- 题库坐标与后端距离计算统一使用 `WGS-84`

当前实现已经内置这套转换：

- 前端展示前做 `WGS-84 -> GCJ-02`
- 用户点击提交前做 `GCJ-02 -> WGS-84`
- 后端算距离时仍只使用 `WGS-84`

## 分支规范

- `main`：稳定分支
- `feat/*`：功能开发
- `fix/*`：缺陷修复
- `chore/*`：工程调整

## 提交规范

建议使用简洁的 Conventional Commits：

- `feat: add single question flow`
- `fix: correct haversine scoring`
- `docs: update startup guide`

## 当前状态

当前为试水版 MVP 骨架，后续可继续扩展：

- 图片本地化存储
- 题目顺序控制
- 多局累计分数
- 排行榜

## 账号登录

- 前端启动后会先进入登录/注册页，登录后才进入游戏。
- 登录支持邮箱地址或用户名 + 密码。
- 注册成功后会自动登录。
- 用户、题库、题目数据保存在 `apps/api/data/geoguesr.sqlite`，首次启动时自动创建；该目录会被 Git 忽略。
- 后端 token 签名优先读取 `AUTH_SECRET`。本地开发不设置也可以启动，但正式环境应配置稳定的私密值。
- 注册时可填写管理员注册码；注册码来自后端环境变量 `ADMIN_REGISTER_CODE`，不配置时无法注册管理员。
- 普通用户只能编辑自己创建的题库和题目，管理员可以编辑所有题库和题目。
- 上传图片保存在 `apps/api/uploads/questions`，题目表中只保存 `/uploads/...` 路径。

## Google Street View 配置

前端通过 Google Maps Embed API 加载 Street View。需要在 `apps/web` 下创建 `.env.local`：

```bash
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_AMAP_API_KEY=your_amap_api_key
```

- 没有 `VITE_GOOGLE_MAPS_API_KEY` 时，Street View 会显示占位提示
- 没有 `VITE_AMAP_API_KEY` 时，高德猜点地图和结果地图会显示占位提示
