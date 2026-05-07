"""
FastAPI endpoints for RL Scheduling Engine
Integrate with existing scheduler to enable learning from custom rules.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from rl_scheduler import (
    RLSchedulingEngine, CustomRule,
    create_no_friday_afternoon_rule,
    create_teacher_lunch_break_rule,
    create_room_clustering_rule
)
from rl_persistence import RLStatePersistence


# ==================== Pydantic Models ====================

class CustomRuleRequest(BaseModel):
    """Request model for adding a custom rule."""
    rule_id: str
    name: str
    description: str
    penalty: float
    rule_type: Optional[str] = None  # 'no_friday_afternoon', 'teacher_lunch', 'room_clustering', etc.


class TrainRLRequest(BaseModel):
    """Request to train RL agent on custom rules."""
    classes: List[Dict[str, Any]]
    rooms: List[Dict[str, Any]]
    time_slots: List[str]
    iterations: int = 10


class GetLearnedScheduleRequest(BaseModel):
    """Request to get schedule optimized with learned policy."""
    classes: List[Dict[str, Any]]
    rooms: List[Dict[str, Any]]
    time_slots: List[str]


class RLStatsResponse(BaseModel):
    """RL agent statistics."""
    episodes_trained: int
    avg_reward: float
    best_reward: Optional[float] = None
    worst_reward: Optional[float] = None
    agent_stats: Dict[str, Any]


class TrainResponseModel(BaseModel):
    """Response from training endpoint."""
    episode: int
    avg_reward: float
    agent_stats: Dict[str, Any]


# ==================== Router Setup ====================

rl_router = APIRouter(prefix="/api/rl", tags=["RL Scheduling"])

# Global RL Engine (in production, use database or cache)
rl_engine = RLSchedulingEngine()
rl_persistence = RLStatePersistence(supabase_client=None)  # Set by initialize_persistence()

# Register built-in rules
rl_engine.add_custom_rule(create_no_friday_afternoon_rule())
rl_engine.add_custom_rule(create_teacher_lunch_break_rule())
rl_engine.add_custom_rule(create_room_clustering_rule())


def initialize_persistence(supabase_client):
    """Initialize persistence with Supabase client."""
    global rl_persistence
    rl_persistence.supabase = supabase_client



# ==================== Endpoints ====================

@rl_router.post("/rules/add", summary="Add Custom Rule")
async def add_custom_rule(request: CustomRuleRequest):
    """
    Add a custom scheduling rule for the RL agent to learn.

    **Example:**
    ```json
    {
        "rule_id": "no_7am",
        "name": "No 7 AM Classes",
        "description": "Avoid scheduling classes before 8 AM",
        "penalty": 250
    }
    ```
    """
    try:
        rule = CustomRule(
            rule_id=request.rule_id,
            name=request.name,
            description=request.description,
            penalty=request.penalty
        )
        rl_engine.add_custom_rule(rule)
        return {
            "status": "success",
            "message": f"Rule '{request.name}' added successfully",
            "rule_id": request.rule_id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@rl_router.post("/train", summary="Train RL Agent", response_model=TrainResponseModel)
async def train_rl_agent(request: TrainRLRequest):
    """
    Train the RL agent on provided classes and rules.

    - **classes**: List of class objects with id, name, capacity_needed
    - **rooms**: List of room objects with id, capacity, type
    - **time_slots**: List of available time slots (format: "monday_08:00")
    - **iterations**: Number of training iterations (default: 10)

    Returns training metrics including average reward and agent statistics.

    **Example:**
    ```json
    {
        "classes": [{"id": "cs101", "name": "Intro to CS", "capacity_needed": 30}],
        "rooms": [{"id": "r101", "capacity": 50, "type": "lecture"}],
        "time_slots": ["monday_08:00", "monday_09:00"],
        "iterations": 10
    }
    ```
    """
    try:
        result = rl_engine.train_episode(
            classes=request.classes,
            rooms=request.rooms,
            time_slots=request.time_slots,
            iterations=request.iterations
        )
        # Save agent state to Supabase after training
        await rl_persistence.save_agent_state(rl_engine)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@rl_router.post("/schedule/learned", summary="Get RL-Optimized Schedule")
async def get_learned_schedule(request: GetLearnedScheduleRequest):
    """
    Get a schedule optimized using the RL agent's learned policy.

    After training the agent on custom rules, use this endpoint to generate
    schedules that respect learned preferences.

    Returns a mapping of class_id -> (room_id, time_slot)
    """
    try:
        schedule = rl_engine.get_learned_schedule(
            classes=request.classes,
            rooms=request.rooms,
            time_slots=request.time_slots
        )
        return {
            "status": "success",
            "schedule": schedule,
            "timestamp": None  # Will be filled with datetime
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@rl_router.get("/stats", summary="Get Training Statistics", response_model=RLStatsResponse)
async def get_rl_stats():
    """Get overall RL agent training statistics and learning progress."""
    try:
        stats = rl_engine.get_training_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@rl_router.get("/rules", summary="List Registered Rules")
async def list_rules():
    """Get list of all registered custom rules."""
    try:
        rules = []
        for rule in rl_engine.environment.custom_rules:
            rules.append({
                "rule_id": rule.rule_id,
                "name": rule.name,
                "description": rule.description,
                "penalty": rule.penalty
            })
        return {
            "count": len(rules),
            "rules": rules
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@rl_router.get("/training-history", summary="Get Training History")
async def get_training_history(limit: int = 20):
    """Get last N training episodes history."""
    try:
        history = rl_engine.training_history[-limit:]
        return {
            "episodes": len(history),
            "history": history
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@rl_router.post("/reset", summary="Reset RL Agent")
async def reset_agent():
    """Reset the RL agent (clears learned Q-values and history)."""
    try:
        global rl_engine
        rl_engine = RLSchedulingEngine()
        # Re-add built-in rules
        rl_engine.add_custom_rule(create_no_friday_afternoon_rule())
        rl_engine.add_custom_rule(create_teacher_lunch_break_rule())
        rl_engine.add_custom_rule(create_room_clustering_rule())
        # Also delete from database
        await rl_persistence.reset_agent_state()
        return {"status": "success", "message": "RL agent reset"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Integration with Existing Scheduler ====================

def integrate_rl_with_qia(qia_scheduler_fn):
    """
    Connect RL engine to your existing QIA scheduler.
    Pass your run_enhanced_scheduler function.
    """
    rl_engine.qia_scheduler = qia_scheduler_fn
    return rl_engine
