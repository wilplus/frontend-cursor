-- ============================================================================
-- Focus questions: clone of warm-up tasks (pool + per-student list)
-- Run after base v2 schema (auth.users exists).
-- Backend repo path: migrations/v2_focus_questions.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS v2_focus_question_pool (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  text TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  max_performance_score DECIMAL(3,2) DEFAULT 1.00 CHECK (max_performance_score >= 0 AND max_performance_score <= 1),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_focus_question_pool_order ON v2_focus_question_pool(order_index);

CREATE TABLE IF NOT EXISTS v2_focus_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  pool_question_id UUID REFERENCES v2_focus_question_pool(id) ON DELETE SET NULL,
  max_performance_score DECIMAL(3,2) DEFAULT 1.00 CHECK (max_performance_score >= 0 AND max_performance_score <= 1),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_focus_questions_user ON v2_focus_questions(user_id);
