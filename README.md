# AI 语音面试 Demo

基于 Cloudflare Workers 生态的在线语音面试工具。

## 架构

\\\
用户浏览器 ──► Cloudflare Pages ──► Workers (Hono)
                        │                    │
                        │              ┌─────┴──────┐
                        │           D1 数据库    R2 存储
                        │         (面试记录)   (音频文件)
                        │
                   Workers AI (Whisper 语音转写)
\\\

## 功能

- 选择面试职位（前端/后端/通用），各 5 道预设题
- 浏览器录音（MediaRecorder），回答后上传
- 录音自动保存到 Cloudflare R2（永久存储）
- 支持在线播放录音
- 使用 Workers AI Whisper 自动语音转写（可选）

## 本地开发

### 前置条件

- Node.js 18+
- Cloudflare 账户

### 1. 安装依赖

\\\ash
cd ai-interview-demo
npm install
\\\

### 2. 创建资源

\\\ash
# 登录 Cloudflare
npx wrangler login

# 创建 D1 数据库
npx wrangler d1 create ai-interview-db

# 创建 R2 Bucket
npx wrangler r2 bucket create ai-interview-audio
\\\

### 3. 更新配置

创建好 D1 数据库后，把输出的 \database_id\ 填入 \wrangler.toml\：

\\\	oml
[[d1_databases]]
binding = ""DB""
database_name = ""ai-interview-db""
database_id = ""xxxx-xxxx-xxxx-xxxx""  # 替换成实际的 database_id
\\\

### 4. 初始化数据库

\\\ash
npm run db:init
\\\

### 5. 本地运行

\\\ash
npm run dev
\\\

打开 http://localhost:8787 即可使用。

### 6. 部署到生产

\\\ash
npm run deploy
\\\

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/positions | 获取面试职位列表 |
| POST | /api/interviews | 创建面试会话 |
| GET | /api/interviews/:id/current | 获取当前题目 |
| POST | /api/interviews/:id/answer | 上传录音回答 |
| GET | /api/interviews/:id/history | 获取面试历史 |
| GET | /api/interviews | 获取所有面试记录 |
| GET | /api/audio/:key | 获取录音文件 |

## 免费额度

全部运行在 Cloudflare 免费计划下：

- **Workers**: 每天 100,000 请求（完全够用）
- **D1**: 免费 5GB 存储
- **R2**: 免费 10GB 存储 + 每月 1000 万次读取
- **Workers AI**: 每天 10,000 次推理（Whisper 转写用）

## 注意事项

- 浏览器需支持 MediaRecorder API（Chrome/Firefox/Edge 均可）
- 录音格式为 WebM Opus，体积小，适合网络传输
- Whisper 转写失败不会阻塞录音保存流程
