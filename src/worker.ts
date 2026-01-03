import {
  ExecutionContext,
  D1Database,
  Fetcher,
  Request,
} from "@cloudflare/workers-types";

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

interface LogData {
  action: string;
  details?: any;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // API endpoint for manual logging
    // Frontend can call POST /api/log with { action: "...", details: "..." }
    if (url.pathname === "/api/log" && request.method === "POST") {
      return handleLog(request, env);
    }
    // 添加统计接口
    if (url.pathname === "/api/stats" && request.method === "GET") {
      return handleStats(env);
    }

    // 继续处理请求
    // 注意：这里返回的 Response 类型是 Workers 运行时的 Response，不是 @cloudflare/workers-types 中的 Response
    //@ts-ignore
    return await env.ASSETS.fetch(request);
  },
};

async function handleLog(request: Request, env: Env): Promise<Response> {
  try {
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = request.headers.get("user-agent") || "";
    // @ts-ignore - cf property exists on Request in Workers
    const country = request.cf?.country || "unknown";
    const timestamp = new Date().toISOString();
    // const url = new URL(request.url);

    // let action = `path: ${url.pathname}`;
    let action = "";
    let details = "";

    try {
      const body = (await request.json()) as LogData;
      // if (body.action) action = `${action} | ${body.action}`;
      if (body.action) action = `${body.action}`;
      if (body.details) {
        details =
          typeof body.details === "string"
            ? body.details
            : JSON.stringify(body.details);
      }
    } catch (e) {
      // Body parsing failed, use defaults
    }

    // Store log entry in activity_logs
    await env.DB.prepare(
      `INSERT INTO activity_logs (timestamp, ip, country, user_agent, action, details) VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(timestamp, ip, country, userAgent, action, details)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to log request:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function handleStats(env: Env): Promise<Response> {
  try {
    // 获取今日日期 (UTC)
    const today = new Date().toISOString().split("T")[0];

    // 查询总访问次数 (action = 'page_view')
    const totalQuery = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM activity_logs WHERE TRIM(action) = 'page_view'"
    ).first();

    // 查询今日访问次数
    const todayQuery = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM activity_logs WHERE TRIM(action) = 'page_view' AND date(timestamp) = ?"
    )
      .bind(today)
      .first();

    return new Response(
      JSON.stringify({
        total: totalQuery?.count || 0,
        today: todayQuery?.count || 0,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          // 允许跨域
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
