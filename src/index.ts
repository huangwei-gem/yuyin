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
  AUDIO_BUCKET: R2Bucket
  DB: D1Database
}

type Bindings = Env

// ── App ──────────────────────────────────────────
const app = new Hono<{ Bindings: Bindings }>()
app.use('/*', cors())

// 用于生成随机会话 ID (简易 uuid v4)
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

  await c.env.DB.prepare(
    'INSERT INTO interviews (id, candidate_name, position) VALUES (?, ?, ?)'
  ).bind(interviewId, candidateName, position).run()

  // 写入面试题目
  const stmt = c.env.DB.prepare(
    'INSERT INTO qa_records (id, interview_id, question, question_order) VALUES (?, ?, ?, ?)'
  )
  for (let i = 0; i < questions.length; i++) {
    await stmt.bind(genId(), interviewId, questions[i], i + 1).run()
  }

  return c.json({
    interviewId,
    totalQuestions: questions.length,
    firstQuestion: questions[0],
  })
})

// ── 3. 获取当前题目 ─────────────────────────────
app.get('/api/interviews/:id/current', async (c) => {
  const interviewId = c.req.param('id')

  // 获取第一个还没有回答的问题
  const qa = await c.env.DB.prepare(
    'SELECT id, question, question_order FROM qa_records WHERE interview_id = ? AND answer_audio_key IS NULL ORDER BY question_order ASC LIMIT 1'
  ).bind(interviewId).first<{ id: string; question: string; question_order: number }>()

  if (!qa) {
    // 没有未答题目 → 面试结束
    await c.env.DB.prepare(
      "UPDATE interviews SET status = 'completed', updated_at = datetime('now') WHERE id = ?"
    ).bind(interviewId).run()
    return c.json({ done: true })
  }

  return c.json({
    done: false,
    qaId: qa.id,
    question: qa.question,
    questionOrder: qa.question_order,
  })
})

// ── 4. 上传录音 ─────────────────────────────────
app.post('/api/interviews/:id/answer', async (c) => {
  const interviewId = c.req.param('id')
  const formData = await c.req.formData()
  const audioFile = formData.get('audio') as File | null
  const qaId = formData.get('qaId') as string

  if (!audioFile || !qaId) {
    return c.json({ error: '缺少音频文件或 qaId' }, 400)
  }

  // 上传到 R2
  const audioKey = interviews//.webm
  await c.env.AUDIO_BUCKET.put(audioKey, audioFile.stream(), {
    httpMetadata: { contentType: audioFile.type || 'audio/webm' },
  })

  // 更新数据库
  await c.env.DB.prepare(
    'UPDATE qa_records SET answer_audio_key = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).bind(audioKey, qaId).run()

  // 可选：用 Workers AI Whisper 做语音转写
  let transcript = ''
  try {
    const result = await c.env.AI.run('@cf/openai/whisper-tiny-en', {
      audio: [...new Uint8Array(await audioFile.arrayBuffer())],
    })
    transcript = result?.text || ''
    if (transcript) {
      await c.env.DB.prepare(
        'UPDATE qa_records SET answer_text = ? WHERE id = ?'
      ).bind(transcript, qaId).run()
    }
  } catch (e) {
    // Whisper 转写失败不阻塞流程
    console.error('Whisper transcription failed:', e)
  }

  return c.json({
    success: true,
    audioKey,
    transcript,
  })
})

// ── 5. 获取录音下载链接 ─────────────────────────
app.get('/api/audio/:key', async (c) => {
  const key = c.req.param('key')
  const obj = await c.env.AUDIO_BUCKET.get(key)
  if (!obj) return c.json({ error: '音频未找到' }, 404)

  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'audio/webm',
      'Content-Disposition': ttachment; filename="interview-",
    },
  })
})

// ── 6. 获取面试历史 ─────────────────────────────
app.get('/api/interviews/:id/history', async (c) => {
  const interviewId = c.req.param('id')

  const interview = await c.env.DB.prepare(
    'SELECT * FROM interviews WHERE id = ?'
  ).bind(interviewId).first()

  if (!interview) return c.json({ error: '面试不存在' }, 404)

  const qas = await c.env.DB.prepare(
    'SELECT * FROM qa_records WHERE interview_id = ? ORDER BY question_order ASC'
  ).bind(interviewId).all()

  return c.json({ interview, qas: qas.results })
})

// ── 7. 获取所有面试记录 ─────────────────────────
app.get('/api/interviews', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM interviews ORDER BY created_at DESC'
  ).all()
  return c.json({ interviews: results })
})

// ── Health Check ─────────────────────────────────
app.get('/api/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }))

export default app

