const fs = require("fs");
let html = fs.readFileSync("static/index.html", "utf8");

// 把直接调飞书 API 的代码改成通过反代
// 原始 URL: https://open.feishu.cn/open-apis/...
// 改成: /api/proxy?url=https://open.feishu.cn/open-apis/...

// 替换 gtk 函数中的 API 调用
html = html.replace(
  'fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"',
  'fetch("/api/proxy?url=https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"'
);

// 替换 upload 函数中的 API 调用
html = html.replace(
  'fetch("https://open.feishu.cn/open-apis/drive/v1/medias/upload_all"',
  'fetch("/api/proxy?url=https://open.feishu.cn/open-apis/drive/v1/medias/upload_all"'
);

// 替换 addRec 函数中的 API 调用
html = html.replace(
  'fetch("https://open.feishu.cn/open-apis/bitable/v1/apps/"',
  'fetch("/api/proxy?url=https://open.feishu.cn/open-apis/bitable/v1/apps/"'
);

fs.writeFileSync("static/index.html", html, "utf8");
console.log("OK");