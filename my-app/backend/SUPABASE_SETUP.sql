-- ==================== TABLE CREATION ====================

-- Create table to store RL agent state
CREATE TABLE IF NOT EXISTS rl_agent_state (
  id BIGSERIAL PRIMARY KEY,
  agent_id TEXT UNIQUE NOT NULL DEFAULT 'main',
  q_table JSONB NOT NULL DEFAULT '{}',
  training_history JSONB DEFAULT '[]',
  episodes_trained INT DEFAULT 0,
  avg_reward FLOAT DEFAULT 0,
  best_reward FLOAT DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_rl_agent_id ON rl_agent_state(agent_id);

-- Enable Row Level Security (optional, for security)
ALTER TABLE rl_agent_state ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (for MVP, restrict later)
CREATE POLICY "Allow all operations on rl_agent_state" ON rl_agent_state
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);

-- ==================== COMMENTS ====================

COMMENT ON TABLE rl_agent_state IS 'Stores RL agent learning state for persistence across server restarts';
COMMENT ON COLUMN rl_agent_state.q_table IS 'Q-Learning table: {state_hash: {action_hash: q_value}}';
COMMENT ON COLUMN rl_agent_state.training_history IS 'Array of training episode results';
COMMENT ON COLUMN rl_agent_state.episodes_trained IS 'Total number of training episodes completed';
COMMENT ON COLUMN rl_agent_state.avg_reward IS 'Average reward across all episodes';
COMMENT ON COLUMN rl_agent_state.best_reward IS 'Best reward achieved in any episode';
