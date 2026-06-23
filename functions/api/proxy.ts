// 飞书 API 反代 - 解决 CORS 问题
// 前端调 /api/proxy?url=xxx 即可绕过 CORS

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  
  if (!target) {
    return new Response(JSON.stringify({error: "missing url param"}), {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }

  // 只允许飞书 API
  if (!target.startsWith("https://open.feishu.cn/open-apis/")) {
    return new Response(JSON.stringify({error: "invalid target"}), {
      status: 403,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }

  try {
    const resp = await fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
    });
    
    const body = await resp.text();
    return new Response(body, {
      status: resp.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Content-Type": resp.headers.get("Content-Type") || "application/json"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({error: e.message}), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }
}