import { Hono } from 'hono'

// Questions bank
const QUESTIONS = {
  frontend: [
    "请解释一下React的虚拟DOM是如何工作的？",
    "你能说说CSS的盒模型是什么吗？",
    "什么是闭包？请举一个实际应用的例子。",
    "请解释一下Event Loop的机制。",
    "前端性能优化有哪些常用的手段？"
  ],
  backend: [
    "请解释一下RESTful API的设计原则。",
    "什么是数据库索引？它如何提高查询性能？",
    "请解释一下什么是微服务架构。",
    "如何设计一个高可用的系统？",
    "什么是CAP定理？请简要说明。"
  ],
  general: [
    "请做一个简单的自我介绍。",
    "你为什么想来我们公司？",
    "请分享一个你解决过的技术难题。",
    "你是如何处理工作中的压力的？",
    "你未来三年的职业规划是什么？"
  ]
}

// Feishu API helpers
async function getTenantToken(env) {
  const resp = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: env.LARK_APP_ID, app_secret: env.LARK_APP_SECRET })
  })
  const data = await resp.json()
  if (data.code !== 0) throw new Error("Token error: " + JSON.stringify(data))
  return data.tenant_access_token
}

async function addRecord(token, baseToken, tableId, fields) {
  const resp = await fetch("https://open.feishu.cn/open-apis/bitable/v1/apps/" + baseToken + "/tables/" + tableId + "/records", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  })
  const data = await resp.json()
  if (data.code !== 0) throw new Error("Add record error: " + JSON.stringify(data))
  return data.data.record.record_id
}

async function uploadAudio(token, baseToken, fileName, audioBuffer) {
  const formData = new FormData()
  formData.append("file_name", fileName)
  formData.append("parent_type", "bitable_file")
  formData.append("parent_node", baseToken)
  formData.append("size", String(audioBuffer.byteLength))
  formData.append("file", new Blob([audioBuffer], { type: "audio/webm" }), fileName)
  
  const resp = await fetch("https://open.feishu.cn/open-apis/drive/v1/medias/upload_all", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: formData
  })
  const data = await resp.json()
  if (data.code !== 0) throw new Error("Upload error: " + JSON.stringify(data))
  return data.data.file_token
}

// HTML template
function renderHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI 语音面试</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);color:#fff;min-height:100vh;display:flex;justify-content:center;align-items:center;}
.container{max-width:700px;width:100%;padding:24px;margin:20px;}
.card{background:rgba(255,255,255,0.08);backdrop-filter:blur(12px);border-radius:20px;padding:32px;border:1px solid rgba(255,255,255,0.1);}
h1{text-align:center;background:linear-gradient(90deg,#f7971e,#ffd200);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.btn{width:100%;padding:14px;border:none;border-radius:12px;cursor:pointer;background:linear-gradient(90deg,#f7971e,#ffd200);color:#1a1a2e;margin:8px 0;font-size:16px;font-weight:600;}
.btn:hover{transform:translateY(-1px);}
.btn:disabled{opacity:0.5;cursor:not-allowed;transform:none;}
.btn-danger{background:linear-gradient(90deg,#e74c3c,#c0392b);color:#fff;}
.record-btn{width:80px;height:80px;border-radius:50%;border:3px solid #f7971e;background:rgba(247,151,30,0.1);cursor:pointer;margin:12px auto;display:flex;align-items:center;justify-content:center;transition:all .3s;}
.record-btn:hover{border-color:#ffd200;background:rgba(247,151,30,0.2);}
.record-btn.recording{border-color:#e74c3c;animation:pulse 1.2s infinite;}
.record-btn.recording #ricon{background:#e74c3c;border-radius:50%;width:24px;height:24px;}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(231,76,60,0.4)}70%{box-shadow:0 0 0 20px rgba(231,76,60,0)}100%{box-shadow:0 0 0 0 rgba(231,76,60,0)}}
.step{display:none;}.step.active{display:block;}
.progress{display:flex;justify-content:center;gap:4px;margin:16px 0;}
.dot{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,0.15);}
.dot.done{background:#27ae60;}.dot.current{background:#f7971e;}
.toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);padding:12px 24px;border-radius:12px;z-index:999;display:none;backdrop-filter:blur(8px);}
.toast.show{display:block;}
select,input{width:100%;padding:12px;border-radius:8px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);margin:6px 0;font-size:15px;}
select option{background:#302b63;color:#fff;}
.question-box{background:rgba(255,255,255,0.05);padding:20px;margin:16px 0;border-left:4px solid #f7971e;border-radius:0 12px 12px 0;font-size:17px;line-height:1.7;}
#timer{font-size:2em;font-weight:700;margin:8px 0;}
.status-text{color:rgba(255,255,255,0.5);font-size:.85em;}
.spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#f7971e;border-radius:50%;animation:spin .8s linear infinite;margin-right:6px;vertical-align:middle;}
@keyframes spin{to{transform:rotate(360deg);}}
</style>
</head>
<body>
<div class="container"><div class="card">
<h1>&#127908; AI 语音面试</h1>
<p style="color:rgba(255,255,255,0.5);margin-bottom:20px;">录音直存飞书多维表格</p>
<div id="s1" class="step active">
  <label style="color:rgba(255,255,255,0.6);font-size:.9em;">职位类型</label>
  <select id="pos"><option value="frontend">前端开发</option><option value="backend">后端开发</option><option value="general" selected>通用面试</option></select>
  <label style="color:rgba(255,255,255,0.6);font-size:.9em;">姓名</label>
  <input type="text" id="name" value="Anonymous" placeholder="输入姓名">
  <button class="btn" onclick="startInterview()">开始面试</button>
</div>
<div id="s2" class="step">
  <div class="progress" id="dots"></div>
  <div class="question-box"><p id="qtext">加载中...</p></div>
  <div style="text-align:center;">
    <div class="record-btn" id="rbtn" onclick="toggleRec()"><div id="ricon" style="width:32px;height:32px;background:#f7971e;border-radius:4px;"></div></div>
    <div id="timer">00:00</div>
    <div class="status-text" id="status">点击录音</div>
  </div>
  <button class="btn" id="nextBtn" onclick="submitAnswer()" disabled>提交录音</button>
  <button class="btn btn-danger" onclick="endInterview()">结束面试</button>
</div>
<div id="s3" class="step" style="text-align:center;padding:20px;">
  <div style="font-size:3em;">&#127881;</div>
  <h2>面试完成！</h2>
  <p style="color:rgba(255,255,255,0.6);margin:12px 0;">录音已存入飞书</p>
  <a href="https://ywwlaii6ga7.feishu.cn/base/E9dCbLvXtawJtNsrhticbE1pnOd?table=tblRdpIVEQIh97Gs" target="_blank" style="color:#6b8cff;text-decoration:none;">查看飞书表格 &#8599;</a>
  <br><br>
  <button class="btn" onclick="location.reload()">再来一次</button>
</div>
</div></div>
<div class="toast" id="toast"></div>
<script>
const QUESTIONS = {
  frontend:["请解释一下React的虚拟DOM是如何工作的？","你能说说CSS的盒模型是什么吗？","什么是闭包？请举一个实际应用的例子。","请解释一下Event Loop的机制。","前端性能优化有哪些常用的手段？"],
  backend:["请解释一下RESTful API的设计原则。","什么是数据库索引？它如何提高查询性能？","请解释一下什么是微服务架构。","如何设计一个高可用的系统？","什么是CAP定理？请简要说明。"],
  general:["请做一个简单的自我介绍。","你为什么想来我们公司？","请分享一个你解决过的技术难题。","你是如何处理工作中的压力的？","你未来三年的职业规划是什么？"]
};
let step=0,qs=[],iid="",rec=null,chunks=[],isRec=false,ti=null,sec=0;
function $(id){return document.getElementById(id)}
function toast(m){var e=$("toast");e.textContent=m;e.classList.add("show");setTimeout(function(){e.classList.remove("show")},3000)}
function sw(id){document.querySelectorAll(".step").forEach(function(s){s.classList.remove("active")});$(id).classList.add("active")}
async function startInterview(){
  const p=$("pos").value,n=$("name").value||"Anonymous";
  qs=QUESTIONS[p]||QUESTIONS.general;iid=crypto.randomUUID();step=0;
  sw("s2");showQ();
  fetch("/api/interviews",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({interviewId:iid,position:p,candidateName:n,totalQuestions:qs.length})});
}
function showQ(){
  if(step>=qs.length){sw("s3");return}
  $("qtext").textContent=qs[step];renderDots();resetRec();$("nextBtn").disabled=true;
}
function renderDots(){
  var e=$("dots");e.innerHTML="";
  for(var i=0;i<qs.length;i++){var d=document.createElement("div");d.className="dot";if(i<step)d.classList.add("done");if(i===step)d.classList.add("current");e.appendChild(d)}
}
async function toggleRec(){if(isRec){stopRec()}else{await startRec()}}
async function startRec(){
  try{
    var s=await navigator.mediaDevices.getUserMedia({audio:true});
    chunks=[];rec=new MediaRecorder(s,{mimeType:'audio/webm;codecs=opus'});
    rec.ondataavailable=function(e){if(e.data.size>0)chunks.push(e.data)};
    rec.onstop=function(){s.getTracks().forEach(function(t){t.stop()});$("nextBtn").disabled=false};
    rec.start(250);isRec=true;
    $("rbtn").classList.add("recording");$("status").textContent="正在录音...";
    sec=0;updT();ti=setInterval(function(){sec++;updT()},1000);
  }catch(e){toast("请允许麦克风权限")}
}
function stopRec(){
  if(rec&&rec.state!=="inactive")rec.stop();
  isRec=false;$("rbtn").classList.remove("recording");$("status").textContent="已停止";clearInterval(ti);
}
function resetRec(){
  if(rec&&rec.state!=="inactive")rec.stop();
  isRec=false;$("rbtn").classList.remove("recording");$("status").textContent="点击录音";clearInterval(ti);sec=0;updT();chunks=[];
}
function updT(){var m=String(Math.floor(sec/60)).padStart(2,"0");var s=String(sec%60).padStart(2,"0");$("timer").textContent=m+":"+s}
async function submitAnswer(){
  if(chunks.length===0){toast("请先录音");return}
  var blob=new Blob(chunks,{type:"audio/webm"});
  if(blob.size<200){toast("录音太短");return}
  $("nextBtn").disabled=true;$("status").innerHTML='<span class="spinner"></span>上传飞书...';
  try{
    var fd=new FormData();
    fd.append("audio",blob,"q"+(step+1)+".webm");
    fd.append("question",qs[step]);fd.append("interviewId",iid);fd.append("questionOrder",String(step+1));
    var r=await fetch("/api/interviews/"+iid+"/answer",{method:"POST",body:fd});
    await r.json();
    toast("已保存到飞书!");step++;showQ();
  }catch(e){toast("上传失败");$("nextBtn").disabled=false;$("status").textContent="上传失败，重试"}
}
function endInterview(){if(confirm("确定结束？")){if(isRec)stopRec();sw("s3")}}
</script>
</body>
</html>`
}

const app = new Hono()

// Serve the HTML page
app.get("/", (c) => c.html(renderHTML()))

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }))

// Create interview record
app.post("/api/interviews", async (c) => {
  try {
    const { interviewId, position, candidateName, totalQuestions } = await c.req.json()
    const token = await getTenantToken(c.env)
    await addRecord(token, c.env.LARK_BASE_TOKEN, c.env.LARK_TABLE_ID, {
      "面试ID": interviewId,
      "候选人": candidateName || "Anonymous",
      "职位": position === "frontend" ? "前端开发" : position === "backend" ? "后端开发" : "通用面试",
      "总题数": totalQuestions || 5,
      "状态": "进行中",
      "创建时间": new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
    })
    return c.json({ success: true })
  } catch (e) {
    console.error("Create interview error:", e)
    return c.json({ success: false, error: e.message })
  }
})

// Submit answer with audio
app.post("/api/interviews/:id/answer", async (c) => {
  try {
    const iid = c.req.param("id")
    const formData = await c.req.formData()
    const audioFile = formData.get("audio")
    const question = formData.get("question") || ""
    const questionOrder = formData.get("questionOrder") || "1"
    
    if (!audioFile) {
      return c.json({ success: false, error: "No audio file" })
    }

    const token = await getTenantToken(c.env)
    const audioBuffer = await audioFile.arrayBuffer()
    const fileName = "interview-" + iid + "-q" + questionOrder + ".webm"
    
    // Upload audio to Feishu Drive
    const fileToken = await uploadAudio(token, c.env.LARK_BASE_TOKEN, fileName, audioBuffer)
    
    // Add record to QA table
    await addRecord(token, c.env.LARK_BASE_TOKEN, c.env.LARK_QA_TABLE_ID, {
      "面试ID": iid,
      "题目": question,
      "题号": String(questionOrder),
      "录音": fileToken
    })
    
    return c.json({ success: true, fileToken })
  } catch (e) {
    console.error("Answer error:", e)
    return c.json({ success: false, error: e.message })
  }
})

export default app