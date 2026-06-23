import { Hono } from 'hono'
import { cors } from 'hono/cors'

// ── 预设面试题 ──────────────────────────────────
const QUESTION_BANK: Record<string, string[]> = {
  frontend: [
    '请解释一下 React 的虚拟 DOM 是如何工作的？',
    '你能说说 CSS 的盒模型是什么吗？',
    '什么是闭包？请举一个实际应用的例子。',
    '请解释一下 Event Loop 的机制。',
    '前端性能优化有哪些常用的手段？',
  ],
  backend: [
    '请解释一下 RESTful API 的设计原则。',
    '什么是数据库索引？它如何提高查询性能？',
    '请解释一下什么是微服务架构。',
    '如何设计一个高可用的系统？',
    '什么是 CAP 定理？请简要说明。',
  ],
  general: [
    '请做个简单的自我介绍。',
    '你为什么想来我们公司？',
    '请分享一个你解决过的技术难题。',
    '你是如何处理工作中的压力的？',
    '你未来三年的职业规划是什么？',
  ],
}

// ── 环境类型 ────────────────────────────────────
interface Env {
  AI: { run: (model: string, input: any) => Promise<any> }
  // 飞书应用配置（从 Workers Secrets 注入）
  LARK_APP_ID: string
  LARK_APP_SECRET: string
  LARK_BASE_TOKEN: string    // 多维表格 base_token
  LARK_TABLE_ID: string      // 多维表格的数据表 ID
}

// ── 飞书 API 工具 ──────────────────────────────
async function getTenantAccessToken(appId: string, appSecret: string): Promise<string> {
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  })
  const data: any = await res.json()
  if (data.code !== 0) throw new Error(`飞书 token 获取失败: ${data.msg}`)
  return data.tenant_access_token
}

async function uploadToFeishuDrive(
  token: string,
  fileName: string,
  fileBuffer: ArrayBuffer,
  parentType: string,
  parentNode: string,
): Promise<string> {
  const formData = new FormData()
  formData.append('file_name', fileName)
  formData.append('parent_type', parentType)
  formData.append('parent_node', parentNode)
  formData.append('size', String(fileBuffer.byteLength))
  formData.append('file', new File([fileBuffer], fileName, { type: 'audio/webm' }))

  const res = await fetch('https://open.feishu.cn/open-apis/drive/v1/medias/upload_all', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const data: any = await res.json()
  if (data.code !== 0) throw new Error(`飞书文件上传失败: ${data.msg}`)
  return data.data.file_token
}

async function addRecordToBase(
  token: string,
  baseToken: string,
  tableId: string,
  fields: Record<string, any>,
): Promise<string> {
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${baseToken}/tables/${tableId}/records`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    },
  )
  const data: any = await res.json()
  if (data.code !== 0) throw new Error(`飞书写入记录失败: ${data.msg}`)
  return data.data.record.record_id
}

async function updateRecordFields(
  token: string,
  baseToken: string,
  tableId: string,
  recordId: string,
  fields: Record<string, any>,
): Promise<void> {
  const res = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${baseToken}/tables/${tableId}/records/${recordId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    },
  )
  const data: any = await res.json()
  if (data.code !== 0) throw new Error(`飞书更新记录失败: ${data.msg}`)
}

// ── App ──────────────────────────────────────────
const app = new Hono<{ Bindings: Env }>()
app.use('/*', cors())

function genId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// ── 1. 获取面试职位列表 ─────────────────────────
app.get('/api/positions', (c) => {
  return c.json({
    positions: Object.keys(QUESTION_BANK).map((key) => ({
      id: key,
      name: key === 'frontend' ? '前端开发' : key === 'backend' ? '后端开发' : '通用面试',
    })),
  })
})

// ── 2. 创建面试会话 ─────────────────────────────
app.post('/api/interviews', async (c) => {
  const { position = 'general', candidateName = 'Anonymous' } = await c.req.json()
  const questions = QUESTION_BANK[position] || QUESTION_BANK.general
  const interviewId = genId()

  // 写入飞书多维表格 - 创建面试记录行
  const token = await getTenantAccessToken(c.env.LARK_APP_ID, c.env.LARK_APP_SECRET)

  const fieldValue: Record<string, any> = {
    '面试ID': interviewId,
    '候选人': candidateName,
    '职位': position === 'frontend' ? '前端开发' : position === 'backend' ? '后端开发' : '通用面试',
    '总题数': questions.length,
    '状态': '进行中',
    '创建时间': new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
  }

  await addRecordToBase(token, c.env.LARK_BASE_TOKEN, c.env.LARK_TABLE_ID, fieldValue)

  return c.json({
    interviewId,
    totalQuestions: questions.length,
    firstQuestion: questions[0],
    questions,
  })
})

// ── 3. 获取当前题目（从内存中轮询，不依赖数据库） ──
// 用内存 Map 存储面试进度（Workers 冷启动会丢失，但一次面试流程够用）
const interviewProgress = new Map<string, { currentIndex: number; questions: string[] }>()

app.post('/api/interviews/:id/start', async (c) => {
  const interviewId = c.req.param('id')
  const { questions } = await c.req.json() as { questions: string[] }

  interviewProgress.set(interviewId, { currentIndex: 0, questions })

  return c.json({
    done: false,
    qaId: `${interviewId}-q0`,
    question: questions[0],
    questionOrder: 1,
  })
})

app.get('/api/interviews/:id/current', async (c) => {
  const interviewId = c.req.param('id')
  const progress = interviewProgress.get(interviewId)

  if (!progress || progress.currentIndex >= progress.questions.length) {
    return c.json({ done: true })
  }

  return c.json({
    done: false,
    qaId: `${interviewId}-q${progress.currentIndex}`,
    question: progress.questions[progress.currentIndex],
    questionOrder: progress.currentIndex + 1,
  })
})

// ── 4. 上传录音并写入飞书多维表格 ────────────────
app.post('/api/interviews/:id/answer', async (c) => {
  const interviewId = c.req.param('id')
  const formData = await c.req.formData()
  const audioFile = formData.get('audio') as File | null
  const qaId = formData.get('qaId') as string
  const questionText = formData.get('question') as string
  const questionOrder = formData.get('order') as string

  if (!audioFile || !qaId) {
    return c.json({ error: '缺少音频文件或 qaId' }, 400)
  }

  // 更新面试进度
  const progress = interviewProgress.get(interviewId)
  if (progress) {
    progress.currentIndex++
  }

  let fileToken = ''
  let transcript = ''

  try {
    // 获取飞书 token
    const token = await getTenantAccessToken(c.env.LARK_APP_ID, c.env.LARK_APP_SECRET)

    // 上传音频到飞书云盘
    const audioBuffer = await audioFile.arrayBuffer()
    fileToken = await uploadToFeishuDrive(
      token,
      `interview-${interviewId}-q${questionOrder || '0'}.webm`,
      audioBuffer,
      'bitable_file',
      c.env.LARK_BASE_TOKEN,
    )

    // 写入多维表格 - 每一题一条记录
    const fieldValue: Record<string, any> = {
      '面试ID': interviewId,
      '题目': questionText || '',
      '题号': questionOrder ? Number(questionOrder) : 0,
      '录音': fileToken,
    }

    await addRecordToBase(token, c.env.LARK_BASE_TOKEN, c.env.LARK_TABLE_ID, fieldValue)

    // 可选：用 Workers AI Whisper 做语音转写
    try {
      const result = await c.env.AI.run('@cf/openai/whisper-tiny-en', {
        audio: [...new Uint8Array(audioBuffer)],
      })
      transcript = result?.text || ''
    } catch (e) {
      // Whisper 转写失败不阻塞
      console.error('Whisper failed:', e)
    }
  } catch (e: any) {
    console.error('飞书 API 错误:', e.message || e)
    // 飞书写入失败不阻塞面试流程
  }

  // 检查是否面试结束
  const isDone = progress ? progress.currentIndex >= progress.questions.length : false

  return c.json({
    success: true,
    fileToken,
    transcript,
    done: isDone,
  })
})

// ── 5. 获取音频下载链接（从飞书云盘） ────────────
app.get('/api/audio/:fileToken', async (c) => {
  const fileToken = c.req.param('fileToken')

  try {
    const token = await getTenantAccessToken(
      c.env.LARK_APP_ID,
      c.env.LARK_APP_SECRET,
    )

    const res = await fetch(
      `https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download`,
      { headers: { Authorization: `Bearer ${token}` } },
    )

    if (!res.ok) {
      return c.json({ error: '音频获取失败' }, 404)
    }

    const blob = await res.blob()
    return new Response(blob, {
      headers: {
        'Content-Type': 'audio/webm',
        'Content-Disposition': `attachment; filename="interview-${fileToken}.webm"`,
      },
    })
  } catch (e: any) {
    return c.json({ error: `获取失败: ${e.message}` }, 500)
  }
})

// ── Health Check ─────────────────────────────────
app.get('/api/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }))

export default app