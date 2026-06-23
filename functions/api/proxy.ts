export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const target = url.searchParams.get("url");

  if (!target || !target.startsWith("https://open.feishu.cn/open-apis/")) {
    return new Response(JSON.stringify({ error: "invalid request" }), {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }

  // Preflight
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
    const contentType = request.headers.get("Content-Type") || "";

    let fetchOpts = {
      method: request.method,
      headers: {}
    };

    // For FormData (file uploads), we need special handling
    if (contentType.includes("multipart/form-data")) {
      // Parse the incoming multipart form data
      const formData = await request.formData();
      
      // Build new FormData with proper boundary for Feishu
      const newForm = new FormData();
      for (const [key, value] of formData.entries()) {
        newForm.append(key, value);
      }
      fetchOpts.body = newForm;
      // Don't set Content-Type for FormData - browser/fetch will set boundary automatically
    } else if (contentType.includes("application/json")) {
      fetchOpts.headers["Content-Type"] = "application/json";
      const bodyText = await request.text();
      fetchOpts.body = bodyText;
    } else {
      // Pass through as-is
      fetchOpts.body = request.body;
    }

    // Only pass Authorization header
    const auth = request.headers.get("Authorization");
    if (auth) fetchOpts.headers["Authorization"] = auth;

    const resp = await fetch(target, fetchOpts);
    const body = await resp.text();

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
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
    });
  }
}
