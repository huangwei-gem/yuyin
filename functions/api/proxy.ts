export async function onRequest(context) {
  const { request } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio");
    const question = formData.get("question") || "";
    const interviewId = formData.get("interviewId") || "";
    const qOrder = formData.get("questionOrder") || "1";
    const totalQ = formData.get("totalQuestions") || "5";
    const name = formData.get("candidateName") || "Anonymous";
    const pos = formData.get("position") || "general";
    
    // Credentials from form data (frontend sends them)
    const appId = formData.get("appId") || "cli_aab083cfebf8dce7";
    const appSecret = formData.get("appSecret") || "vkEtRGulqjNoyFnXuQSnjbzoKxqpcKl8";
    const baseToken = formData.get("baseToken") || "E9dCbLvXtawJtNsrhticbE1pnOd";
    const tableId = formData.get("tableId") || "tbl0G4d8VNOGS15z";
    const qaTableId = formData.get("qaTableId") || "tblRdpIVEQIh97Gs";

    if (!audioFile) {
      return new Response(JSON.stringify({ success: false, error: "No audio file" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Step 1: Get Feishu token
    const tokenResp = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret })
    });
    const tokenData = await tokenResp.json();
    if (tokenData.code !== 0) {
      return new Response(JSON.stringify({ success: false, error: "Token error: code=" + tokenData.code + " msg=" + (tokenData.msg || "?") }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const token = tokenData.tenant_access_token;

    // Step 2: Create interview record (first question only)
    if (qOrder === "1") {
      const posName = pos === "frontend" ? "\u524d\u7aef\u5f00\u53d1" : pos === "backend" ? "\u540e\u7aef\u5f00\u53d1" : "\u901a\u7528\u9762\u8bd5";
      await fetch("https://open.feishu.cn/open-apis/bitable/v1/apps/" + baseToken + "/tables/" + tableId + "/records", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: {
          "\u9762\u8bd5ID": interviewId,
          "\u5019\u9009\u4eba": name,
          "\u804c\u4f4d": posName,
          "\u603b\u9898\u6570": parseInt(totalQ) || 5,
          "\u72b6\u6001": "\u8fdb\u884c\u4e2d",
          "\u521b\u5efa\u65f6\u95f4": new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
        }})
      });
    }

    // Step 3: Upload audio
    const audioBuffer = await audioFile.arrayBuffer();
    const fileName = "interview-" + interviewId + "-q" + qOrder + ".webm";
    const uploadForm = new FormData();
    uploadForm.append("file_name", fileName);
    uploadForm.append("parent_type", "bitable_file");
    uploadForm.append("parent_node", baseToken);
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

    // Step 4: Add QA record - use Feishu drive URL
    var fileUrl = "https://ywwlaii6ga7.feishu.cn/drive/medias/" + fileToken;
    const qaResp = await fetch("https://open.feishu.cn/open-apis/bitable/v1/apps/" + baseToken + "/tables/" + qaTableId + "/records", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: {
        "\u9762\u8bd5ID": interviewId,
        "\u9898\u76ee": question,
        "\u9898\u53f7": String(qOrder),
        "\u5f55\u97f3": [{ "file_token": fileToken }]
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