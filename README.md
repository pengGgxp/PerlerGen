<div align="center">

# PerlerGen

**A Smart, AI-Powered Pixel Art & Bead Pattern Generator**

[![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

[English](./README.md) | [简体中文](./README_zh.md)

</div>

---

## 📖 Introduction

**PerlerGen** is a modern web application designed for bead artists and pixel art enthusiasts. It seamlessly converts images into professional bead patterns, supporting major brands like Perler, Artkal, and Hama.

Built with a soft, tactile **Neumorphic UI**, it offers a distraction-free environment for creativity. Leveraging **Google Gemini AI**, PerlerGen not only generates patterns but also analyzes them to provide difficulty ratings, descriptions, and usage suggestions.

## ✨ Key Features

- **🎨 Smart Conversion**: High-fidelity image-to-pixel conversion with adjustable grid sizes and aspect ratio locking.
- **🧩 Multi-Brand Support**: Native support for **Perler**, **Artkal (S-Series)**, **Hama**, and generic color palettes.
- **🤖 AI Analysis**: Integrated **Google Gemini AI** provides insights on pattern difficulty and creative usage ideas.
- **🛠️ Precision Editing**:
  - **Global Color Replacement**: Swap a color across the entire pattern instantly.
  - **Pixel-Level Editing**: Click any bead to change its color.
  - **Visibility Toggles**: Hide specific colors to focus on layers or counts.
- **📏 Advanced Export**:
  - **Full Chart**: Download the complete pattern with coordinates.
  - **Split Export**: Automatically slice large projects (e.g., 200x200) into printable chunks (ZIP archive) with alignment guides.
- **📝 Material Management**: Real-time calculation of bead counts and color codes.
- **🌍 Bilingual Interface**: Fully localized for **English** and **Chinese**.

## 🛠 Tech Stack

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **AI Integration**: [Google GenAI SDK](https://ai.google.dev/) (Gemini)
- **Styling**: Tailwind CSS (Custom Neumorphic System)
- **Utilities**: JSZip, File-Saver

## 🚀 Getting Started

Follow these steps to run PerlerGen locally on your machine.

### Prerequisites

- **Node.js** (v16 or higher recommended)
- **npm** or **yarn**
- A valid [Google Gemini API Key](https://aistudio.google.com/)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/PerlerGen.git
   cd PerlerGen
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Run the Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📦 Build for Production

To create a production-ready build:

```bash
npm run build
```

The output will be in the `dist` directory, ready to be deployed to Vercel, Netlify, or GitHub Pages.

## 🤝 Contributing

Contributions are welcome! If you have ideas for new features or bug fixes:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## 📄 License

This project is available for personal and educational use.

---

