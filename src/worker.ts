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
    // 记录简单请求
    return await handleLog(request, env);
  },
};

async function handleLog(request: Request, env: Env): Promise<Response> {
  try {
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = request.headers.get("user-agent") || "";
    // @ts-ignore - cf property exists on Request in Workers
    const country = request.cf?.country || "unknown";
    const timestamp = new Date().toISOString();

    let action = "unknown";
    let details = "";

    try {
      const body = (await request.json()) as LogData;
      if (body.action) action = body.action;
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
