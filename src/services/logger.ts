/**
 * 前端日志服务
 * 用于将操作记录发送到后端 Worker 进行存储
 */

import { ApiService } from "./api";

export const Logger = {
  /**
   * 记录用户操作
   * @param action 操作名称 (如: 'export_pattern', 'click_button')
   * @param details 详细信息 (可选, 支持对象)
   */
  log: async (action: string, details?: any) => {
    // 委托给 ApiService 处理
    await ApiService.log(action, details);
  },
};
