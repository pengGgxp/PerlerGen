<div align="center">

# PerlerGen (拼豆生成器)

**智能 AI 驱动的像素画与拼豆图纸生成器**

[![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

[English](./README.md) | [简体中文](./README_zh.md)

</div>

---

## 📖 简介

**PerlerGen** 是一款专为拼豆爱好者和像素艺术家设计的现代化 Web 应用。它可以将图片无缝转换为专业的拼豆图纸，支持 Perler、Artkal（硬豆/软豆）和 Hama 等主流品牌色卡。

应用采用柔和触感的 **新拟态 (Neumorphic) UI** 设计，为您提供沉浸式的创作环境。借助 **Google Gemini AI** 的强大能力，PerlerGen 不仅能生成图纸，还能智能分析图案难度，生成作品描述和创意用途建议。

## ✨ 核心功能

- **🎨 智能转换**：高保真图片转像素算法，支持自定义网格尺寸和比例锁定。
- **🧩 多品牌支持**：原生支持 **Perler (拼拼豆豆)**、**Artkal (S系列)**、**Hama (哈马珠)** 以及通用色卡。
- **🤖 AI 智能分析**：集成 **Google Gemini AI**，自动评估制作难度并提供创意灵感。
- **🛠️ 精细化编辑**：
  - **全局颜色替换**：一键替换图纸中的某种颜色。
  - **像素级编辑**：点击任意豆子即可修改其颜色。
  - **可见性切换**：隐藏特定颜色，便于分层查看或统计数量。
- **📏 高级导出**：
  - **完整图纸**：下载带有坐标网格的完整高清图纸。
  - **分块导出**：自动将大尺寸作品（如 200x200）切割成适合打印或拼装的小块（ZIP 压缩包），并保留对齐参考线。
- **📝 材料管理**：实时计算所需豆子数量和色号清单。
- **🌍 双语界面**：完全本地化的 **英文** 和 **中文** 界面支持。

## 🛠 技术栈

- **前端框架**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **AI 集成**: [Google GenAI SDK](https://ai.google.dev/) (Gemini)
- **样式库**: Tailwind CSS (自定义新拟态系统)
- **工具库**: JSZip, File-Saver

## 🚀 快速开始

按照以下步骤在本地运行 PerlerGen。

### 前置要求

- **Node.js** (推荐 v16 或更高版本)
- **npm** 或 **yarn**
- 一个有效的 [Google Gemini API Key](https://aistudio.google.com/)

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/yourusername/PerlerGen.git
   cd PerlerGen
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   在项目根目录创建一个 `.env` 文件，并填入您的 Gemini API Key：
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   ```
   在浏览器中打开 [http://localhost:3000](http://localhost:3000)。

## 📦 生产环境构建

如需构建生产环境代码：

```bash
npm run build
```

构建产物将输出到 `dist` 目录，可直接部署到 Vercel、Netlify 或 GitHub Pages。

## 🤝 贡献指南

欢迎提交贡献！如果您有新功能建议或发现了 Bug：

1. Fork 本仓库。
2. 创建新的分支 (`git checkout -b feature/AmazingFeature`)。
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)。
4. 推送到分支 (`git push origin feature/AmazingFeature`)。
5. 提交 Pull Request。

## 📄 开源协议

本项目仅供个人学习和非商业用途使用。

---


