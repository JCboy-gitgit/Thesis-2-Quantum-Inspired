# RL Scheduler Integration Guide

## Quick Start

The RL augmentation system lets your QIA scheduler **learn from custom rules** over time.

### 1. Add RL Routes to Your FastAPI App

In `my-app/backend/main.py`, add these imports at the top:

```python
from rl_api import rl_router, integrate_rl_with_qia
```

Then register the router with your FastAPI app:

```python
# Add this after creating the FastAPI app
app.include_router(rl_router)

# Connect RL to your existing QIA scheduler
integrate_rl_with_qia(run_enhanced_scheduler)
```

### 2. How It Works

```
┌─ QIA generates base schedule
│
├─ RL evaluates against custom rules
│  ├─ Rule 1: No Friday afternoons? ✓/✗
│  ├─ Rule 2: Teacher lunch 12-1? ✓/✗
│  └─ Rule 3: Room clustering? ✓/✗
│
├─ Assigns reward/punishment
│
└─ Agent learns which placements work best
   (over multiple training episodes)
```

---

## API Endpoints

### Register a Custom Rule
```bash
POST /api/rl/rules/add
{
  "rule_id": "no_friday_afternoon",
  "name": "No Friday Afternoons",
  "description": "Avoid scheduling classes after 3 PM on Friday",
  "penalty": 200
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Rule 'No Friday Afternoons' added successfully",
  "rule_id": "no_friday_afternoon"
}
```

---

### Train the Agent
```bash
POST /api/rl/train
{
  "classes": [
    {"id": "cs101", "name": "Intro to CS", "capacity_needed": 30},
    {"id": "cs102", "name": "Data Structures", "capacity_needed": 25}
  ],
  "rooms": [
    {"id": "r101", "capacity": 50, "type": "lecture"},
    {"id": "r102", "capacity": 40, "type": "lecture"},
    {"id": "lab1", "capacity": 20, "type": "lab"}
  ],
  "time_slots": [
    "monday_08:00", "monday_09:00", "tuesday_08:00", "tuesday_09:00",
    "wednesday_08:00", "wednesday_09:00", "thursday_08:00", "thursday_09:00",
    "friday_08:00", "friday_09:00"
  ],
  "iterations": 10
}
```

**Response:**
```json
{
  "episode": 1,
  "avg_reward": 150.5,
  "agent_stats": {
    "q_table_size": 25,
    "experience_buffer_size": 10,
    "exploration_rate": 0.2,
    "learning_rate": 0.1
  }
}
```

---

### Get RL-Optimized Schedule
```bash
POST /api/rl/schedule/learned
{
  "classes": [...],
  "rooms": [...],
  "time_slots": [...]
}
```

**Response:**
```json
{
  "status": "success",
  "schedule": {
    "cs101": ["r101", "monday_08:00"],
    "cs102": ["r102", "tuesday_09:00"],
    "lab1": ["lab1", "wednesday_10:00"]
  },
  "timestamp": "2024-05-07T10:30:00"
}
```

---

### View Training Progress
```bash
GET /api/rl/stats
```

**Response:**
```json
{
  "episodes_trained": 5,
  "avg_reward": 180.25,
  "best_reward": 250.0,
  "worst_reward": 50.0,
  "agent_stats": {
    "q_table_size": 150,
    "experience_buffer_size": 500,
    "exploration_rate": 0.2,
    "learning_rate": 0.1
  }
}
```

---

### List All Rules
```bash
GET /api/rl/rules
```

**Response:**
```json
{
  "count": 3,
  "rules": [
    {
      "rule_id": "no_friday_afternoon",
      "name": "No Friday Afternoons",
      "description": "Avoid scheduling classes after 3 PM on Friday",
      "penalty": 200
    },
    {
      "rule_id": "teacher_lunch",
      "name": "Teacher Lunch Break",
      "description": "Ensure teachers have break 12-1 PM",
      "penalty": 150
    },
    {
      "rule_id": "room_clustering",
      "name": "Room Clustering",
      "description": "Group classes in same room to reduce campus movement",
      "penalty": 100
    }
  ]
}
```

---

### Get Training History
```bash
GET /api/rl/training-history?limit=10
```

---

### Reset Agent (Clear Learning)
```bash
POST /api/rl/reset
```

---

## Example Workflow

### Step 1: Add Custom Rules
```bash
# Define your custom obstacle/rules
curl -X POST http://localhost:8000/api/rl/rules/add \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": "no_7am",
    "name": "No Early Morning",
    "description": "No classes before 8 AM",
    "penalty": 300
  }'

curl -X POST http://localhost:8000/api/rl/rules/add \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": "max_2consecutive",
    "name": "Max 2 Consecutive Hours",
    "description": "No class longer than 2 hours",
    "penalty": 250
  }'
```

### Step 2: Train the Agent
```bash
# Run 5 training episodes to learn these rules
for i in {1..5}; do
  curl -X POST http://localhost:8000/api/rl/train \
    -H "Content-Type: application/json" \
    -d '{
      "classes": [{"id": "c1", "name": "Class 1", "capacity_needed": 30}],
      "rooms": [{"id": "r1", "capacity": 50, "type": "lecture"}],
      "time_slots": ["monday_08:00", "monday_10:00", "tuesday_08:00", "tuesday_10:00"],
      "iterations": 5
    }'
done
```

### Step 3: Generate RL-Optimized Schedule
```bash
# Get schedule that respects learned rules
curl -X POST http://localhost:8000/api/rl/schedule/learned \
  -H "Content-Type: application/json" \
  -d '{
    "classes": [{"id": "c1", "name": "Class 1", "capacity_needed": 30}],
    "rooms": [{"id": "r1", "capacity": 50, "type": "lecture"}],
    "time_slots": ["monday_08:00", "monday_10:00", "tuesday_08:00", "tuesday_10:00"]
  }'
```

### Step 4: Monitor Learning
```bash
# Check agent progress
curl http://localhost:8000/api/rl/stats
curl http://localhost:8000/api/rl/training-history
```

---

## Hardware Requirements

✅ **Your i3 10th gen + 20GB RAM:** Perfect for this!
- Q-Learning table is lightweight (JSON-based)
- No deep neural networks needed
- Experience buffer stays under 1MB
- Local training takes seconds per episode

✅ **Render Free Tier:** Should work but with caveats
- Avoid very large training runs (use local training instead)
- Cold starts might interrupt long training sessions
- Better to do training locally, deploy inference

---

## Extending with Custom Rule Checkers

The built-in rules are simplified. To add real rule checking:

```python
from rl_scheduler import CustomRule

def check_no_friday_afternoon(schedule: Dict) -> bool:
    """Return True if rule is violated."""
    for class_id, (room_id, time_slot) in schedule.items():
        day, time = time_slot.split("_")
        hour = int(time.split(":")[0])
        
        # Violation: Friday (day=4) after 3 PM (hour >= 15)
        if day == "friday" and hour >= 15:
            return True
    return False

rule = CustomRule(
    rule_id="no_friday_afternoon",
    name="No Friday Afternoons",
    description="No classes Friday after 3 PM",
    penalty=200,
    check_fn=check_no_friday_afternoon
)
```

---

## Performance Tips

1. **Start with 5-10 training episodes** to see if rules are being learned
2. **Monitor avg_reward** - should increase over episodes (rule violations decrease)
3. **Use experience replay** - improves learning with limited data
4. **Reduce exploration_rate after learning** - switch from exploring to exploiting
5. **Save agent state** - persist Q-table to database for long-term learning

---

## Troubleshooting

**Q: Agent reward isn't improving**
- A: Increase penalty values for violated rules
- A: Make sure your check_fn functions are correct
- A: Train for more episodes

**Q: Schedule ignoring my rules**
- A: Check that rules are registered with /api/rl/rules endpoint
- A: Verify rule check_fn returns True when rule is violated

**Q: Too slow on Render**
- A: Train locally, then save/load agent Q-table
- A: Reduce iterations and episode count

