/**
 * 前端日志服务
 * 用于将操作记录发送到后端 Worker 进行存储
 */

interface LogPayload {
  action: string;
  details?: any;
}

export const Logger = {
  /**
   * 记录用户操作
   * @param action 操作名称 (如: 'export_pattern', 'click_button')
   * @param details 详细信息 (可选, 支持对象)
   */
  log: async (action: string, details?: any) => {
    try {
      // 在开发环境下，可能需要配置 Vite 代理，或者直接忽略错误
      // 生产环境下，请求会发送给同域名的 Worker
      await fetch("/api/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, details }),
      });
    } catch (error) {
      // 记录日志失败不应影响用户主要操作，仅在控制台输出警告
      console.warn("Failed to send log:", error);
    }
  },
};
