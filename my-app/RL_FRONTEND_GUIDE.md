# RL Scheduler UI - Frontend Setup Guide

## What's Included

**New RL Scheduler Dashboard** with 4 interactive tabs:
1. **📋 Rules** - Add and manage custom scheduling rules
2. **🤖 Train Agent** - Start training the RL agent
3. **📊 Statistics** - Monitor learning progress
4. **📅 Compare** - Compare QIA vs RL approaches

## Installation Steps

### 1. Files Created

```
my-app/app/LandingPages/RLScheduler/
├── page.tsx              (Main component)
└── RLScheduler.module.css (Styling)
```

### 2. Access the Dashboard

Once the backend is running, navigate to:
```
http://localhost:3000/LandingPages/RLScheduler
```

Or add a menu link (see step 3).

### 3. Add Navigation Link (Optional)

To add a link in your main navigation menu, find your `MenuBar.tsx` or navigation component and add:

```tsx
<Link href="/LandingPages/RLScheduler">
  🤖 RL Scheduler
</Link>
```

### 4. Environment Setup

Make sure your `.env.local` has the backend URL:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
# Or for production:
NEXT_PUBLIC_BACKEND_URL=https://thesis-2-quantum-inspired.onrender.com
```

## How to Use the Dashboard

### Step 1: Add Custom Rules

1. Go to the **📋 Rules** tab
2. Fill in the form:
   - **Rule ID**: unique identifier (e.g., `no_friday_afternoon`)
   - **Name**: human-readable name
   - **Description**: what the rule enforces
   - **Penalty**: how much to punish violations (1-1000)
3. Click **+ Add Rule**

**Example Rules:**
- No classes before 8 AM (penalty: 250)
- No Friday afternoons (penalty: 200)
- Max 2 consecutive hours (penalty: 180)

### Step 2: Train the Agent

1. Go to **🤖 Train Agent** tab
2. Click **🚀 Start Training (5 episodes)**
3. Watch the progress bar fill up
4. Training runs 5 episodes automatically

The agent learns from sample schedules how to respect your rules!

### Step 3: Monitor Progress

1. Go to **📊 Statistics** tab
2. View real-time metrics:
   - Episodes trained
   - Average reward (should increase over time)
   - Learning progress chart
   - Agent configuration

**What to look for:**
- ✅ Reward should increase after each training
- ✅ Q-Table size grows (more learned states)
- ✅ Experience buffer fills up

### Step 4: Understand the System

1. Go to **📅 Compare** tab
2. See how QIA and RL work together:
   - QIA: Fast, optimal for hard constraints
   - RL: Smart, learns your soft preferences
   - Together: Best of both worlds!

## Features

### Real-time Training
- Visual progress bar during training
- Live stat updates
- Training history graph

### Rule Management
- Add unlimited custom rules
- Set different penalty weights
- View all registered rules

### Learning Visualization
- Reward progression chart
- Agent statistics dashboard
- Training episode history

### Educational
- Built-in examples and tips
- Clear explanations of how RL works
- Comparison with traditional QIA

## API Integration

The UI automatically connects to your backend at:
- `GET /api/rl/rules` - Get registered rules
- `POST /api/rl/rules/add` - Add new rule
- `POST /api/rl/train` - Train agent
- `GET /api/rl/stats` - Get statistics
- `GET /api/rl/training-history` - Get history
- `POST /api/rl/reset` - Reset agent

## Tips for Best Results

1. **Start Simple**
   - Begin with 2-3 rules
   - Gradually add more

2. **Set Meaningful Penalties**
   - Important rules: 200-250
   - Secondary rules: 100-150
   - Nice-to-have: 50-100

3. **Train Multiple Times**
   - First training: ~5 episodes
   - Refinement: 2-3 more runs
   - Agent improves with more data

4. **Monitor Rewards**
   - Rewards should trend upward
   - If stuck at 0, rules might not be triggering
   - Increase penalties if needed

## Troubleshooting

**Q: Dashboard won't load**
- A: Make sure backend is running (`python -m uvicorn main:app --reload`)
- A: Check NEXT_PUBLIC_BACKEND_URL in .env.local

**Q: "Error adding rule"**
- A: Ensure rule_id is unique
- A: Fill all required fields
- A: Check backend is reachable

**Q: Reward stays at 0**
- A: Rules' check_fn functions need implementation
- A: See backend RL_INTEGRATION_GUIDE.md for details

**Q: Training takes too long**
- A: Normal - first training learns the pattern
- A: Subsequent trainings are faster
- A: Can interrupt and try again

## Deployment

### To Vercel (Frontend)
No additional setup needed - just deploy your Next.js app as usual.

### To Render (Backend)
Make sure backend RL routes are enabled (see backend INTEGRATION_STEPS.py)

## What's Next?

1. **Implement Real Rule Checkers**
   - Backend: Edit check_fn functions in rl_scheduler.py
   - Add actual logic to detect rule violations

2. **Persist Learning**
   - Save Q-table to database
   - Load on startup for continuous learning

3. **Advanced Monitoring**
   - Export training data
   - Analyze rule effectiveness
   - Optimize penalties

4. **Integration with Scheduling**
   - Use RL-learned schedules in production
   - A/B test QIA vs RL approaches
   - Gather user feedback

---

**Happy scheduling! 🚀**
