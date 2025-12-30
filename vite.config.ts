import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: "./", // 设置基础路径，确保构建后可以使用相对路径访问
    server: {
      port: 3002,
      host: "0.0.0.0",
    },
    plugins: [react()],
    define: {
      // 注入环境变量，解决 process.env 在浏览器端 undefined 的问题
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(process.cwd(), "src"), // 使用 process.cwd() 替代 __dirname
      },
    },
    build: {
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: false,
      // 确保构建产物可以正常运行
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
  };
});
