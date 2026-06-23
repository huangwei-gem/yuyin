const fs = require("fs");
const proxy = `
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  
  if (!target || !target.startsWith("https://open.feishu.cn/open-apis/")) {
    return new Response(JSON.stringify({error: "invalid request"}), {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }

  // OPTIONS 预检请求直接返回
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400"
      }
    });
  }

  try {
    // 重新构造请求 - 不直接透传 headers，避免 boundary 问题
    var reqHeaders = new Headers();
    
    // 只保留 Authorization
    var auth = request.headers.get("Authorization");
    if (auth) reqHeaders.set("Authorization", auth);
    
    // 对于 JSON 请求，保留 Content-Type
    var ct = request.headers.get("Content-Type");
    if (ct && ct.includes("application/json")) {
      reqHeaders.set("Content-Type", "application/json");
    }
    // FormData 请求不要手动设置 Content-Type（让浏览器自动处理 boundary）

    var resp = await fetch(target, {
      method: request.method,
      headers: reqHeaders,
      body: request.body,
    });
    
    var body = await resp.text();
    return new Response(body, {
      status: resp.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
`;
fs.writeFileSync("functions/api/proxy.ts", proxy.trim(), "utf8");
console.log("OK");