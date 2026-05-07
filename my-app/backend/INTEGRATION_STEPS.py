"""
Integration Steps - Add RL to main.py

Follow these steps to integrate the RL scheduler into your existing FastAPI backend.
"""

# ==================== STEP 1: Add Imports ====================
"""
In main.py, add these imports at the top (after existing imports):

    from rl_api import rl_router, integrate_rl_with_qia
"""

# ==================== STEP 2: Register RL Router ====================
"""
After your FastAPI app is created, register the RL router:

    app = FastAPI(...)
    app.include_router(cors_middleware_stuff...)

    # ADD THIS:
    app.include_router(rl_router)

    # Connect RL to your QIA scheduler
    integrate_rl_with_qia(run_enhanced_scheduler)
"""

# ==================== STEP 3: Full Integration Code ====================
"""
Here's what your main.py should look like (partial example):

---

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
# ... other imports ...

from scheduler_v2 import run_enhanced_scheduler
from rl_api import rl_router, integrate_rl_with_qia  # NEW

app = FastAPI(
    title="College Room Allocation API",
    description="Quantum-Inspired Optimization for Class Room Scheduling",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ADD RL ROUTER HERE:
app.include_router(rl_router)

# Connect RL to your QIA scheduler
integrate_rl_with_qia(run_enhanced_scheduler)

# ... rest of your endpoints ...

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

---
"""

# ==================== STEP 4: Test Integration ====================
"""
After integrating, test with:

1. Start your backend:
   cd my-app/backend
   python -m uvicorn main:app --reload --port 8000

2. Check RL endpoints are available:
   curl http://localhost:8000/docs
   # Look for /api/rl/* endpoints in the Swagger UI

3. Add a custom rule:
   curl -X POST http://localhost:8000/api/rl/rules/add \\
     -H "Content-Type: application/json" \\
     -d '{
       "rule_id": "test_rule",
       "name": "Test Rule",
       "description": "A test rule",
       "penalty": 100
     }'

4. Check rule was added:
   curl http://localhost:8000/api/rl/rules
"""

# ==================== STEP 5: Use Real Rule Checkers ====================
"""
The current implementation has dummy rule checkers. To make them work with
your actual schedule data:

Example: Check if any class violates the "no_friday_afternoon" rule

File: rl_scheduler.py

Find: create_no_friday_afternoon_rule()

Replace the check_fn with real logic:

    def check_no_friday_afternoon(schedule: Dict) -> bool:
        '''Return True if ANY class violates the rule.'''
        for class_id, (room_id, time_slot) in schedule.items():
            day, time = time_slot.split("_")

            # Violation if Friday after 3 PM
            if day == "friday":
                hour = int(time.split(":")[0])
                if hour >= 15:
                    return True
        return False

    return CustomRule(
        rule_id="no_friday_afternoon",
        name="No Friday Afternoons",
        description="Avoid scheduling classes after 3 PM on Friday",
        penalty=200,
        check_fn=check_no_friday_afternoon
    )
"""

# ==================== STEP 6: Monitor Learning ====================
"""
After training, you can monitor the agent's progress:

    # Get training stats
    curl http://localhost:8000/api/rl/stats

    # See all training episodes
    curl http://localhost:8000/api/rl/training-history?limit=20

    # View all registered rules
    curl http://localhost:8000/api/rl/rules
"""

# ==================== STEP 7: Deploy to Render ====================
"""
When deploying to Render:

1. Update requirements.txt (already has numpy, should be fine):
   - Verify numpy is in my-app/backend/requirements.txt

2. No special configuration needed for RL:
   - RL runs in-memory on Render free tier
   - No external dependencies required

3. Optional: Save agent state to database for persistence
   - Store Q-table as JSON in Supabase
   - Load on startup to resume learning
"""
