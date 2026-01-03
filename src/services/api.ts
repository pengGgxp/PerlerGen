export interface StatsResponse {
  total: number;
  today: number;
}

export const ApiService = {
  /**
   * 获取访问统计数据
   * @returns Promise<StatsResponse>
   */
  getStats: async (): Promise<StatsResponse | null> => {
    try {
      const response = await fetch("/api/stats", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data as StatsResponse;
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      return null;
    }
  },

  /**
   * 记录日志 (封装 logger.ts 的功能，统一管理)
   * @param action 操作名称
   * @param details 详细信息
   */
  log: async (action: string, details?: any) => {
    try {
      await fetch("/api/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, details }),
      });
    } catch (error) {
      console.warn("Failed to send log:", error);
    }
  },
};
