"""
Quantum-Inspired Simulated Annealing Scheduler for College Room Allocation

This module implements a quantum-inspired optimization algorithm that combines:
1. Simulated Annealing for global optimization
2. Quantum tunneling simulation for escaping local minima
3. Constraint satisfaction for hard constraints (no conflicts)
4. Soft constraint optimization (preferences, utilization)
"""

import numpy as np
from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass, field
from enum import Enum
import random
import time
import math
from collections import defaultdict


class ConstraintType(Enum):
    HARD = "hard"  # Must be satisfied (no conflicts)
    SOFT = "soft"  # Should be optimized (preferences)


@dataclass
class ScheduleSlot:
    """Represents a single scheduling slot"""
    section_id: int
    room_id: int
    day_of_week: str
    time_slot_id: int
    teacher_id: int
    is_lab: bool = False


@dataclass
class Section:
    """Section to be scheduled"""
    id: int
    section_code: str
    course_code: str
    course_name: str
    teacher_id: int
    teacher_name: str
    student_count: int
    required_room_type: str
    weekly_hours: int  # Number of slots needed per week
    requires_lab: bool = False
    department: str = ""


@dataclass
class Room:
    """Room available for scheduling"""
    id: int
    room_code: str
    room_name: str
    building: str
    campus: str
    capacity: int
    room_type: str
    floor: int = 1
    is_accessible: bool = False


@dataclass
class TimeSlot:
    """Time slot definition"""
    id: int
    slot_name: str
    start_time: str
    end_time: str
    duration_minutes: int


@dataclass
class SchedulingConstraints:
    """Constraints for scheduling"""
    max_teacher_hours_per_day: int = 6
    max_consecutive_classes: int = 3
    preferred_utilization: float = 0.75
    min_room_capacity_buffer: float = 1.1  # Room should have 10% more capacity
    prioritize_accessibility: bool = False


@dataclass
class OptimizationStats:
    """Statistics from the optimization process"""
    initial_cost: float = 0.0
    final_cost: float = 0.0
    iterations: int = 0
    improvements: int = 0
    quantum_tunnels: int = 0
    time_elapsed_ms: int = 0
    temperature_schedule: List[float] = field(default_factory=list)


class QuantumInspiredScheduler:
    """
    Quantum-Inspired Simulated Annealing Scheduler
    
    Uses quantum tunneling simulation to escape local minima and find
    better global solutions for the room allocation problem.
    """
    
    DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    
    def __init__(
        self,
        sections: List[Section],
        rooms: List[Room],
        time_slots: List[TimeSlot],
        constraints: Optional[SchedulingConstraints] = None
    ):
        self.sections = {s.id: s for s in sections}
        self.rooms = {r.id: r for r in rooms}
        self.time_slots = {t.id: t for t in time_slots}
        self.constraints = constraints or SchedulingConstraints()
        
        # Pre-compute compatible rooms for each section
        self.compatible_rooms = self._compute_compatible_rooms()
        
        # Current schedule state
        self.schedule: Dict[Tuple[int, str, int], ScheduleSlot] = {}  # (room_id, day, slot_id) -> ScheduleSlot
        self.section_assignments: Dict[int, List[Tuple[int, str, int]]] = defaultdict(list)  # section_id -> [(room_id, day, slot_id)]
        
        # Tracking
        self.stats = OptimizationStats()
        
    def _compute_compatible_rooms(self) -> Dict[int, List[int]]:
        """Pre-compute which rooms are compatible with each section"""
        compatible = {}
        
        for section in self.sections.values():
            compatible_rooms = []
            min_capacity = int(section.student_count * self.constraints.min_room_capacity_buffer)
            
            for room in self.rooms.values():
                # Check capacity
                if room.capacity < min_capacity:
                    continue
                    
                # Check room type compatibility
                if section.requires_lab and room.room_type not in ["laboratory", "computer_lab"]:
                    continue
                    
                # If section prefers specific room type, prioritize but don't exclude
                if section.required_room_type and room.room_type != section.required_room_type:
                    # Still include but will be penalized in cost function
                    pass
                
                compatible_rooms.append(room.id)
            
            compatible[section.id] = compatible_rooms
            
        return compatible
    
    def _is_slot_available(self, room_id: int, day: str, slot_id: int) -> bool:
        """Check if a slot is available"""
        return (room_id, day, slot_id) not in self.schedule
    
    def _check_teacher_conflict(self, teacher_id: int, day: str, slot_id: int) -> bool:
        """Check if teacher is already scheduled at this time"""
        for key, slot in self.schedule.items():
            if slot.teacher_id == teacher_id and key[1] == day and key[2] == slot_id:
                return True
        return False
    
    def _get_teacher_daily_hours(self, teacher_id: int, day: str) -> int:
        """Get number of hours teacher is scheduled on a day"""
        count = 0
        for key, slot in self.schedule.items():
            if slot.teacher_id == teacher_id and key[1] == day:
                count += 1
        return count
    
    def _calculate_cost(self) -> float:
        """
        Calculate the cost of the current schedule.
        Lower cost = better schedule.
        """
        cost = 0.0
        
        # Penalty for unscheduled sections
        for section_id, section in self.sections.items():
            assigned_slots = len(self.section_assignments.get(section_id, []))
            needed_slots = max(1, section.weekly_hours // 90)  # Assuming 90 min slots
            
            if assigned_slots < needed_slots:
                cost += 1000 * (needed_slots - assigned_slots)  # Heavy penalty
        
        # Penalty for room type mismatch
        for key, slot in self.schedule.items():
            section = self.sections[slot.section_id]
            room = self.rooms[slot.room_id]
            
            if section.required_room_type and room.room_type != section.required_room_type:
                cost += 50  # Soft penalty for room type mismatch
            
            # Penalty for excessive room capacity (wasteful)
            capacity_ratio = room.capacity / section.student_count
            if capacity_ratio > 2.0:
                cost += 20 * (capacity_ratio - 2.0)
        
        # Penalty for teacher workload imbalance
        teacher_daily_hours = defaultdict(lambda: defaultdict(int))
        for key, slot in self.schedule.items():
            day = key[1]
            teacher_daily_hours[slot.teacher_id][day] += 1
        
        for teacher_id, daily_hours in teacher_daily_hours.items():
            for day, hours in daily_hours.items():
                if hours > self.constraints.max_teacher_hours_per_day:
                    cost += 100 * (hours - self.constraints.max_teacher_hours_per_day)
        
        # Reward for accessibility placement (PWD)
        if self.constraints.prioritize_accessibility:
            for key, slot in self.schedule.items():
                room = self.rooms[slot.room_id]
                if room.is_accessible:
                    cost -= 10  # Bonus for using accessible rooms
        
        return cost
    
    def _generate_initial_solution(self) -> bool:
        """Generate an initial feasible solution using greedy algorithm"""
        self.schedule.clear()
        self.section_assignments.clear()
        
        # Sort sections by constraints (more constrained first)
        sorted_sections = sorted(
            self.sections.values(),
            key=lambda s: (len(self.compatible_rooms.get(s.id, [])), -s.student_count)
        )
        
        for section in sorted_sections:
            compatible_rooms = self.compatible_rooms.get(section.id, [])
            if not compatible_rooms:
                continue
            
            needed_slots = max(1, section.weekly_hours // 90)
            assigned = 0
            
            # Try to assign required slots
            for _ in range(needed_slots):
                best_assignment = None
                best_cost = float('inf')
                
                # Try each compatible room, day, and time slot
                for room_id in compatible_rooms:
                    for day in self.DAYS[:6]:  # Monday to Saturday
                        for slot_id in self.time_slots:
                            # Check availability
                            if not self._is_slot_available(room_id, day, slot_id):
                                continue
                            
                            # Check teacher conflict
                            if self._check_teacher_conflict(section.teacher_id, day, slot_id):
                                continue
                            
                            # Check teacher daily hours
                            if self._get_teacher_daily_hours(section.teacher_id, day) >= self.constraints.max_teacher_hours_per_day:
                                continue
                            
                            # Calculate local cost for this assignment
                            room = self.rooms[room_id]
                            local_cost = 0
                            
                            # Prefer correct room type
                            if section.required_room_type and room.room_type != section.required_room_type:
                                local_cost += 50
                            
                            # Prefer appropriate capacity
                            capacity_ratio = room.capacity / section.student_count
                            if capacity_ratio > 2.0:
                                local_cost += 20 * (capacity_ratio - 2.0)
                            elif capacity_ratio < 1.0:
                                local_cost += 1000  # Too small
                            
                            if local_cost < best_cost:
                                best_cost = local_cost
                                best_assignment = (room_id, day, slot_id)
                
                if best_assignment:
                    room_id, day, slot_id = best_assignment
                    slot = ScheduleSlot(
                        section_id=section.id,
                        room_id=room_id,
                        day_of_week=day,
                        time_slot_id=slot_id,
                        teacher_id=section.teacher_id,
                        is_lab=section.requires_lab
                    )
                    self.schedule[(room_id, day, slot_id)] = slot
                    self.section_assignments[section.id].append((room_id, day, slot_id))
                    assigned += 1
        
        return len(self.schedule) > 0
    
    def _get_neighbor(self) -> Tuple[Optional[Tuple], Optional[Tuple], Optional[ScheduleSlot]]:
        """
        Generate a neighbor solution by making a small change.
        Returns (old_key, new_key, slot) for the change.
        """
        if not self.schedule:
            return None, None, None
        
        # Randomly select a scheduled slot to modify
        keys = list(self.schedule.keys())
        old_key = random.choice(keys)
        slot = self.schedule[old_key]
        section = self.sections[slot.section_id]
        
        # Choose a random modification type
        modification = random.choice(["change_room", "change_day", "change_time", "swap"])
        
        if modification == "change_room":
            # Try to change to a different compatible room
            compatible = self.compatible_rooms.get(section.id, [])
            if len(compatible) > 1:
                new_rooms = [r for r in compatible if r != slot.room_id]
                if new_rooms:
                    new_room = random.choice(new_rooms)
                    new_key = (new_room, old_key[1], old_key[2])
                    if self._is_slot_available(new_room, old_key[1], old_key[2]):
                        return old_key, new_key, slot
        
        elif modification == "change_day":
            # Try to change to a different day
            other_days = [d for d in self.DAYS[:6] if d != old_key[1]]
            new_day = random.choice(other_days)
            new_key = (old_key[0], new_day, old_key[2])
            if (self._is_slot_available(old_key[0], new_day, old_key[2]) and
                not self._check_teacher_conflict(slot.teacher_id, new_day, old_key[2])):
                return old_key, new_key, slot
        
        elif modification == "change_time":
            # Try to change to a different time slot
            other_slots = [s for s in self.time_slots if s != old_key[2]]
            if other_slots:
                new_slot = random.choice(other_slots)
                new_key = (old_key[0], old_key[1], new_slot)
                if (self._is_slot_available(old_key[0], old_key[1], new_slot) and
                    not self._check_teacher_conflict(slot.teacher_id, old_key[1], new_slot)):
                    return old_key, new_key, slot
        
        elif modification == "swap" and len(keys) > 1:
            # Try to swap with another slot
            other_keys = [k for k in keys if k != old_key]
            other_key = random.choice(other_keys)
            other_slot = self.schedule[other_key]
            
            # Check if swap is valid
            other_section = self.sections[other_slot.section_id]
            
            # Both sections should be compatible with swapped rooms
            if (old_key[0] in self.compatible_rooms.get(other_section.id, []) and
                other_key[0] in self.compatible_rooms.get(section.id, [])):
                # Check teacher conflicts after swap
                if (not self._check_teacher_conflict(slot.teacher_id, other_key[1], other_key[2]) and
                    not self._check_teacher_conflict(other_slot.teacher_id, old_key[1], old_key[2])):
                    return old_key, other_key, slot  # Special case: swap
        
        return None, None, None
    
    def _quantum_tunnel(self, temperature: float) -> bool:
        """
        Simulate quantum tunneling to escape local minima.
        Makes larger jumps with probability based on temperature.
        """
        if random.random() > 0.1:  # 10% chance of tunneling
            return False
        
        tunnel_probability = math.exp(-1.0 / max(temperature, 0.1))
        
        if random.random() < tunnel_probability:
            # Perform a more drastic change
            if len(self.schedule) > 2:
                # Remove and re-add a random section
                keys = list(self.schedule.keys())
                key_to_remove = random.choice(keys)
                slot = self.schedule[key_to_remove]
                section = self.sections[slot.section_id]
                
                # Remove
                del self.schedule[key_to_remove]
                self.section_assignments[section.id].remove(key_to_remove)
                
                # Try to re-add in a completely different location
                compatible = self.compatible_rooms.get(section.id, [])
                attempts = 0
                while attempts < 20:
                    room_id = random.choice(compatible) if compatible else list(self.rooms.keys())[0]
                    day = random.choice(self.DAYS[:6])
                    slot_id = random.choice(list(self.time_slots.keys()))
                    
                    if (self._is_slot_available(room_id, day, slot_id) and
                        not self._check_teacher_conflict(slot.teacher_id, day, slot_id)):
                        new_key = (room_id, day, slot_id)
                        new_slot = ScheduleSlot(
                            section_id=section.id,
                            room_id=room_id,
                            day_of_week=day,
                            time_slot_id=slot_id,
                            teacher_id=section.teacher_id,
                            is_lab=section.requires_lab
                        )
                        self.schedule[new_key] = new_slot
                        self.section_assignments[section.id].append(new_key)
                        self.stats.quantum_tunnels += 1
                        return True
                    attempts += 1
                
                # Failed to re-add, restore original
                self.schedule[key_to_remove] = slot
                self.section_assignments[section.id].append(key_to_remove)
        
        return False
    
    def optimize(
        self,
        max_iterations: int = 1000,
        initial_temperature: float = 100.0,
        cooling_rate: float = 0.995
    ) -> Tuple[Dict[Tuple, ScheduleSlot], OptimizationStats]:
        """
        Run the quantum-inspired simulated annealing optimization.
        
        Args:
            max_iterations: Maximum number of iterations
            initial_temperature: Starting temperature for annealing
            cooling_rate: Rate at which temperature decreases
            
        Returns:
            Tuple of (best_schedule, optimization_stats)
        """
        start_time = time.time()
        
        # Generate initial solution
        if not self._generate_initial_solution():
            # No feasible solution found
            self.stats.time_elapsed_ms = int((time.time() - start_time) * 1000)
            return {}, self.stats
        
        self.stats.initial_cost = self._calculate_cost()
        current_cost = self.stats.initial_cost
        best_cost = current_cost
        best_schedule = dict(self.schedule)
        best_assignments = dict(self.section_assignments)
        
        temperature = initial_temperature
        
        for iteration in range(max_iterations):
            # Try quantum tunneling
            self._quantum_tunnel(temperature)
            
            # Get neighbor solution
            old_key, new_key, slot = self._get_neighbor()
            
            if old_key and new_key and slot:
                # Apply the change temporarily
                del self.schedule[old_key]
                
                if new_key in self.schedule:
                    # This is a swap
                    other_slot = self.schedule[new_key]
                    self.schedule[old_key] = ScheduleSlot(
                        section_id=other_slot.section_id,
                        room_id=old_key[0],
                        day_of_week=old_key[1],
                        time_slot_id=old_key[2],
                        teacher_id=other_slot.teacher_id,
                        is_lab=other_slot.is_lab
                    )
                    self.schedule[new_key] = ScheduleSlot(
                        section_id=slot.section_id,
                        room_id=new_key[0],
                        day_of_week=new_key[1],
                        time_slot_id=new_key[2],
                        teacher_id=slot.teacher_id,
                        is_lab=slot.is_lab
                    )
                else:
                    self.schedule[new_key] = ScheduleSlot(
                        section_id=slot.section_id,
                        room_id=new_key[0],
                        day_of_week=new_key[1],
                        time_slot_id=new_key[2],
                        teacher_id=slot.teacher_id,
                        is_lab=slot.is_lab
                    )
                
                new_cost = self._calculate_cost()
                delta = new_cost - current_cost
                
                # Accept or reject based on Metropolis criterion
                if delta < 0 or random.random() < math.exp(-delta / max(temperature, 0.01)):
                    # Accept the change
                    current_cost = new_cost
                    
                    # Update section assignments
                    section = self.sections[slot.section_id]
                    if old_key in self.section_assignments[section.id]:
                        self.section_assignments[section.id].remove(old_key)
                    self.section_assignments[section.id].append(new_key)
                    
                    if new_cost < best_cost:
                        best_cost = new_cost
                        best_schedule = dict(self.schedule)
                        best_assignments = dict(self.section_assignments)
                        self.stats.improvements += 1
                else:
                    # Reject the change - restore
                    if new_key in self.schedule and old_key not in self.schedule:
                        del self.schedule[new_key]
                    self.schedule[old_key] = slot
            
            # Cool down
            temperature *= cooling_rate
            
            # Track temperature schedule (sample every 100 iterations)
            if iteration % 100 == 0:
                self.stats.temperature_schedule.append(temperature)
        
        # Restore best solution
        self.schedule = best_schedule
        self.section_assignments = best_assignments
        
        self.stats.final_cost = best_cost
        self.stats.iterations = max_iterations
        self.stats.time_elapsed_ms = int((time.time() - start_time) * 1000)
        
        return self.schedule, self.stats
    
    def get_schedule_entries(self) -> List[Dict]:
        """Convert internal schedule to list of entries"""
        entries = []
        
        for key, slot in self.schedule.items():
            section = self.sections[slot.section_id]
            room = self.rooms[slot.room_id]
            time_slot = self.time_slots[slot.time_slot_id]
            
            entries.append({
                "section_id": section.id,
                "section_code": section.section_code,
                "course_code": section.course_code,
                "course_name": section.course_name,
                "teacher_id": section.teacher_id,
                "teacher_name": section.teacher_name,
                "room_id": room.id,
                "room_code": room.room_code,
                "room_name": room.room_name,
                "building": room.building,
                "day_of_week": slot.day_of_week,
                "time_slot_id": time_slot.id,
                "start_time": time_slot.start_time,
                "end_time": time_slot.end_time,
                "student_count": section.student_count,
                "room_capacity": room.capacity,
                "is_lab_session": slot.is_lab
            })
        
        return entries
    
    def get_unscheduled_sections(self) -> List[Section]:
        """Get list of sections that couldn't be scheduled"""
        unscheduled = []
        
        for section_id, section in self.sections.items():
            assigned = len(self.section_assignments.get(section_id, []))
            needed = max(1, section.weekly_hours // 90)
            
            if assigned < needed:
                unscheduled.append(section)
        
        return unscheduled
    
    def get_conflicts(self) -> List[Dict]:
        """Detect any remaining conflicts in the schedule"""
        conflicts = []
        
        # Check for room conflicts (shouldn't happen but verify)
        room_usage = defaultdict(list)
        for key, slot in self.schedule.items():
            usage_key = (slot.room_id, key[1], key[2])
            room_usage[usage_key].append(slot.section_id)
        
        for usage_key, sections in room_usage.items():
            if len(sections) > 1:
                conflicts.append({
                    "conflict_type": "room",
                    "description": f"Room {usage_key[0]} double-booked on {usage_key[1]} slot {usage_key[2]}",
                    "involved_entries": sections
                })
        
        # Check for teacher conflicts
        teacher_usage = defaultdict(list)
        for key, slot in self.schedule.items():
            usage_key = (slot.teacher_id, key[1], key[2])
            teacher_usage[usage_key].append(slot.section_id)
        
        for usage_key, sections in teacher_usage.items():
            if len(sections) > 1:
                conflicts.append({
                    "conflict_type": "teacher",
                    "description": f"Teacher {usage_key[0]} double-booked on {usage_key[1]} slot {usage_key[2]}",
                    "involved_entries": sections
                })
        
        return conflicts


def run_scheduler(
    sections_data: List[Dict],
    rooms_data: List[Dict],
    time_slots_data: List[Dict],
    config: Dict
) -> Dict:
    """
    Main entry point for the scheduler.
    
    Args:
        sections_data: List of section dictionaries
        rooms_data: List of room dictionaries
        time_slots_data: List of time slot dictionaries
        config: Configuration dictionary with optimization parameters
        
    Returns:
        Result dictionary with schedule and statistics
    """
    # Convert data to dataclasses
    sections = [
        Section(
            id=s["id"],
            section_code=s.get("section_code", f"SEC-{s['id']}"),
            course_code=s.get("course_code", ""),
            course_name=s.get("course_name", ""),
            teacher_id=s.get("teacher_id", 0),
            teacher_name=s.get("teacher_name", ""),
            student_count=s.get("student_count", 30),
            required_room_type=s.get("required_room_type", "classroom"),
            weekly_hours=s.get("weekly_hours", 180),  # Default 3 hours (2 x 90 min)
            requires_lab=s.get("requires_lab", False),
            department=s.get("department", "")
        )
        for s in sections_data
    ]
    
    rooms = [
        Room(
            id=r["id"],
            room_code=r.get("room_code", r.get("room", "")),
            room_name=r.get("room_name", r.get("room", "")),
            building=r.get("building", ""),
            campus=r.get("campus", ""),
            capacity=r.get("capacity", 30),
            room_type=r.get("room_type", "classroom"),
            floor=r.get("floor", 1),
            is_accessible=r.get("is_accessible", r.get("is_first_floor", False))
        )
        for r in rooms_data
    ]
    
    time_slots = [
        TimeSlot(
            id=t["id"],
            slot_name=t.get("slot_name", f"Slot {t['id']}"),
            start_time=t.get("start_time", "08:00"),
            end_time=t.get("end_time", "09:30"),
            duration_minutes=t.get("duration_minutes", 90)
        )
        for t in time_slots_data
    ]
    
    constraints = SchedulingConstraints(
        max_teacher_hours_per_day=config.get("max_teacher_hours_per_day", 6),
        prioritize_accessibility=config.get("prioritize_accessibility", False)
    )
    
    # Run scheduler
    scheduler = QuantumInspiredScheduler(sections, rooms, time_slots, constraints)
    
    schedule, stats = scheduler.optimize(
        max_iterations=config.get("max_iterations", 1000),
        initial_temperature=config.get("initial_temperature", 100.0),
        cooling_rate=config.get("cooling_rate", 0.995)
    )
    
    entries = scheduler.get_schedule_entries()
    unscheduled = scheduler.get_unscheduled_sections()
    conflicts = scheduler.get_conflicts()
    
    return {
        "success": len(conflicts) == 0 and len(unscheduled) < len(sections),
        "message": "Schedule generated successfully" if len(conflicts) == 0 else f"Schedule has {len(conflicts)} conflicts",
        "total_sections": len(sections),
        "scheduled_sections": len(sections) - len(unscheduled),
        "unscheduled_sections": len(unscheduled),
        "schedule_entries": entries,
        "conflicts": conflicts,
        "unscheduled_list": [
            {"id": s.id, "section_code": s.section_code, "course_name": s.course_name}
            for s in unscheduled
        ],
        "optimization_stats": {
            "initial_cost": stats.initial_cost,
            "final_cost": stats.final_cost,
            "iterations": stats.iterations,
            "improvements": stats.improvements,
            "quantum_tunnels": stats.quantum_tunnels,
            "time_elapsed_ms": stats.time_elapsed_ms
        }
    }
