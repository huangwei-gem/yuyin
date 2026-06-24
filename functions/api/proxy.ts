export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Debug endpoint - check env vars
  const url = new URL(request.url);
  if (url.pathname === "/api/debug") {
    const keys = Object.keys(env).filter(k => k.startsWith("LARK_"));
    const status = {};
    keys.forEach(k => { status[k] = env[k] ? "SET (" + env[k].substring(0, 4) + "..." : "MISSING"; });
    return new Response(JSON.stringify({ env: status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Test token endpoint
  if (url.pathname === "/api/test-token") {
    const tokenResp = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: env.LARK_APP_ID, app_secret: env.LARK_APP_SECRET })
    });
    const tokenData = await tokenResp.json();
    return new Response(JSON.stringify(tokenData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    // Check env vars
    const required = ["LARK_APP_ID", "LARK_APP_SECRET", "LARK_BASE_TOKEN", "LARK_TABLE_ID", "LARK_QA_TABLE_ID"];
    const missing = required.filter(k => !env[k]);
    if (missing.length > 0) {
      return new Response(JSON.stringify({ success: false, error: "Missing env: " + missing.join(",") }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const formData = await request.formData();
    const audioFile = formData.get("audio");
    if (!audioFile) {
      return new Response(JSON.stringify({ success: false, error: "No audio file" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const question = formData.get("question") || "";
    const interviewId = formData.get("interviewId") || "";
    const questionOrder = formData.get("questionOrder") || "1";
    const totalQuestions = formData.get("totalQuestions") || "5";
    const candidateName = formData.get("candidateName") || "Anonymous";
    const position = formData.get("position") || "general";

    // Step 1: Get Feishu tenant token
    const tokenResp = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: env.LARK_APP_ID, app_secret: env.LARK_APP_SECRET })
    });
    const tokenData = await tokenResp.json();
    if (tokenData.code !== 0) {
      return new Response(JSON.stringify({ success: false, error: "Token error: code=" + tokenData.code + " msg=" + (tokenData.msg || "unknown") }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const token = tokenData.tenant_access_token;

    // Step 2: Create interview record (only on first question)
    if (questionOrder === "1") {
      const posName = position === "frontend" ? "\u524d\u7aef\u5f00\u53d1" : position === "backend" ? "\u540e\u7aef\u5f00\u53d1" : "\u901a\u7528\u9762\u8bd5";
      await fetch("https://open.feishu.cn/open-apis/bitable/v1/apps/" + env.LARK_BASE_TOKEN + "/tables/" + env.LARK_TABLE_ID + "/records", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: {
          "\u9762\u8bd5ID": interviewId,
          "\u5019\u9009\u4eba": candidateName,
          "\u804c\u4f4d": posName,
          "\u603b\u9898\u6570": parseInt(totalQuestions) || 5,
          "\u72b6\u6001": "\u8fdb\u884c\u4e2d",
          "\u521b\u5efa\u65f6\u95f4": new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
        }})
      });
    }

    // Step 3: Upload audio to Feishu Drive
    const audioBuffer = await audioFile.arrayBuffer();
    const fileName = "interview-" + interviewId + "-q" + questionOrder + ".webm";

    const uploadForm = new FormData();
    uploadForm.append("file_name", fileName);
    uploadForm.append("parent_type", "bitable_file");
    uploadForm.append("parent_node", env.LARK_BASE_TOKEN);
    uploadForm.append("size", String(audioBuffer.byteLength));
    uploadForm.append("file", new Blob([audioBuffer], { type: "audio/webm" }), fileName);

    const uploadResp = await fetch("https://open.feishu.cn/open-apis/drive/v1/medias/upload_all", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: uploadForm
    });
    const uploadData = await uploadResp.json();
    if (uploadData.code !== 0) {
      return new Response(JSON.stringify({ success: false, error: "Upload error: " + JSON.stringify(uploadData) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const fileToken = uploadData.data.file_token;

    // Step 4: Add QA record
    const qaResp = await fetch("https://open.feishu.cn/open-apis/bitable/v1/apps/" + env.LARK_BASE_TOKEN + "/tables/" + env.LARK_QA_TABLE_ID + "/records", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: {
        "\u9762\u8bd5ID": interviewId,
        "\u9898\u76ee": question,
        "\u9898\u53f7": String(questionOrder),
        "\u5f55\u97f3": fileToken
      }})
    });
    const qaData = await qaResp.json();
    if (qaData.code !== 0) {
      return new Response(JSON.stringify({ success: false, error: "QA error: " + JSON.stringify(qaData) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true, fileToken }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: "Exception: " + e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}