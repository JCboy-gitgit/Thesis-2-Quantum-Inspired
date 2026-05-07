"""
main.py Integration - Add Supabase Persistence

Copy this code into your main.py to load/save RL state on startup/shutdown
"""

# ==================== ADD THESE IMPORTS ====================

from rl_api import rl_router, integrate_rl_with_qia, initialize_persistence
from rl_persistence import RLStatePersistence
from database import get_supabase_client  # Your existing database import


# ==================== ADD THESE STARTUP/SHUTDOWN HANDLERS ====================

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
        else:
            print("[RL] Supabase not configured, running without persistence")
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


# ==================== FULL EXAMPLE ====================

"""
Here's what your main.py startup section should look like:

---

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any, Union, Deque
from datetime import datetime
from collections import deque
import asyncio
import time
import uuid
import uvicorn
import os
from dotenv import load_dotenv

from models import (Room, Course, Section, Teacher, TimeSlot, ScheduleEntry, GenerateScheduleRequest, ScheduleResult, RoomType, DayOfWeek)
from database import get_supabase_client, get_all_rooms, get_sections_for_scheduling, ...
from scheduler import run_scheduler
from scheduler_v2 import run_enhanced_scheduler, generate_30min_slots, generate_time_slots, validate_scheduling_data

# NEW: Add these imports
from rl_api import rl_router, integrate_rl_with_qia, initialize_persistence
from rl_persistence import RLStatePersistence

load_dotenv()

app = FastAPI(
    title="College Room Allocation API",
    description="Quantum-Inspired Optimization for Class Room Scheduling",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS setup
app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)

# NEW: Add RL router
app.include_router(rl_router)

# NEW: Connect RL to your QIA scheduler
integrate_rl_with_qia(run_enhanced_scheduler)

# NEW: Add these event handlers
@app.on_event("startup")
async def startup_rl():
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
        print(f"[RL] Warning: {e}")


@app.on_event("shutdown")
async def shutdown_rl():
    try:
        from rl_api import rl_engine, rl_persistence
        if rl_persistence.supabase:
            print("[RL] Saving agent state to Supabase...")
            await rl_persistence.save_agent_state(rl_engine)
            print("[RL] Agent state saved")
    except Exception as e:
        print(f"[RL] Warning: {e}")

# ... rest of your endpoints ...

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

---
"""
