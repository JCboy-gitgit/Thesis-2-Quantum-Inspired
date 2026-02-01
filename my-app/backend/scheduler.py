"""
Quantum-Inspired Simulated Annealing Scheduler for College Room Allocation

This module implements a quantum-inspired optimization algorithm that combines:
1. Simulated Annealing for global optimization
2. Quantum tunneling simulation for escaping local minima
3. Constraint satisfaction for hard constraints (no conflicts)
4. Soft constraint optimization (preferences, utilization)
"""

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
    # Split session tracking
    session_number: int = 1  # Which session this is (1, 2, etc.)
    total_sessions: int = 1  # Total sessions for this class
    is_split: bool = False  # Whether this is part of a split class


@dataclass
class Section:
    """Section to be scheduled"""
    id: int
    section_code: str
    course_code: str
    course_name: str
    teacher_id: int
    teacher_name: str
    year_level: int
    student_count: int
    required_room_type: str
    weekly_hours: int  # Total contact hours per week (in minutes for slot calculation)
    lec_hours: int = 0  # Lecture hours per week
    lab_hours: int = 0  # Lab hours per week
    requires_lab: bool = False
    department: str = ""
    allow_split: bool = True  # Allow splitting class into multiple sessions
    min_session_minutes: int = 60  # Minimum session length when splitting (1 hour)


@dataclass
class SplitSession:
    """Represents a split session of a class"""
    original_section_id: int
    session_number: int  # 1, 2, 3, etc.
    total_sessions: int  # Total number of sessions this class was split into
    duration_minutes: int  # Duration of this specific session
    preferred_day_gap: int = 2  # Preferred days between sessions (e.g., Mon-Wed or Tue-Thu)


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
    max_teacher_hours_per_day: int = 8  # Increased to allow more scheduling
    max_consecutive_classes: int = 4
    preferred_utilization: float = 0.75
    min_room_capacity_buffer: float = 1.0  # Room should have at least same capacity as students
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
        
        # Calculate slot duration from time slots (default 90 minutes)
        self.slot_duration = 90
        if time_slots:
            self.slot_duration = time_slots[0].duration_minutes if time_slots[0].duration_minutes > 0 else 90
        
        # Pre-compute compatible rooms for each section
        self.compatible_rooms = self._compute_compatible_rooms()
        
        # Current schedule state
        self.schedule: Dict[Tuple[int, str, int], ScheduleSlot] = {}  # (room_id, day, slot_id) -> ScheduleSlot
        self.section_assignments: Dict[int, List[Tuple[int, str, int]]] = defaultdict(list)  # section_id -> [(room_id, day, slot_id)]
        
        # Split session tracking
        self.split_sessions: Dict[int, List[SplitSession]] = {}  # section_id -> list of split sessions
        
        # Day pairing for split classes (optimal gaps)
        self.day_pairs = [
            ("monday", "thursday"),   # 3-day gap
            ("tuesday", "friday"),    # 3-day gap
            ("monday", "wednesday"),  # 2-day gap
            ("wednesday", "friday"),  # 2-day gap
            ("tuesday", "thursday"),  # 2-day gap
        ]
        
        # Tracking
        self.stats = OptimizationStats()
    
    def _calculate_split_sessions(self, section: Section) -> List[SplitSession]:
        """
        Calculate how to split a class into multiple sessions if needed.
        Returns a list of SplitSession objects describing the split.
        """
        total_minutes = section.weekly_hours
        
        # If class fits in one slot, no split needed
        if total_minutes <= self.slot_duration:
            return [SplitSession(
                original_section_id=section.id,
                session_number=1,
                total_sessions=1,
                duration_minutes=total_minutes
            )]
        
        # Calculate optimal split
        # Prefer splitting into equal parts that fit standard slot durations
        sessions = []
        
        if total_minutes <= self.slot_duration * 2:
            # Can fit in 2 sessions
            half = total_minutes // 2
            sessions = [
                SplitSession(section.id, 1, 2, half, preferred_day_gap=2),
                SplitSession(section.id, 2, 2, total_minutes - half, preferred_day_gap=2)
            ]
        elif total_minutes <= self.slot_duration * 3:
            # Split into 3 sessions
            third = total_minutes // 3
            sessions = [
                SplitSession(section.id, 1, 3, third, preferred_day_gap=2),
                SplitSession(section.id, 2, 3, third, preferred_day_gap=2),
                SplitSession(section.id, 3, 3, total_minutes - 2*third, preferred_day_gap=2)
            ]
        else:
            # Split into multiple standard-length sessions
            num_sessions = math.ceil(total_minutes / self.slot_duration)
            per_session = total_minutes // num_sessions
            remainder = total_minutes % num_sessions
            
            for i in range(num_sessions):
                duration = per_session + (1 if i < remainder else 0)
                sessions.append(SplitSession(
                    section.id, i+1, num_sessions, duration, preferred_day_gap=2
                ))
        
        return sessions
    
    def _get_optimal_days_for_split(self, num_sessions: int, used_days: Set[str] = None) -> List[str]:
        """
        Get optimal days for split sessions to maximize spacing.
        """
        used_days = used_days or set()
        available_days = [d for d in self.DAYS[:6] if d not in used_days]
        
        if num_sessions == 1:
            return [available_days[0]] if available_days else [self.DAYS[0]]
        
        if num_sessions == 2:
            # Try to use a good day pair
            for day1, day2 in self.day_pairs:
                if day1 in available_days and day2 in available_days:
                    return [day1, day2]
            # Fallback: use first two available
            return available_days[:2] if len(available_days) >= 2 else available_days + [self.DAYS[0]]
        
        if num_sessions == 3:
            # Try Mon-Wed-Fri pattern
            if all(d in available_days for d in ["monday", "wednesday", "friday"]):
                return ["monday", "wednesday", "friday"]
            # Fallback
            return available_days[:3] if len(available_days) >= 3 else available_days + self.DAYS[:3-len(available_days)]
        
        # For more sessions, distribute evenly
        return available_days[:num_sessions] if len(available_days) >= num_sessions else available_days + self.DAYS[:num_sessions-len(available_days)]
        
    def _compute_compatible_rooms(self) -> Dict[int, List[int]]:
        """Pre-compute which rooms are compatible with each section"""
        compatible = {}
        
        for section in self.sections.values():
            compatible_rooms = []
            min_capacity = int(section.student_count * self.constraints.min_room_capacity_buffer)
            
            for room in self.rooms.values():
                # Check capacity - room must fit all students
                if room.capacity < min_capacity:
                    continue
                    
                # Check room type compatibility - only enforce for labs
                if section.requires_lab and room.room_type not in ["laboratory", "computer_lab", "lab"]:
                    continue
                
                compatible_rooms.append(room.id)
            
            # If no rooms found with strict capacity, try with relaxed capacity (90%)
            if not compatible_rooms:
                relaxed_capacity = int(section.student_count * 0.9)
                for room in self.rooms.values():
                    if room.capacity >= relaxed_capacity:
                        if section.requires_lab and room.room_type not in ["laboratory", "computer_lab", "lab"]:
                            continue
                        compatible_rooms.append(room.id)
            
            # If still no rooms, use any room (last resort)
            if not compatible_rooms:
                compatible_rooms = [room.id for room in self.rooms.values()]
            
            # Sort rooms by capacity (prefer rooms closer to student count)
            compatible_rooms.sort(key=lambda r: abs(self.rooms[r].capacity - section.student_count))
            compatible[section.id] = compatible_rooms
            
        return compatible
    
    def _is_slot_available(self, room_id: int, day: str, slot_id: int) -> bool:
        """Check if a slot is available"""
        return (room_id, day, slot_id) not in self.schedule
    
    def _check_teacher_conflict(self, teacher_id: int, day: str, slot_id: int) -> bool:
        """Check if teacher is already scheduled at this time"""
        if not teacher_id or teacher_id == 0:
            return False  # No teacher assigned, no conflict possible
        for key, slot in self.schedule.items():
            if slot.teacher_id == teacher_id and key[1] == day and key[2] == slot_id:
                return True
        return False
    
    def _get_teacher_daily_hours(self, teacher_id: int, day: str) -> int:
        """Get number of hours teacher is scheduled on a day"""
        if not teacher_id or teacher_id == 0:
            return 0  # No teacher assigned, return 0
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
            needed_slots = max(1, section.weekly_hours // self.slot_duration)
            
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
        """Generate an initial feasible solution using greedy algorithm with split session support"""
        self.schedule.clear()
        self.section_assignments.clear()
        self.split_sessions.clear()
        
        # Sort sections by constraints (more constrained first - fewer compatible rooms)
        sorted_sections = sorted(
            self.sections.values(),
            key=lambda s: (len(self.compatible_rooms.get(s.id, [])), -s.student_count)
        )
        
        for section in sorted_sections:
            compatible_rooms = self.compatible_rooms.get(section.id, [])
            if not compatible_rooms:
                continue
            
            # Calculate needed slots
            needed_slots = max(1, section.weekly_hours // self.slot_duration)
            
            # First, try to schedule normally (without splitting)
            assigned = self._try_schedule_section_normal(section, compatible_rooms, needed_slots)
            
            # If couldn't schedule all slots and splitting is allowed, try split approach
            if assigned < needed_slots and section.allow_split:
                assigned = self._try_schedule_section_split(section, compatible_rooms, needed_slots, assigned)
        
        # Second pass: Try to schedule any remaining sections with split sessions
        self._schedule_remaining_with_splits()
        
        return len(self.schedule) > 0
    
    def _try_schedule_section_normal(self, section: Section, compatible_rooms: List[int], needed_slots: int) -> int:
        """Try to schedule a section without splitting. Returns number of slots assigned."""
        assigned = 0
        days_to_use = self.DAYS[:6]
        time_slots_list = list(self.time_slots.keys())
        
        for _ in range(needed_slots):
            best_assignment = None
            best_cost = float('inf')
            
            for room_id in compatible_rooms:
                for day in days_to_use:
                    for slot_id in time_slots_list:
                        if not self._is_slot_available(room_id, day, slot_id):
                            continue
                        
                        if section.teacher_id and section.teacher_id > 0:
                            if self._check_teacher_conflict(section.teacher_id, day, slot_id):
                                continue
                            if self._get_teacher_daily_hours(section.teacher_id, day) >= self.constraints.max_teacher_hours_per_day:
                                continue
                        
                        room = self.rooms[room_id]
                        local_cost = 0
                        capacity_ratio = room.capacity / max(1, section.student_count)
                        if capacity_ratio > 2.0:
                            local_cost += 5 * (capacity_ratio - 1.0)
                        
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
                    is_lab=section.requires_lab,
                    session_number=assigned + 1,
                    total_sessions=needed_slots,
                    is_split=False
                )
                self.schedule[(room_id, day, slot_id)] = slot
                self.section_assignments[section.id].append((room_id, day, slot_id))
                assigned += 1
        
        return assigned
    
    def _try_schedule_section_split(self, section: Section, compatible_rooms: List[int], needed_slots: int, already_assigned: int) -> int:
        """
        Try to schedule remaining slots using split session logic.
        Splits the class into multiple sessions on different days with optimal spacing.
        """
        remaining_slots = needed_slots - already_assigned
        if remaining_slots <= 0:
            return already_assigned
        
        # Calculate split sessions
        split_sessions = self._calculate_split_sessions(section)
        self.split_sessions[section.id] = split_sessions
        
        # Get optimal days for the split
        already_used_days = set()
        for key in self.section_assignments.get(section.id, []):
            already_used_days.add(key[1])
        
        optimal_days = self._get_optimal_days_for_split(remaining_slots, already_used_days)
        
        assigned = already_assigned
        session_num = already_assigned + 1
        
        for i, target_day in enumerate(optimal_days):
            if assigned >= needed_slots:
                break
            
            # Find an available slot on this day
            best_assignment = None
            best_cost = float('inf')
            
            time_slots_list = list(self.time_slots.keys())
            
            for room_id in compatible_rooms:
                for slot_id in time_slots_list:
                    if not self._is_slot_available(room_id, target_day, slot_id):
                        continue
                    
                    if section.teacher_id and section.teacher_id > 0:
                        if self._check_teacher_conflict(section.teacher_id, target_day, slot_id):
                            continue
                        if self._get_teacher_daily_hours(section.teacher_id, target_day) >= self.constraints.max_teacher_hours_per_day:
                            continue
                    
                    room = self.rooms[room_id]
                    local_cost = 0
                    capacity_ratio = room.capacity / max(1, section.student_count)
                    if capacity_ratio > 2.0:
                        local_cost += 5 * (capacity_ratio - 1.0)
                    
                    if local_cost < best_cost:
                        best_cost = local_cost
                        best_assignment = (room_id, target_day, slot_id)
            
            if best_assignment:
                room_id, day, slot_id = best_assignment
                slot = ScheduleSlot(
                    section_id=section.id,
                    room_id=room_id,
                    day_of_week=day,
                    time_slot_id=slot_id,
                    teacher_id=section.teacher_id,
                    is_lab=section.requires_lab,
                    session_number=session_num,
                    total_sessions=needed_slots,
                    is_split=True  # Mark as split session
                )
                self.schedule[(room_id, day, slot_id)] = slot
                self.section_assignments[section.id].append((room_id, day, slot_id))
                assigned += 1
                session_num += 1
        
        return assigned
    
    def _schedule_remaining_with_splits(self):
        """Third pass: Aggressively schedule remaining sections using splits"""
        unscheduled_sections = [
            s for s in self.sections.values() 
            if len(self.section_assignments.get(s.id, [])) < max(1, s.weekly_hours // self.slot_duration)
        ]
        
        for section in unscheduled_sections:
            needed = max(1, section.weekly_hours // self.slot_duration)
            assigned = len(self.section_assignments.get(section.id, []))
            
            # Try any available slot, prioritizing good day distribution
            all_room_ids = list(self.rooms.keys())
            random.shuffle(all_room_ids)
            
            # Get already used days for this section
            used_days = set()
            for key in self.section_assignments.get(section.id, []):
                used_days.add(key[1])
            
            # Prefer unused days first
            day_order = [d for d in self.DAYS[:6] if d not in used_days] + list(used_days)
            
            while assigned < needed:
                found = False
                
                for day in day_order:
                    if found:
                        break
                    for room_id in all_room_ids:
                        if found:
                            break
                        for slot_id in self.time_slots:
                            if self._is_slot_available(room_id, day, slot_id):
                                if section.teacher_id and section.teacher_id > 0:
                                    if self._check_teacher_conflict(section.teacher_id, day, slot_id):
                                        continue
                                
                                slot = ScheduleSlot(
                                    section_id=section.id,
                                    room_id=room_id,
                                    day_of_week=day,
                                    time_slot_id=slot_id,
                                    teacher_id=section.teacher_id,
                                    is_lab=section.requires_lab,
                                    session_number=assigned + 1,
                                    total_sessions=needed,
                                    is_split=True  # Mark as split since it's being forced
                                )
                                self.schedule[(room_id, day, slot_id)] = slot
                                self.section_assignments[section.id].append((room_id, day, slot_id))
                                assigned += 1
                                found = True
                                used_days.add(day)
                                break
                
                if not found:
                    break  # No more slots available
        
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
                
                # Remove safely
                del self.schedule[key_to_remove]
                if key_to_remove in self.section_assignments.get(section.id, []):
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
                    
                    # Update section assignments safely
                    section = self.sections[slot.section_id]
                    if old_key in self.section_assignments.get(section.id, []):
                        self.section_assignments[section.id].remove(old_key)
                    if new_key not in self.section_assignments.get(section.id, []):
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
            
            # Build session label for split classes (e.g., "1 of 2", "2 of 2")
            session_label = None
            if slot.is_split or slot.total_sessions > 1:
                session_label = f"{slot.session_number} of {slot.total_sessions}"
            
            entries.append({
                "section_id": section.id,
                "section_code": section.section_code,
                "course_code": section.course_code,
                "course_name": section.course_name,
                "teacher_id": section.teacher_id,
                "teacher_name": section.teacher_name,
                "year_level": section.year_level,
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
                "is_lab_session": slot.is_lab,
                # Split session info
                "is_split_session": slot.is_split,
                "session_number": slot.session_number,
                "total_sessions": slot.total_sessions,
                "session_label": session_label  # e.g., "1 of 2" or null if not split
            })
        
        return entries
    
    def get_unscheduled_sections(self) -> List[Dict]:
        """Get list of sections that couldn't be scheduled with detailed reasons"""
        unscheduled = []
        
        for section_id, section in self.sections.items():
            assigned = len(self.section_assignments.get(section_id, []))
            needed = max(1, section.weekly_hours // self.slot_duration)
            
            if assigned < needed:
                # Determine detailed reason with specific categorization
                compatible_rooms = self.compatible_rooms.get(section_id, [])
                reason_code = "UNKNOWN"
                reason_details = []
                
                if not compatible_rooms:
                    # Check why no rooms are compatible
                    min_capacity = int(section.student_count * self.constraints.min_room_capacity_buffer)
                    rooms_by_capacity = [r for r in self.rooms.values() if r.capacity >= min_capacity]
                    lab_rooms = [r for r in self.rooms.values() if r.room_type in ["laboratory", "computer_lab", "lab"]]
                    
                    if not rooms_by_capacity:
                        reason_code = "INSUFFICIENT_ROOM_CAPACITY"
                        reason = f"No rooms with capacity >= {min_capacity} students (section has {section.student_count} students)"
                        reason_details = [
                            f"Required capacity: {min_capacity}+ students",
                            f"Largest available room: {max((r.capacity for r in self.rooms.values()), default=0)} students",
                            "Consider: Adding larger rooms or splitting section into smaller groups"
                        ]
                    elif section.requires_lab and not any(r.capacity >= min_capacity for r in lab_rooms):
                        reason_code = "NO_LAB_ROOMS"
                        reason = f"No laboratory rooms available with capacity >= {min_capacity} students"
                        available_lab_capacity = max((r.capacity for r in lab_rooms), default=0) if lab_rooms else 0
                        reason_details = [
                            f"This course requires a laboratory room (Lab Hours: {section.lab_hours})",
                            f"Total lab rooms available: {len(lab_rooms)}",
                            f"Largest lab room capacity: {available_lab_capacity} students",
                            "Consider: Adding more lab rooms or reducing lab section size"
                        ]
                    else:
                        reason_code = "ROOM_TYPE_MISMATCH"
                        reason = f"No compatible rooms (capacity or type mismatch for {section.student_count} students)"
                        reason_details = [
                            f"Required room type: {'Laboratory' if section.requires_lab else 'Lecture Room'}",
                            "Consider: Checking room type configuration"
                        ]
                elif assigned == 0:
                    # Check for specific conflict reasons
                    total_slots = len(self.DAYS[:6]) * len(self.time_slots)
                    used_slots = len(self.schedule)
                    utilization = (used_slots / total_slots * 100) if total_slots > 0 else 0
                    
                    # Check if teacher conflict is the issue
                    teacher_conflicts = 0
                    if section.teacher_id and section.teacher_id > 0:
                        for day in self.DAYS[:6]:
                            for slot_id in self.time_slots:
                                if self._check_teacher_conflict(section.teacher_id, day, slot_id):
                                    teacher_conflicts += 1
                    
                    if teacher_conflicts > (total_slots * 0.7):  # Teacher is busy 70%+ of the time
                        reason_code = "TEACHER_OVERLOADED"
                        reason = f"Teacher '{section.teacher_name}' is heavily scheduled ({teacher_conflicts}/{total_slots} slots occupied)"
                        reason_details = [
                            f"Teacher: {section.teacher_name}",
                            f"Teacher's occupied slots: {teacher_conflicts} out of {total_slots}",
                            "Consider: Assigning a different teacher or reducing their load"
                        ]
                    elif utilization > 90:
                        reason_code = "SCHEDULE_FULL"
                        reason = f"Schedule is nearly full ({utilization:.1f}% utilization)"
                        reason_details = [
                            f"Total slots: {total_slots}",
                            f"Used slots: {used_slots}",
                            f"Utilization: {utilization:.1f}%",
                            "Consider: Adding more rooms or extending operating hours"
                        ]
                    else:
                        reason_code = "TIME_CONFLICT"
                        reason = f"All available time slots conflicted (schedule density: {used_slots}/{total_slots})"
                        reason_details = [
                            f"Compatible rooms: {len(compatible_rooms)}",
                            f"Schedule utilization: {utilization:.1f}%",
                            "Consider: Checking for teacher availability conflicts"
                        ]
                else:
                    reason_code = "PARTIAL_SCHEDULE"
                    remaining = needed - assigned
                    reason = f"Partially scheduled: {assigned}/{needed} slots ({remaining} more needed)"
                    reason_details = [
                        f"Successfully assigned: {assigned} slots",
                        f"Still needed: {remaining} slots",
                        "Consider: Checking for time conflicts in remaining slots"
                    ]
                
                unscheduled.append({
                    "id": section.id,
                    "section_code": section.section_code,
                    "course_code": section.course_code,
                    "course_name": section.course_name,
                    "teacher_name": section.teacher_name,
                    "year_level": section.year_level,
                    "student_count": section.student_count,
                    "needed_slots": needed,
                    "assigned_slots": assigned,
                    "compatible_rooms_count": len(compatible_rooms),
                    "reason": reason,
                    "reason_code": reason_code,
                    "reason_details": reason_details
                })
        
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
        
        # Check for teacher conflicts - SKIP if teacher_id is 0 or None (no teacher assigned)
        teacher_usage = defaultdict(list)
        for key, slot in self.schedule.items():
            # Only track conflicts for sections with actual teachers assigned
            if slot.teacher_id and slot.teacher_id > 0:
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
    # Hours are now provided directly (no unit conversion needed)
    # Get config option for allowing class splitting
    allow_split_sessions = config.get("allow_split_sessions", True)  # Default: allow splitting
    
    sections = []
    for s in sections_data:
        # Get hours directly from input
        lec_hours = s.get("lec_hours", 0) or 0
        lab_hours = s.get("lab_hours", 0) or 0
        
        # Use total_hours if provided, otherwise calculate from lec + lab
        total_hours = s.get("total_hours", 0) or (lec_hours + lab_hours)
        if total_hours == 0:
            total_hours = 3  # Default fallback
        
        weekly_minutes = total_hours * 60  # Convert to minutes for slot calculation
        
        # Determine if this section requires a lab room
        requires_lab = lab_hours > 0 or s.get("requires_lab", False)
        
        sections.append(Section(
            id=s["id"],
            section_code=s.get("section_code", f"SEC-{s['id']}"),
            course_code=s.get("course_code", ""),
            course_name=s.get("course_name", ""),
            teacher_id=s.get("teacher_id", 0),
            teacher_name=s.get("teacher_name", ""),
            year_level=s.get("year_level", 1),
            student_count=s.get("student_count", 30),
            required_room_type=s.get("required_room_type", "classroom"),
            weekly_hours=weekly_minutes if weekly_minutes > 0 else 180,  # Default 3 hours
            lec_hours=lec_hours,
            lab_hours=lab_hours,
            requires_lab=requires_lab,
            department=s.get("department", ""),
            allow_split=allow_split_sessions  # Enable/disable splitting per config
        ))
    
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
        max_teacher_hours_per_day=config.get("max_teacher_hours_per_day", 8),
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
    
    # Calculate split session statistics
    split_sessions_count = sum(1 for e in entries if e.get("is_split_session", False))
    classes_with_splits = len(set(e["section_id"] for e in entries if e.get("is_split_session", False)))
    
    # If there are conflicts, report them but don't save
    if len(conflicts) > 0:
        return {
            "success": False,
            "message": f"Schedule generation stopped: {len(conflicts)} conflict(s) detected. Conflicts must be resolved before scheduling can continue.",
            "total_sections": len(sections),
            "scheduled_sections": len(sections) - len(unscheduled),
            "unscheduled_sections": len(unscheduled),
            "schedule_entries": [],  # Don't return conflicting schedule
            "conflicts": conflicts,
            "unscheduled_list": unscheduled,
            "optimization_stats": {
                "initial_cost": stats.initial_cost,
                "final_cost": stats.final_cost,
                "iterations": stats.iterations,
                "improvements": stats.improvements,
                "quantum_tunnels": stats.quantum_tunnels,
                "time_elapsed_ms": stats.time_elapsed_ms
            },
            "split_session_stats": {
                "split_sessions_count": split_sessions_count,
                "classes_with_splits": classes_with_splits,
                "allow_split_enabled": allow_split_sessions
            }
        }
    
    # Build success message including split info
    base_message = "Schedule generated successfully with zero conflicts"
    if len(unscheduled) > 0:
        base_message = f"Schedule generated: {len(unscheduled)} section(s) could not be fully scheduled"
    
    if classes_with_splits > 0:
        base_message += f" | {classes_with_splits} class(es) split into multiple sessions"
    
    return {
        "success": len(unscheduled) < len(sections),
        "message": base_message,
        "total_sections": len(sections),
        "scheduled_sections": len(sections) - len(unscheduled),
        "unscheduled_sections": len(unscheduled),
        "schedule_entries": entries,
        "conflicts": conflicts,
        "unscheduled_list": unscheduled,
        "optimization_stats": {
            "initial_cost": stats.initial_cost,
            "final_cost": stats.final_cost,
            "iterations": stats.iterations,
            "improvements": stats.improvements,
            "quantum_tunnels": stats.quantum_tunnels,
            "time_elapsed_ms": stats.time_elapsed_ms
        },
        "split_session_stats": {
            "split_sessions_count": split_sessions_count,
            "classes_with_splits": classes_with_splits,
            "allow_split_enabled": allow_split_sessions
        }
    }
