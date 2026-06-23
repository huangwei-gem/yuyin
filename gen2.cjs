const fs = require("fs");
const b64 = fs.readFileSync("static/index.html", "base64");

const worker = `
import { Hono } from "hono"

const HTML_B64 = "${b64}"

const QB = {
  frontend: ["请解释一下React的虚拟DOM是如何工作的？","你能说说CSS的盒模型是什么吗？","什么是闭包？请举一个实际应用的例子。","请解释一下Event Loop的机制。","前端性能优化有哪些常用的手段？"],
  backend: ["请解释一下RESTful API的设计原则。","什么是数据库索引？它如何提高查询性能？","请解释一下什么是微服务架构。","如何设计一个高可用的系统？","什么是CAP定理？请简要说明。"],
  general: ["请做个简单的自我介绍。","你为什么想来我们公司？","请分享一个你解决过的技术难题。","你是如何处理工作中的压力的？","你未来三年的职业规划是什么？"]
}

async function gtk(a, s) {
  var r = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({app_id:a,app_secret:s})})
  var d = await r.json()
  return d.tenant_access_token
}

async function up(t, fn, buf) {
  var f = new FormData()
  f.append("file_name", fn)
  f.append("parent_type", "bitable_file")
  f.append("parent_node", "E9dCbLvXtawJtNsrhticbE1pnOd")
  f.append("size", String(buf.byteLength))
  f.append("file", new Blob([buf], {type:"audio/webm"}), fn)
  var r = await fetch("https://open.feishu.cn/open-apis/drive/v1/medias/upload_all", {method:"POST",headers:{Authorization:"Bearer "+t},body:f})
  var d = await r.json()
  return d.data.file_token
}

async function ar(t, ti, fd) {
  var r = await fetch("https://open.feishu.cn/open-apis/bitable/v1/apps/E9dCbLvXtawJtNsrhticbE1pnOd/tables/"+ti+"/records", {method:"POST",headers:{Authorization:"Bearer "+t,"Content-Type":"application/json"},body:JSON.stringify({fields:fd})})
  var d = await r.json()
  return d.data.record.record_id
}

var app = new Hono()
app.use("/*", async (c, next) => { c.res.headers.set("Access-Control-Allow-Origin", "*"); await next() })

app.get("/", (c) => c.html(Buffer.from(HTML_B64, "base64").toString()))

app.get("/api/positions", (c) => c.json({positions: Object.keys(QB).map(k => ({id:k, name:k==="frontend"?"前端开发":k==="backend"?"后端开发":"通用面试"}))}))

app.post("/api/interviews", async (c) => {
  var b = await c.req.json()
  var p = b.position||"general", n = b.candidateName||"Anonymous"
  var qs = QB[p]||QB.general, id = crypto.randomUUID()
  try {
    var t = await gtk(c.env.AID, c.env.ASEC)
    await ar(t, c.env.TI, {"面试ID":id,"候选人":n,"职位":p==="frontend"?"前端开发":p==="backend"?"后端开发":"通用面试","总题数":qs.length,"状态":"进行中","创建时间":new Date().toLocaleString("zh-CN",{timeZone:"Asia/Shanghai"})})
  } catch(e) {}
  return c.json({interviewId:id, totalQuestions:qs.length, firstQuestion:qs[0], questions:qs})
})

var pg = {}
app.post("/api/interviews/:id/start", async (c) => {
  var id = c.req.param("id"), b = await c.req.json()
  pg[id] = {i:0, q:b.questions}
  return c.json({done:false, qaId:id+"-q0", question:b.questions[0], questionOrder:1})
})

app.get("/api/interviews/:id/current", (c) => {
  var id = c.req.param("id"), p = pg[id]
  if(!p||p.i>=p.q.length) return c.json({done:true})
  return c.json({done:false, qaId:id+"-q"+p.i, question:p.q[p.i], questionOrder:p.i+1})
})

app.post("/api/interviews/:id/answer", async (c) => {
  var iid = c.req.param("id")
  var fd = await c.req.formData()
  var af = fd.get("audio")
  var pid = pg[iid]; if(pid) pid.i++
  var ft = "", ts = ""
  try {
    var t = await gtk(c.env.AID, c.env.ASEC)
    var buf = await af.arrayBuffer()
    ft = await up(t, "interview-"+iid+"-q"+pid.i+".webm", buf)
    await ar(t, c.env.TQ, {"面试ID":iid,"题目":fd.get("question"),"题号":String(pid.i),"录音":ft})
    try { var r = await c.env.AI.run("@cf/openai/whisper", {audio:[...new Uint8Array(buf)]}); ts = r.text||"" } catch(e) {}
  } catch(e) {}
  return c.json({success:true, fileToken:ft, transcript:ts, done:pid?pid.i>=pid.q.length:false})
})

app.get("/api/audio/:fileToken", async (c) => {
  var ft = c.req.param("fileToken")
  try {
    var t = await gtk(c.env.AID, c.env.ASEC)
    var r = await fetch("https://open.feishu.cn/open-apis/drive/v1/medias/"+ft+"/download", {headers:{Authorization:"Bearer "+t}})
    return new Response(r.body, {headers:{"Content-Type":"audio/webm"}})
  } catch(e) { return c.json({error:e.message}, 500) }
})

app.get("/api/health", (c) => c.json({status:"ok"}))

export default app
`;

fs.writeFileSync("src/index.ts", worker, "utf8");
console.log("OK size=" + worker.length);