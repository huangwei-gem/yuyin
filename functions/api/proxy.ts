// Cloudflare Pages Functions - proxy for Feishu API
// Environment variables set via wrangler.toml or Pages dashboard:
// LARK_APP_ID, LARK_APP_SECRET, LARK_BASE_TOKEN, LARK_TABLE_ID, LARK_QA_TABLE_ID

export async function onRequest(context) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400"
  };

  // Handle OPTIONS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    // Parse form data from the frontend
    const formData = await request.formData();
    const audioFile = formData.get("audio");
    const question = formData.get("question") || "";
    const interviewId = formData.get("interviewId") || "";
    const questionOrder = formData.get("questionOrder") || "1";
    const totalQuestions = formData.get("totalQuestions") || "5";
    const candidateName = formData.get("candidateName") || "Anonymous";
    const position = formData.get("position") || "general";

    // Validate required env vars
    if (!env.LARK_APP_ID || !env.LARK_APP_SECRET || !env.LARK_BASE_TOKEN || !env.LARK_TABLE_ID || !env.LARK_QA_TABLE_ID) {
      return new Response(JSON.stringify({ success: false, error: "Missing env config" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Step 1: Get tenant access token
    const tokenResp = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: env.LARK_APP_ID, app_secret: env.LARK_APP_SECRET })
    });
    const tokenData = await tokenResp.json();
    if (tokenData.code !== 0) {
      return new Response(JSON.stringify({ success: false, error: "Token error: " + tokenData.msg }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    var token = tokenData.tenant_access_token;
    var baseToken = env.LARK_BASE_TOKEN;

    // Step 2: Create or find interview record (fire and forget - first time)
    // We check if this is a new interview by seeing if the audio file name starts with "q1"
    if (questionOrder === "1") {
      var posName = position === "frontend" ? "前端开发" : position === "backend" ? "后端开发" : "通用面试";
      var createResp = await fetch("https://open.feishu.cn/open-apis/bitable/v1/apps/" + baseToken + "/tables/" + env.LARK_TABLE_ID + "/records", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: {
          "面试ID": interviewId,
          "候选人": candidateName,
          "职位": posName,
          "总题数": parseInt(totalQuestions) || 5,
          "状态": "进行中",
          "创建时间": new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
        }})
      });
      await createResp.json();
    }

    // Step 3: Upload audio to Feishu Drive
    var audioBuffer = await audioFile.arrayBuffer();
    var fileName = "interview-" + interviewId + "-q" + questionOrder + ".webm";

    var uploadForm = new FormData();
    uploadForm.append("file_name", fileName);
    uploadForm.append("parent_type", "bitable_file");
    uploadForm.append("parent_node", baseToken);
    uploadForm.append("size", String(audioBuffer.byteLength));
    uploadForm.append("file", new Blob([audioBuffer], { type: "audio/webm" }), fileName);

    var uploadResp = await fetch("https://open.feishu.cn/open-apis/drive/v1/medias/upload_all", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: uploadForm
    });
    var uploadData = await uploadResp.json();
    if (uploadData.code !== 0) {
      return new Response(JSON.stringify({ success: false, error: "Upload error: " + JSON.stringify(uploadData) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    var fileToken = uploadData.data.file_token;

    // Step 4: Add record to QA table with audio file token
    var qaResp = await fetch("https://open.feishu.cn/open-apis/bitable/v1/apps/" + baseToken + "/tables/" + env.LARK_QA_TABLE_ID + "/records", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: {
        "面试ID": interviewId,
        "题目": question,
        "题号": String(questionOrder),
        "录音": fileToken
      }})
    });
    var qaData = await qaResp.json();
    if (qaData.code !== 0) {
      return new Response(JSON.stringify({ success: false, error: "QA record error: " + JSON.stringify(qaData) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true, fileToken: fileToken }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}