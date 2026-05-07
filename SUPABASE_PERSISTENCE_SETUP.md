# Supabase Setup Guide - RL Agent Persistence

Complete step-by-step guide to save your RL agent learning to Supabase.

## Why This Matters

Without persistence:
- ❌ Learning disappears when Render restarts
- ❌ Must retrain from scratch every 15 minutes (Render free tier)
- ❌ No progress saved

With persistence:
- ✅ Learning survives server restarts
- ✅ Agent continues improving over time
- ✅ Training state always preserved

## Step 1: Create Supabase Table

### Option A: Using Supabase Dashboard (Easy)

1. Log in to [supabase.com](https://supabase.com)
2. Open your project
3. Go to **SQL Editor** tab
4. Click **New Query**
5. Copy this SQL and paste it:

```sql
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

CREATE INDEX IF NOT EXISTS idx_rl_agent_id ON rl_agent_state(agent_id);

ALTER TABLE rl_agent_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on rl_agent_state" ON rl_agent_state
  AS PERMISSIVE FOR ALL
  USING (true)
  WITH CHECK (true);
```

6. Click **Run** button
7. ✅ Table created!

### Option B: Using SQL File (Copy-Paste)

1. Open `backend/SUPABASE_SETUP.sql`
2. Copy all the SQL
3. Go to Supabase SQL Editor
4. Paste and Run

## Step 2: Verify Table Was Created

1. In Supabase, go to **Table Editor**
2. Look for **rl_agent_state** table in left sidebar
3. You should see columns:
   - id
   - agent_id
   - q_table
   - training_history
   - episodes_trained
   - avg_reward
   - best_reward
   - updated_at
   - created_at

✅ If you see all columns, table is ready!

## Step 3: Get Your Supabase Credentials

You already have these in your `.env.local`, but verify:

1. In Supabase project settings
2. Go to **API** section
3. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Your `.env.local` should already have:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
```

## Step 4: Update Backend Files

### File 1: `backend/main.py`

Add these imports at the top:
```python
from rl_api import rl_router, integrate_rl_with_qia, initialize_persistence
from rl_persistence import RLStatePersistence
```

Add these functions before the `if __name__ == "__main__":` line:

```python
@app.on_event("startup")
async def startup_rl():
    """Load RL agent state from Supabase on startup"""
    try:
        supabase = get_supabase_client()
        if supabase:
            initialize_persistence(supabase)
            from rl_api import rl_engine, rl_persistence
            print("[RL] Loading agent state from Supabase...")
            loaded = await rl_persistence.load_agent_state(rl_engine)
            if loaded:
                print("[RL] Agent state restored from database")
            else:
                print("[RL] Starting with fresh agent")
    except Exception as e:
        print(f"[RL] Warning: Could not load agent state: {e}")


@app.on_event("shutdown")
async def shutdown_rl():
    """Save RL agent state to Supabase on shutdown"""
    try:
        from rl_api import rl_engine, rl_persistence
        if rl_persistence.supabase:
            print("[RL] Saving agent state to Supabase...")
            await rl_persistence.save_agent_state(rl_engine)
            print("[RL] Agent state saved successfully")
    except Exception as e:
        print(f"[RL] Warning: Could not save agent state: {e}")
```

Also make sure you have:
```python
app.include_router(rl_router)
integrate_rl_with_qia(run_enhanced_scheduler)
```

## Step 5: Test Locally

1. Start backend:
```bash
cd my-app/backend
python -m uvicorn main:app --reload --port 8000
```

2. Watch the output for:
```
[RL] Loading agent state from Supabase...
[RL] Starting with fresh agent
```

3. Start frontend:
```bash
cd my-app
npm run dev
```

4. Go to RL Dashboard at `http://localhost:3000/LandingPages/RLScheduler`

5. Add a rule and train:
   - Go to **Rules** tab
   - Add test rule
   - Go to **Train** tab
   - Click "🚀 Start Training"
   - Wait for completion

6. Check Supabase:
   - Go to Supabase **Table Editor**
   - Click **rl_agent_state** table
   - You should see 1 row with your agent data!
   - **q_table** will have JSON data
   - **episodes_trained** will show number

✅ If you see the data, persistence is working!

## Step 6: Test Persistence

1. Stop the backend (Ctrl+C)
2. Wait a moment
3. You should see:
```
[RL] Saving agent state to Supabase...
[RL] Agent state saved successfully
```

4. Restart the backend:
```bash
python -m uvicorn main:app --reload --port 8000
```

5. You should see:
```
[RL] Loading agent state from Supabase...
[RL] Agent state restored from database
```

✅ If you see "restored", persistence is working perfectly!

## Step 7: Deploy to Render

Make sure your backend on Render has the updated files:

```bash
git add backend/rl_persistence.py
git add backend/rl_api.py
git add backend/main.py  # Your changes
git commit -m "Add RL persistence to Supabase"
git push
```

Render will auto-deploy. Watch logs:
```
[RL] Loading agent state from Supabase...
[RL] Agent state restored from database
```

## How It Works

### On Startup:
```
Backend starts
    ↓
Load Supabase client
    ↓
Query rl_agent_state table for saved Q-table
    ↓
Deserialize and restore agent memory
    ↓
Agent continues where it left off
    ✅ Training continues!
```

### After Training:
```
Training completes
    ↓
Serialize Q-table to JSON
    ↓
Save to Supabase
    ↓
Next startup will load this state
    ✅ Learning preserved!
```

### On Server Restart (Render):
```
Render restarts backend (every 15 min inactivity)
    ↓
Startup handler runs
    ↓
Loads latest Q-table from Supabase
    ↓
Agent has all previous learning
    ✅ No progress lost!
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Supabase not configured" | Make sure .env.local has NEXT_PUBLIC_SUPABASE_URL |
| Table not found error | Check if table was created (see Step 2) |
| Data not saving | Check if startup/shutdown handlers are in main.py |
| "permission denied" | Check Row Level Security is enabled (should be by default) |
| Data keeps resetting | Make sure you didn't call /api/rl/reset endpoint |

## Verify Everything

### Backend Logs Check:
```
Should see these lines on startup:
[RL] Loading agent state from Supabase...

Should see on training:
[RL] Agent state restored from database

Should see on shutdown:
[RL] Saving agent state to Supabase...
[RL] Agent state saved successfully
```

### Supabase Table Check:
```
1. Open Table Editor
2. Click rl_agent_state
3. Should have rows with:
   - agent_id: "main"
   - q_table: (long JSON object)
   - episodes_trained: (number)
   - avg_reward: (float)
```

### Test Save/Load:
```
1. Train agent for 5 episodes
2. Check Supabase (should have new data)
3. Restart backend
4. Check logs (should see "restored")
5. Go to Stats tab
6. Should see previous training history!
```

## Files Changed

```
backend/
├── main.py                  ← ADD: startup/shutdown handlers
├── rl_api.py               ← UPDATED: save after training
├── rl_persistence.py       ← NEW: persistence logic
├── SUPABASE_SETUP.sql      ← NEW: table creation
└── MAIN_PY_INTEGRATION.py  ← NEW: reference

Supabase:
└── rl_agent_state table    ← NEW: created via SQL
```

## Next Steps

1. ✅ Create table in Supabase
2. ✅ Add code to main.py
3. ✅ Test locally
4. ✅ Verify data saves to Supabase
5. ✅ Deploy to Render
6. ✅ Monitor learning persistence

**Your RL agent now learns forever! 🚀**

---

## Advanced: Custom Agent IDs

If you want multiple agents (e.g., different rooms, departments):

```python
# In rl_api.py, change:
rl_persistence.agent_id = "cs_department"  # or any string

# Then each agent gets separate Q-table:
# rl_agent_state (agent_id: "main")
# rl_agent_state (agent_id: "cs_department")
# rl_agent_state (agent_id: "math_department")
```

Each one learns independently!

---

## Support

If you get stuck:
1. Check backend logs: `python -m uvicorn main:app --reload`
2. Check Supabase logs: Supabase Dashboard → Logs
3. Check network: Make sure backend can reach Supabase
4. Verify SQL: Make sure table exists with all columns

**You've got this! 💪**
