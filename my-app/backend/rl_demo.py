"""
RL Scheduler Demo - Example of how to use the RL system

Run this locally to train the agent on custom rules without needing FastAPI.
Perfect for testing and understanding how the system works.
"""

from rl_scheduler import (
    RLSchedulingEngine, CustomRule,
    create_no_friday_afternoon_rule,
    create_teacher_lunch_break_rule,
    create_room_clustering_rule
)
import json


# ==================== Define Custom Rules ====================

def check_no_7am(schedule):
    """Violation: Any class before 8 AM."""
    for class_id, (room_id, time_slot) in schedule.items():
        time = time_slot.split("_")[1]
        hour = int(time.split(":")[0])
        if hour < 8:
            return True
    return False


def check_max_2_hours(schedule):
    """Violation: Class longer than 2 hours (simplified)."""
    # In real implementation, check actual slot duration
    return False


def check_teacher_not_overloaded(schedule):
    """Violation: Teacher has more than 4 classes per day."""
    # In real implementation, count per teacher per day
    return False


# ==================== Setup ====================

print("=" * 60)
print("RL SCHEDULER DEMO - Custom Rules Learning")
print("=" * 60)

# Create engine
engine = RLSchedulingEngine()

# Add built-in rules
engine.add_custom_rule(create_no_friday_afternoon_rule(penalty=200))
engine.add_custom_rule(create_teacher_lunch_break_rule(penalty=150))
engine.add_custom_rule(create_room_clustering_rule(penalty=100))

# Add custom rules
no_7am_rule = CustomRule(
    rule_id="no_7am",
    name="No 7 AM Classes",
    description="No classes before 8 AM",
    penalty=250,
    check_fn=check_no_7am
)
engine.add_custom_rule(no_7am_rule)

max_2h_rule = CustomRule(
    rule_id="max_2_hours",
    name="Max 2 Consecutive Hours",
    description="No class longer than 2 hours",
    penalty=180,
    check_fn=check_max_2_hours
)
engine.add_custom_rule(max_2h_rule)

print("\n[*] Registered Rules:")
for rule in engine.environment.custom_rules:
    print(f"  - {rule.name} (penalty: {rule.penalty})")

# ==================== Training Data ====================

classes = [
    {"id": "cs101", "name": "Intro to CS", "capacity_needed": 30},
    {"id": "cs102", "name": "Data Structures", "capacity_needed": 25},
    {"id": "cs201", "name": "Algorithms", "capacity_needed": 20},
    {"id": "math101", "name": "Calculus I", "capacity_needed": 40},
    {"id": "phys101", "name": "Physics I", "capacity_needed": 35},
]

rooms = [
    {"id": "r101", "capacity": 50, "type": "lecture"},
    {"id": "r102", "capacity": 40, "type": "lecture"},
    {"id": "r103", "capacity": 30, "type": "lecture"},
    {"id": "lab1", "capacity": 25, "type": "lab"},
    {"id": "lab2", "capacity": 25, "type": "lab"},
]

time_slots = [
    "monday_08:00", "monday_09:00", "monday_10:00", "monday_14:00",
    "tuesday_08:00", "tuesday_09:00", "tuesday_10:00", "tuesday_14:00",
    "wednesday_08:00", "wednesday_09:00", "wednesday_10:00", "wednesday_14:00",
    "thursday_08:00", "thursday_09:00", "thursday_10:00", "thursday_14:00",
    "friday_08:00", "friday_09:00", "friday_10:00", "friday_14:00",
]

print(f"\n[*] Training Data:")
print(f"  - {len(classes)} classes")
print(f"  - {len(rooms)} rooms")
print(f"  - {len(time_slots)} time slots")

# ==================== Training ====================

print("\n" + "=" * 60)
print("TRAINING PHASE - Agent Learning from Rules")
print("=" * 60)

num_episodes = 5
print(f"\nTraining for {num_episodes} episodes...")

for episode in range(num_episodes):
    result = engine.train_episode(
        classes=classes,
        rooms=rooms,
        time_slots=time_slots,
        iterations=3
    )

    print(f"\nEpisode {episode + 1}:")
    print(f"  Avg Reward: {result['avg_reward']:.2f}")
    print(f"  Q-Table Size: {result['agent_stats']['q_table_size']}")
    print(f"  Experience Buffer: {result['agent_stats']['experience_buffer_size']}")

# ==================== Results ====================

print("\n" + "=" * 60)
print("RESULTS - What the Agent Learned")
print("=" * 60)

stats = engine.get_training_stats()
print(f"\n[*] Overall Statistics:")
print(f"  Episodes Trained: {stats['episodes_trained']}")
print(f"  Average Reward: {stats['avg_reward']:.2f}")
print(f"  Best Reward: {stats['best_reward']:.2f}")
print(f"  Worst Reward: {stats['worst_reward']:.2f}")
print(f"  Q-Table States: {stats['agent_stats']['q_table_size']}")

# Get learned schedule
print(f"\n[*] Generating RL-Optimized Schedule...")
learned_schedule = engine.get_learned_schedule(
    classes=classes,
    rooms=rooms,
    time_slots=time_slots
)

print("\nSchedule (class -> [room, time_slot]):")
for class_id, (room_id, slot) in learned_schedule.items():
    class_name = next((c['name'] for c in classes if c['id'] == class_id), class_id)
    print(f"  {class_name:30} -> {room_id:6} @ {slot}")

# ==================== Training History ====================

print("\n" + "=" * 60)
print("TRAINING HISTORY - Reward Improvement Over Time")
print("=" * 60)

print("\nEpisode History:")
for i, entry in enumerate(engine.training_history, 1):
    print(f"  Episode {i}: Reward={entry['avg_reward']:.2f}")

# ==================== Summary ====================

print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)

print(f"""
The RL agent has learned from {len(engine.training_history)} training episodes.

Key Insights:
1. The agent now understands penalties for each rule
2. It learns which room/time combinations violate the most rules
3. Over time, it prefers placements that minimize violations
4. Reward increases as it learns better strategies

How to use in production:
1. Register your custom rules via /api/rl/rules/add
2. Train the agent with real scheduling data: POST /api/rl/train
3. Generate schedules using learned policy: POST /api/rl/schedule/learned
4. Monitor learning: GET /api/rl/stats

Next Steps:
- Implement real check_fn functions for each rule
- Train on your actual course/room data
- Deploy to production backend
- Monitor performance and adjust rule penalties
""")

print("=" * 60)
print("[OK] Demo Complete!")
print("=" * 60)
