<div align="center">

# PerlerGen 拼豆生成器

**图片转拼豆图纸、色卡匹配、图纸编辑与导出的 Web 工具**

[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat&logo=vite&logoColor=white)](https://vite.dev/)
[![React](https://img.shields.io/badge/React-19-20232a?style=flat&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)

</div>

## 项目简介

PerlerGen 是一款面向拼豆、熨烫豆和像素画制作的在线图纸工具。当前实现以 React + TypeScript + Vite 构建，核心流程是上传图片、裁剪、按指定网格尺寸像素化、匹配实体豆子色卡，并导出可打印的拼豆图纸和材料清单。

项目也内置了 Google Gemini 分析入口和 Cloudflare Worker 统计接口：AI 能为图案生成标题、描述、难度和用途建议；Worker 负责记录访问日志并提供访问统计。

## 当前功能审查

### 图片转拼豆图纸

- 支持上传 PNG、JPG/JPEG、WebP 图片。
- 上传后可先裁剪，再进入图纸生成流程。
- 可设置网格宽高，并支持按原图比例自动联动。
- 使用 Jimp 缩放图片，使用 chroma-js 在 CIELAB 色彩空间中匹配最近色。
- 支持 0-10 级去杂色处理，包含中值滤波、Kuwahara 平滑和网格级去噪。
- 预览支持方形豆、圆形豆两种显示方式。

### 色卡与材料管理

- 内置 Mard/M 豆色卡：291 色、264 色、221 色、144 色、96 色。
- 支持导入自定义 CSV 色卡，并保存到浏览器 localStorage。
- CSV 格式支持表头或无表头，字段为 `id,name,hex`。
- 自动统计每个色号用量，并可隐藏指定颜色以便分层查看。
- 可导出材料清单图片，也可选择是否排除隐藏颜色。

### 图纸编辑

- 主预览画布支持滚轮缩放、拖拽平移和触摸操作。
- 点击单个豆子可替换该位置颜色。
- 在材料列表中点击颜色可全局替换同色豆子。
- 支持镜像翻转，适合文字、数字类图案在单面烫豆前校正方向。
- 提供“任意画”编辑模式：
  - 画笔、油漆桶、橡皮擦、吸管工具。
  - 撤销、重做、清空。
  - 水平翻转、垂直翻转、90 度旋转。
  - 显示/隐藏色号与临时材料统计。

### 导出能力

- 导出完整 PNG 图纸，包含坐标、色号、网格和水印。
- 支持按宽高分块导出 ZIP，适合大尺寸图纸打印和分区拼装。
- 支持双人协作导出，生成 P1 正常视角和 P2 180 度旋转文本版本。
- 支持导出材料清单 PNG。
- 隐藏的颜色会在图纸导出中被跳过，便于分层打印。

### AI 与访问统计

- Gemini 分析图片，返回标题、描述、难度和成品用途建议。
- 未配置 Gemini API Key 时，核心图纸生成和导出功能仍可正常使用，AI 区域会返回兜底内容。
- Cloudflare Worker 提供 `/api/log` 和 `/api/stats`。
- D1 数据库表结构位于 `schema.sql`，用于记录访问、上传、裁剪和导出等操作日志。

## 技术栈

- 前端：React 19、TypeScript、Vite 6。
- 图像处理：Jimp、chroma-js、react-image-crop。
- 导出：Canvas、JSZip、FileSaver。
- AI：Google GenAI SDK。
- UI：Tailwind CSS CDN、自定义新拟态组件、Iconify 图标。
- 部署与统计：Cloudflare Workers、Cloudflare D1、Wrangler。

## 快速开始

### 环境要求

- Node.js 18 或更高版本。
- npm。
- 如需使用 AI 分析，需要准备 Google Gemini API Key。

### 安装依赖

```bash
npm install
```

### 配置环境变量

AI 分析是可选功能。需要启用时，在项目根目录创建 `.env.local`：

```env
GEMINI_API_KEY=your_gemini_api_key
```

当前实现会通过 Vite 将 `GEMINI_API_KEY` 注入前端运行时代码；公开部署时请注意 Key 暴露风险。如果需要更严格的安全边界，建议将 Gemini 请求迁移到 Worker 后端代理。

### 本地开发

```bash
npm run dev
```

开发服务默认运行在：

```text
http://localhost:3002
```

Vite 开发服务不会自动启动 Cloudflare Worker，因此 `/api/log` 和 `/api/stats` 在纯前端开发模式下可能请求失败；这不会影响图片转换、编辑和导出功能。

## 构建与预览

```bash
npm run build
npm run preview
```

构建产物会输出到 `dist` 目录。

## Cloudflare 部署

项目已包含 `wrangler.jsonc` 和 `src/worker.ts`，Worker 会托管 `dist` 静态资源，并提供日志与统计 API。

首次部署前需要准备 D1 数据库，并执行表结构：

```bash
npx wrangler d1 execute perlergen_db --file=./schema.sql
```

构建并部署：

```bash
npm run build
npx wrangler deploy
```

如果 D1 数据库名称或 ID 与你的 Cloudflare 环境不同，请同步更新 `wrangler.jsonc`。

## 自定义色卡 CSV

推荐格式：

```csv
id,name,hex
A01,红色,#FF0000
A02,白色,#FFFFFF
A03,黑色,#000000
```

说明：

- `id` 会显示在导出图纸的每个格子中。
- `name` 用于材料列表和颜色搜索。
- `hex` 支持带 `#` 或不带 `#` 的十六进制颜色。

## 目录结构

```text
src/
  App.tsx                         # 主界面与核心交互
  components/
    ImageCropper.tsx              # 图片裁剪
    FreeDrawEditor.tsx            # 任意画编辑器
    NeumorphicComponents.tsx      # UI 基础组件
  context/
    PaletteContext.tsx            # 色卡状态与 localStorage 持久化
  services/
    imageProcessor.ts             # 图片像素化、去噪、色卡匹配
    ExportController.ts           # 图纸、分块、双人和材料导出
    exportUtils.ts                # Canvas 绘制工具
    gemini.ts                     # Gemini 分析
    api.ts / logger.ts            # Worker API 与日志封装
    csvUtils.ts                   # CSV 色卡解析
  beads/                          # 内置 Mard/M 豆色卡
  worker.ts                       # Cloudflare Worker API
```

## 提交规范

本项目建议使用 Conventional Commits，并使用中文描述变更内容：

```bash
feat: 增加自定义色卡导入
fix: 修复分块导出边缘坐标
docs: 优化 README 功能说明
refactor: 重构图纸导出控制器
chore: 更新依赖锁文件
```

常用类型：

- `feat`：新增功能。
- `fix`：修复缺陷。
- `docs`：文档更新。
- `style`：格式、样式调整，不改变逻辑。
- `refactor`：重构。
- `test`：测试相关。
- `build`：构建或依赖相关。
- `chore`：杂项维护。

## 许可证

当前仓库未包含独立 `LICENSE` 文件。现有项目说明倾向于个人学习和非商业用途；如需正式开源分发或商用，请先补充明确的授权协议。
