-- 面试记录表
CREATE TABLE IF NOT EXISTS interviews (
  id TEXT PRIMARY KEY,
  candidate_name TEXT NOT NULL DEFAULT 'Anonymous',
  position TEXT NOT NULL DEFAULT 'General',
  status TEXT NOT NULL DEFAULT 'in_progress',  -- in_progress | completed
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 问答记录表
CREATE TABLE IF NOT EXISTS qa_records (
  id TEXT PRIMARY KEY,
  interview_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer_audio_key TEXT,          -- R2 中的音频文件 key
  answer_text TEXT,                -- Whisper 转写后的文本（可选）
  question_order INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_qa_interview_id ON qa_records(interview_id);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
