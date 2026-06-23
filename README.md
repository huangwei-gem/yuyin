# AI 语音面试 Demo - 飞书版

基于 Cloudflare Workers 的在线语音面试工具，录音自动保存到**飞书多维表格**。

## 架构

```
浏览器 (录音) ──► Cloudflare Workers (Hono) ──► 飞书开放 API
                                         │
                                    Workers AI (Whisper 转写)
```

- 不需要 R2（不用绑卡）
- 不需要 D1数据库
- 录音直接上传飞书云盘 + 写入多维表格

## 功能

- 选择面试职位（前端/后端/通用），各 5 道预设题
- 浏览器录音（MediaRecorder），回答后自动上传
- 录音自动存入飞书云盘，记录写入飞书多维表格
- 支持在线回放录音
- Workers AI Whisper 自动语音转写

## 部署前准备

### 1. 创建飞书应用

1. 打开 https://open.feishu.cn/app 创建企业自建应用
2. 添加能力：**多维表格**
3. 发布应用，获取 App ID 和 App Secret
4. 权限管理中开启：
   - `bitable:app`
   - `drive:drive`

### 2. 创建多维表格

在飞书创建一个多维表格，包含以下字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| 面试ID | 文本 | 自动生成 |
| 候选人 | 文本 | 候选人名字 |
| 职位 | 文本 | 面试职位 |
| 总题数 | 数字 | 题目总数 |
| 状态 | 文本 | 进行中/已完成 |
| 创建时间 | 文本 | 面试开始时间 |

再创建第二个表（或另一个多维表格），字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| 面试ID | 文本 | 关联面试 |
| 题目 | 文本 | 题目内容 |
| 题号 | 数字 | 题目序号 |
| 录音 | 附件 | 录音文件 |

3. 从多维表格 URL 中获取 `base_token`（URL 中间那段 ID）
4. 从表设置中获取 `table_id`

### 3. 配置 Cloudflare Secrets

```bash
npx wrangler secret put LARK_APP_ID       # 飞书应用 App ID
npx wrangler secret put LARK_APP_SECRET   # 飞书应用 App Secret
npx wrangler secret put LARK_BASE_TOKEN   # 多维表格 base_token
npx wrangler secret put LARK_TABLE_ID     # 数据表 table_id
```

## 部署

```bash
npm install
npx wrangler login
npx wrangler deploy
```

打开输出的 `.workers.dev` 链接即可使用。

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/positions | 获取面试职位列表 |
| POST | /api/interviews | 创建面试会话 |
| POST | /api/interviews/:id/start | 初始化面试进度 |
| GET | /api/interviews/:id/current | 获取当前题目 |
| POST | /api/interviews/:id/answer | 上传录音（存飞书） |
| GET | /api/audio/:fileToken | 从飞书获取录音 |

## 免费额度

- **Workers**: 每天 100,000 请求
- **Workers AI**: 每天 10,000 次推理（Whisper 转写）
- **飞书开放平台**: 免费
- **不需要绑卡**