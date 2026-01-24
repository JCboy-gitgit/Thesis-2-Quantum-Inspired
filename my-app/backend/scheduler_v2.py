"""
Enhanced Quantum-Inspired Scheduler v2.1

Key improvements:
- 30-minute time slot intervals for flexible scheduling
- Better course/section hierarchy handling
- Faculty assignment section support
- Improved conflict detection and resolution
- Better room type matching
- QUBO-inspired energy minimization
- 100% scheduling target with aggressive fallback
"""

import numpy as np
from typing import List, Dict, Tuple, Optional, Set, Any
from dataclasses import dataclass, field
from enum import Enum
import random
import time
import math
from collections import defaultdict
from datetime import datetime


# ==================== Data Classes ====================

@dataclass
class TimeSlot:
    """30-minute time slot"""
    id: int
    slot_name: str
    start_time: str  # HH:MM
    end_time: str    # HH:MM
    start_minutes: int  # Minutes since midnight
    duration_minutes: int = 30


@dataclass
class Section:
    """Section to be scheduled"""
    id: int
    section_code: str      # e.g., "BSCS-3A"
    course_code: str       # e.g., "BSCS"
    course_name: str
    subject_code: str      # e.g., "IT-311"
    subject_name: str
    teacher_id: int
    teacher_name: str
    year_level: int
    student_count: int
    required_room_type: str
    weekly_hours: int      # Total hours per week
    lec_hours: int = 0
    lab_hours: int = 0
    requires_lab: bool = False
    department: str = ""
    college: str = ""
    semester: str = "1st Semester"
    
    @property
    def required_slots(self) -> int:
        """Number of 30-min slots needed per week"""
        return max(2, self.weekly_hours * 2)  # Minimum 2 slots (1 hour)


@dataclass  
class Room:
    """Room for scheduling"""
    id: int
    room_code: str
    room_name: str
    building: str
    campus: str
    capacity: int
    room_type: str
    floor: int = 1
    is_accessible: bool = False
    has_projector: bool = False
    has_ac: bool = False
    has_computers: int = 0
    has_lab_equipment: bool = False


@dataclass
class ScheduleSlot:
    """A scheduled time slot assignment"""
    section_id: int
    room_id: int
    day_of_week: str
    start_slot_id: int     # First 30-min slot
    slot_count: int        # Number of consecutive 30-min slots
    teacher_id: int
    is_lab: bool = False


@dataclass
class SchedulingConstraints:
    """Configuration for scheduling constraints"""
    max_teacher_hours_per_day: int = 8
    max_consecutive_hours: int = 4
    min_room_capacity_buffer: float = 1.0
    prioritize_accessibility: bool = True
    avoid_lunch_conflicts: bool = True
    lunch_start_minutes: int = 720   # 12:00
    lunch_end_minutes: int = 780     # 13:00
    prefer_morning_classes: bool = True
    distribute_days_evenly: bool = True


@dataclass
class OptimizationStats:
    """Statistics from optimization"""
    initial_cost: float = 0.0
    final_cost: float = 0.0
    iterations: int = 0
    improvements: int = 0
    quantum_tunnels: int = 0
    time_elapsed_ms: int = 0
    scheduled_count: int = 0
    unscheduled_count: int = 0


# ==================== Helper Functions ====================

def parse_time_to_minutes(time_str: str) -> int:
    """Convert HH:MM to minutes since midnight"""
    parts = time_str.replace(' ', '').split(':')
    return int(parts[0]) * 60 + int(parts[1])


def minutes_to_time(minutes: int) -> str:
    """Convert minutes to HH:MM format"""
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def generate_30min_slots(start_time: str = "07:00", end_time: str = "21:00") -> List[TimeSlot]:
    """Generate 30-minute time slots for a day"""
    slots = []
    start_mins = parse_time_to_minutes(start_time)
    end_mins = parse_time_to_minutes(end_time)
    
    slot_id = 1
    current = start_mins
    
    while current < end_mins:
        slot_start = minutes_to_time(current)
        slot_end = minutes_to_time(current + 30)
        
        slots.append(TimeSlot(
            id=slot_id,
            slot_name=f"{slot_start}-{slot_end}",
            start_time=slot_start,
            end_time=slot_end,
            start_minutes=current,
            duration_minutes=30
        ))
        
        slot_id += 1
        current += 30
    
    return slots


# ==================== Main Scheduler Class ====================

class EnhancedQuantumScheduler:
    """
    Enhanced Quantum-Inspired Simulated Annealing Scheduler
    
    Supports:
    - 30-minute time slots
    - Course/Section hierarchy
    - Faculty load management
    - Multiple session scheduling (e.g., 3-hour class = 6 consecutive 30-min slots)
    """
    
    DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    
    def __init__(
        self,
        sections: List[Section],
        rooms: List[Room],
        time_slots: List[TimeSlot],
        constraints: Optional[SchedulingConstraints] = None,
        active_days: Optional[List[str]] = None
    ):
        self.sections = {s.id: s for s in sections}
        self.rooms = {r.id: r for r in rooms}
        self.time_slots = time_slots
        self.time_slots_by_id = {t.id: t for t in time_slots}
        self.constraints = constraints or SchedulingConstraints()
        self.active_days = [d.lower() for d in (active_days or self.DAYS[:6])]
        
        # Pre-compute compatible rooms for each section
        self.compatible_rooms = self._compute_compatible_rooms()
        
        # Current schedule state
        # Key: (room_id, day, slot_id) -> ScheduleSlot
        self.schedule: Dict[Tuple[int, str, int], ScheduleSlot] = {}
        
        # Section assignments tracking
        # section_id -> list of (room_id, day, start_slot_id, slot_count)
        self.section_assignments: Dict[int, List[Tuple[int, str, int, int]]] = defaultdict(list)
        
        # Optimization stats
        self.stats = OptimizationStats()
        
    def _compute_compatible_rooms(self) -> Dict[int, List[int]]:
        """Pre-compute compatible rooms for each section with aggressive fallback"""
        compatible = {}
        
        for section in self.sections.values():
            compatible_rooms = []
            min_capacity = int(section.student_count * self.constraints.min_room_capacity_buffer)
            
            # First pass: strict matching
            for room in self.rooms.values():
                # Check capacity
                if room.capacity < min_capacity:
                    continue
                
                # Check room type for labs
                if section.requires_lab or section.required_room_type in ['laboratory', 'computer_lab', 'lab']:
                    if room.room_type not in ['laboratory', 'computer_lab', 'lab', 'Laboratory', 'Computer Lab']:
                        continue
                
                compatible_rooms.append(room.id)
            
            # Second pass: relaxed capacity (85%)
            if not compatible_rooms:
                relaxed_capacity = int(section.student_count * 0.85)
                for room in self.rooms.values():
                    if room.capacity >= relaxed_capacity:
                        if section.requires_lab and room.room_type not in ['laboratory', 'computer_lab', 'lab', 'Laboratory', 'Computer Lab']:
                            continue
                        compatible_rooms.append(room.id)
            
            # Third pass: relaxed capacity (70%) - for 100% scheduling
            if not compatible_rooms:
                relaxed_capacity = int(section.student_count * 0.70)
                for room in self.rooms.values():
                    if room.capacity >= relaxed_capacity:
                        compatible_rooms.append(room.id)
            
            # Final fallback: use ALL rooms if still none found (ensures 100% scheduling)
            if not compatible_rooms:
                compatible_rooms = [room.id for room in self.rooms.values()]
            
            # Sort by capacity match (prefer rooms close to student count)
            compatible_rooms.sort(
                key=lambda r: abs(self.rooms[r].capacity - section.student_count)
            )
            
            compatible[section.id] = compatible_rooms
            
        return compatible
    
    def _is_slot_range_available(
        self, 
        room_id: int, 
        day: str, 
        start_slot_id: int, 
        slot_count: int
    ) -> bool:
        """Check if a range of consecutive slots is available"""
        for offset in range(slot_count):
            slot_id = start_slot_id + offset
            if slot_id not in self.time_slots_by_id:
                return False
            if (room_id, day, slot_id) in self.schedule:
                return False
        return True
    
    def _check_teacher_conflict(
        self, 
        teacher_id: int, 
        day: str, 
        start_slot_id: int, 
        slot_count: int
    ) -> bool:
        """Check if teacher has a conflict in the given time range"""
        if not teacher_id or teacher_id == 0:
            return False
        
        for key, slot in self.schedule.items():
            if slot.teacher_id == teacher_id and key[1] == day:
                # Check for time overlap
                existing_start = key[2]
                existing_end = existing_start + slot.slot_count
                new_end = start_slot_id + slot_count
                
                # Overlap if: new_start < existing_end AND existing_start < new_end
                if start_slot_id < existing_end and existing_start < new_end:
                    return True
        return False
    
    def _check_section_year_conflict(
        self,
        section: Section,
        day: str,
        start_slot_id: int,
        slot_count: int
    ) -> bool:
        """
        Check if another section of the same year level and course has a conflict.
        This prevents scheduling conflicts for students in the same year.
        """
        for key, slot in self.schedule.items():
            if key[1] != day:
                continue
                
            other_section = self.sections.get(slot.section_id)
            if not other_section:
                continue
            
            # Check if same course and year level (different section)
            if (other_section.course_code == section.course_code and 
                other_section.year_level == section.year_level and
                other_section.id != section.id):
                
                existing_start = key[2]
                existing_end = existing_start + slot.slot_count
                new_end = start_slot_id + slot_count
                
                if start_slot_id < existing_end and existing_start < new_end:
                    return True
        
        return False
    
    def _get_teacher_daily_slots(self, teacher_id: int, day: str) -> int:
        """Get total slots teacher is scheduled on a day"""
        if not teacher_id or teacher_id == 0:
            return 0
        
        total = 0
        for key, slot in self.schedule.items():
            if slot.teacher_id == teacher_id and key[1] == day:
                total += slot.slot_count
        return total
    
    def _is_during_lunch(self, start_slot_id: int, slot_count: int) -> bool:
        """Check if time range overlaps with lunch break"""
        if not self.constraints.avoid_lunch_conflicts:
            return False
        
        slot = self.time_slots_by_id.get(start_slot_id)
        if not slot:
            return False
        
        end_slot = self.time_slots_by_id.get(start_slot_id + slot_count - 1)
        if not end_slot:
            return False
        
        start_mins = slot.start_minutes
        end_mins = end_slot.start_minutes + 30
        
        # Check overlap with lunch
        lunch_start = self.constraints.lunch_start_minutes
        lunch_end = self.constraints.lunch_end_minutes
        
        return start_mins < lunch_end and lunch_start < end_mins
    
    def _calculate_cost(self) -> float:
        """Calculate total cost of current schedule (lower = better)"""
        cost = 0.0
        
        # Penalty for unscheduled sections
        for section_id, section in self.sections.items():
            assigned_slots = sum(
                count for _, _, _, count in self.section_assignments.get(section_id, [])
            )
            needed_slots = section.required_slots
            
            if assigned_slots < needed_slots:
                cost += 1000 * (needed_slots - assigned_slots)
        
        # Penalties for schedule quality
        for key, slot in self.schedule.items():
            section = self.sections[slot.section_id]
            room = self.rooms[slot.room_id]
            
            # Room type mismatch
            if section.required_room_type and room.room_type != section.required_room_type:
                cost += 30
            
            # Excessive room capacity (waste)
            if section.student_count > 0:
                capacity_ratio = room.capacity / section.student_count
                if capacity_ratio > 2.0:
                    cost += 15 * (capacity_ratio - 2.0)
            
            # Lunch break conflict
            if self._is_during_lunch(slot.start_slot_id, slot.slot_count):
                cost += 50
        
        # Teacher workload balance
        teacher_daily_slots = defaultdict(lambda: defaultdict(int))
        for key, slot in self.schedule.items():
            day = key[1]
            teacher_daily_slots[slot.teacher_id][day] += slot.slot_count
        
        max_daily_slots = self.constraints.max_teacher_hours_per_day * 2
        for teacher_id, daily_slots in teacher_daily_slots.items():
            for day, slots in daily_slots.items():
                if slots > max_daily_slots:
                    cost += 80 * (slots - max_daily_slots)
        
        # Reward accessibility
        if self.constraints.prioritize_accessibility:
            for key, slot in self.schedule.items():
                room = self.rooms[slot.room_id]
                if room.is_accessible:
                    cost -= 5
        
        return cost
    
    def _allocate_section(
        self, 
        section: Section, 
        room_id: int, 
        day: str, 
        start_slot_id: int, 
        slot_count: int
    ) -> bool:
        """Allocate a section to a time range"""
        # Validate
        if not self._is_slot_range_available(room_id, day, start_slot_id, slot_count):
            return False
        
        if section.teacher_id and self._check_teacher_conflict(
            section.teacher_id, day, start_slot_id, slot_count
        ):
            return False
        
        # Allocate
        schedule_slot = ScheduleSlot(
            section_id=section.id,
            room_id=room_id,
            day_of_week=day,
            start_slot_id=start_slot_id,
            slot_count=slot_count,
            teacher_id=section.teacher_id,
            is_lab=section.requires_lab
        )
        
        # Mark all slots as occupied
        for offset in range(slot_count):
            self.schedule[(room_id, day, start_slot_id + offset)] = schedule_slot
        
        # Track assignment
        self.section_assignments[section.id].append(
            (room_id, day, start_slot_id, slot_count)
        )
        
        return True
    
    def _deallocate_section_assignment(
        self, 
        section_id: int, 
        room_id: int, 
        day: str, 
        start_slot_id: int, 
        slot_count: int
    ):
        """Remove a specific assignment"""
        # Remove from schedule
        for offset in range(slot_count):
            key = (room_id, day, start_slot_id + offset)
            if key in self.schedule:
                del self.schedule[key]
        
        # Remove from tracking
        assignments = self.section_assignments.get(section_id, [])
        self.section_assignments[section_id] = [
            a for a in assignments 
            if not (a[0] == room_id and a[1] == day and a[2] == start_slot_id)
        ]
    
    def _generate_initial_solution(self) -> bool:
        """Generate initial schedule using greedy algorithm with aggressive fallback for 100% scheduling"""
        self.schedule.clear()
        self.section_assignments.clear()
        
        # Sort sections by difficulty (fewer compatible rooms = harder to schedule)
        sorted_sections = sorted(
            self.sections.values(),
            key=lambda s: (
                len(self.compatible_rooms.get(s.id, [])),
                -s.student_count,
                -s.weekly_hours
            )
        )
        
        for section in sorted_sections:
            compatible_rooms = self.compatible_rooms.get(section.id, list(self.rooms.keys()))
            if not compatible_rooms:
                compatible_rooms = list(self.rooms.keys())  # Fallback to all rooms
            
            # Determine slot count for each session
            # Split weekly hours into sessions (typically 2-3 sessions per week)
            total_slots_needed = section.required_slots
            
            # Calculate sessions: prefer 1.5-2 hour blocks (3-4 slots each)
            if total_slots_needed <= 4:
                sessions = [total_slots_needed]
            elif total_slots_needed <= 6:
                sessions = [3, 3] if total_slots_needed == 6 else [total_slots_needed]
            elif total_slots_needed <= 9:
                sessions = [3, 3, total_slots_needed - 6] if total_slots_needed > 6 else [3, 3]
            else:
                # For longer hours, split evenly
                num_sessions = (total_slots_needed + 5) // 6
                base_slots = total_slots_needed // num_sessions
                sessions = [base_slots] * num_sessions
            
            slots_assigned = 0
            days_used = []
            
            for session_slots in sessions:
                if slots_assigned >= total_slots_needed:
                    break
                
                slots_for_session = min(session_slots, total_slots_needed - slots_assigned)
                best_assignment = None
                best_cost = float('inf')
                
                # Try to find best slot (3 passes with decreasing strictness)
                for pass_num in range(3):
                    if best_assignment:
                        break
                        
                    rooms_to_try = compatible_rooms if pass_num < 2 else list(self.rooms.keys())
                    
                    for room_id in rooms_to_try:
                        if best_assignment:
                            break
                        for day in self.active_days:
                            if best_assignment:
                                break
                            # On first pass, prefer different days for different sessions
                            if pass_num == 0 and day in days_used and len(self.active_days) > len(days_used):
                                continue
                            
                            for slot in self.time_slots:
                                if not self._is_slot_range_available(
                                    room_id, day, slot.id, slots_for_session
                                ):
                                    continue
                                
                                # On first pass, enforce teacher conflict
                                # On second pass, still check but be more lenient
                                # On third pass, skip teacher check for 100% scheduling
                                if pass_num < 2 and section.teacher_id and self._check_teacher_conflict(
                                    section.teacher_id, day, slot.id, slots_for_session
                                ):
                                    continue
                                
                                # Check year-level conflicts only on first pass
                                if pass_num == 0 and self._check_section_year_conflict(
                                    section, day, slot.id, slots_for_session
                                ):
                                    continue
                                
                                # Check teacher daily load (relaxed on later passes)
                                if pass_num == 0 and section.teacher_id:
                                    daily_slots = self._get_teacher_daily_slots(section.teacher_id, day)
                                    max_daily = self.constraints.max_teacher_hours_per_day * 2
                                    if daily_slots + slots_for_session > max_daily:
                                        continue
                                
                                # Calculate local cost
                                room = self.rooms[room_id]
                                local_cost = 0
                                
                                # Prefer rooms close to student count
                                if section.student_count > 0:
                                    capacity_ratio = room.capacity / section.student_count
                                    local_cost += abs(capacity_ratio - 1.0) * 10
                                
                                # Prefer morning slots
                                if self.constraints.prefer_morning_classes:
                                    local_cost += slot.start_minutes / 60
                                
                                # Penalty for lunch overlap (less strict on later passes)
                                if pass_num == 0 and self._is_during_lunch(slot.id, slots_for_session):
                                    local_cost += 100
                                
                                # Add penalty for later passes (prefer strict matches)
                                local_cost += pass_num * 50
                                
                                if local_cost < best_cost:
                                    best_cost = local_cost
                                    best_assignment = (room_id, day, slot.id, slots_for_session)
                
                if best_assignment:
                    room_id, day, start_slot, slot_count = best_assignment
                    if self._allocate_section(section, room_id, day, start_slot, slot_count):
                        slots_assigned += slot_count
                        days_used.append(day)
        
        # Second aggressive pass: Try to schedule any remaining unscheduled sections
        self._aggressive_scheduling_pass()
        
        return len(self.schedule) > 0
    
    def _aggressive_scheduling_pass(self):
        """Aggressively try to schedule any remaining sections for 100% scheduling"""
        for section in self.sections.values():
            assigned = sum(c for _, _, _, c in self.section_assignments.get(section.id, []))
            needed = section.required_slots
            
            if assigned >= needed:
                continue
            
            remaining_slots = needed - assigned
            
            # Try ANY available slot without constraints
            for room_id in self.rooms.keys():
                if assigned >= needed:
                    break
                for day in self.active_days:
                    if assigned >= needed:
                        break
                    for slot in self.time_slots:
                        if assigned >= needed:
                            break
                        
                        # Check basic availability only
                        slots_to_assign = min(remaining_slots - (assigned - sum(c for _, _, _, c in self.section_assignments.get(section.id, []))), 3)
                        if slots_to_assign <= 0:
                            break
                            
                        if self._is_slot_range_available(room_id, day, slot.id, slots_to_assign):
                            if self._allocate_section(section, room_id, day, slot.id, slots_to_assign):
                                assigned += slots_to_assign
    
    def _get_neighbor(self) -> Optional[Dict[str, Any]]:
        """Generate a neighbor solution by making a small change"""
        if not self.schedule:
            return None
        
        # Get unique assignments (not individual slots)
        assignments = []
        seen = set()
        for section_id, section_assignments in self.section_assignments.items():
            for room_id, day, start_slot, slot_count in section_assignments:
                key = (section_id, room_id, day, start_slot)
                if key not in seen:
                    seen.add(key)
                    assignments.append({
                        'section_id': section_id,
                        'room_id': room_id,
                        'day': day,
                        'start_slot': start_slot,
                        'slot_count': slot_count
                    })
        
        if not assignments:
            return None
        
        # Pick a random assignment to modify
        assignment = random.choice(assignments)
        section = self.sections[assignment['section_id']]
        modification = random.choice(["change_room", "change_day", "change_time"])
        
        if modification == "change_room":
            compatible = self.compatible_rooms.get(section.id, [])
            other_rooms = [r for r in compatible if r != assignment['room_id']]
            if other_rooms:
                new_room = random.choice(other_rooms)
                if self._is_slot_range_available(
                    new_room, assignment['day'], assignment['start_slot'], assignment['slot_count']
                ):
                    return {
                        'type': 'change_room',
                        'old': assignment,
                        'new_room': new_room
                    }
        
        elif modification == "change_day":
            other_days = [d for d in self.active_days if d != assignment['day']]
            if other_days:
                new_day = random.choice(other_days)
                if (self._is_slot_range_available(
                        assignment['room_id'], new_day, assignment['start_slot'], assignment['slot_count']
                    ) and not self._check_teacher_conflict(
                        section.teacher_id, new_day, assignment['start_slot'], assignment['slot_count']
                    )):
                    return {
                        'type': 'change_day',
                        'old': assignment,
                        'new_day': new_day
                    }
        
        elif modification == "change_time":
            current_slot = assignment['start_slot']
            valid_slots = [
                s for s in self.time_slots 
                if s.id != current_slot and 
                s.id + assignment['slot_count'] <= len(self.time_slots)
            ]
            if valid_slots:
                new_slot = random.choice(valid_slots)
                if (self._is_slot_range_available(
                        assignment['room_id'], assignment['day'], new_slot.id, assignment['slot_count']
                    ) and not self._check_teacher_conflict(
                        section.teacher_id, assignment['day'], new_slot.id, assignment['slot_count']
                    )):
                    return {
                        'type': 'change_time',
                        'old': assignment,
                        'new_slot': new_slot.id
                    }
        
        return None
    
    def _apply_move(self, move: Dict[str, Any]) -> bool:
        """Apply a move to the schedule"""
        old = move['old']
        section = self.sections[old['section_id']]
        
        # Remove old assignment
        self._deallocate_section_assignment(
            old['section_id'], old['room_id'], old['day'], old['start_slot'], old['slot_count']
        )
        
        # Apply new assignment
        if move['type'] == 'change_room':
            return self._allocate_section(
                section, move['new_room'], old['day'], old['start_slot'], old['slot_count']
            )
        elif move['type'] == 'change_day':
            return self._allocate_section(
                section, old['room_id'], move['new_day'], old['start_slot'], old['slot_count']
            )
        elif move['type'] == 'change_time':
            return self._allocate_section(
                section, old['room_id'], old['day'], move['new_slot'], old['slot_count']
            )
        
        return False
    
    def _revert_move(self, move: Dict[str, Any]):
        """Revert a move"""
        old = move['old']
        section = self.sections[old['section_id']]
        
        # Remove the new assignment
        if move['type'] == 'change_room':
            self._deallocate_section_assignment(
                old['section_id'], move['new_room'], old['day'], old['start_slot'], old['slot_count']
            )
        elif move['type'] == 'change_day':
            self._deallocate_section_assignment(
                old['section_id'], old['room_id'], move['new_day'], old['start_slot'], old['slot_count']
            )
        elif move['type'] == 'change_time':
            self._deallocate_section_assignment(
                old['section_id'], old['room_id'], old['day'], move['new_slot'], old['slot_count']
            )
        
        # Restore original
        self._allocate_section(
            section, old['room_id'], old['day'], old['start_slot'], old['slot_count']
        )
    
    def _quantum_tunnel(self, temperature: float) -> bool:
        """
        Quantum tunneling for escaping local minima.
        Implements QUBO-inspired energy barrier tunneling.
        """
        # Tunneling probability based on temperature (higher temp = more tunneling)
        tunnel_base_prob = 0.15  # 15% base chance
        if random.random() > tunnel_base_prob:
            return False
        
        # Energy barrier calculation (inspired by QUBO)
        tunnel_prob = math.exp(-1.0 / max(temperature, 0.1))
        
        if random.random() < tunnel_prob:
            # Make a more drastic change - completely reschedule a random section
            assignments = []
            for section_id, section_assignments in self.section_assignments.items():
                for a in section_assignments:
                    assignments.append((section_id, a))
            
            if len(assignments) > 1:
                section_id, (room_id, day, start_slot, slot_count) = random.choice(assignments)
                section = self.sections[section_id]
                
                # Remove and try to reschedule
                self._deallocate_section_assignment(section_id, room_id, day, start_slot, slot_count)
                
                # Try a completely different placement with QUBO-inspired selection
                compatible = self.compatible_rooms.get(section_id, list(self.rooms.keys()))
                if not compatible:
                    compatible = list(self.rooms.keys())
                
                # Calculate energy for each potential placement (QUBO style)
                candidates = []
                for _ in range(50):  # Sample 50 random placements
                    new_room = random.choice(compatible)
                    new_day = random.choice(self.active_days)
                    valid_slots = [s for s in self.time_slots if s.id + slot_count <= len(self.time_slots) + 1]
                    if valid_slots:
                        new_slot = random.choice(valid_slots)
                        
                        if self._is_slot_range_available(new_room, new_day, new_slot.id, slot_count):
                            # Calculate energy (cost) for this placement
                            room = self.rooms[new_room]
                            energy = 0
                            if section.student_count > 0:
                                energy += abs(room.capacity - section.student_count) * 0.5
                            energy += new_slot.start_minutes / 100  # Prefer morning
                            
                            candidates.append((energy, new_room, new_day, new_slot.id))
                
                if candidates:
                    # Select with probability inversely proportional to energy (Boltzmann)
                    candidates.sort(key=lambda x: x[0])
                    selected = candidates[0]  # Pick lowest energy
                    
                    _, new_room, new_day, new_slot_id = selected
                    if self._allocate_section(section, new_room, new_day, new_slot_id, slot_count):
                        self.stats.quantum_tunnels += 1
                        return True
                
                # Failed to find better, restore original
                self._allocate_section(section, room_id, day, start_slot, slot_count)
        
        return False
    
    def optimize(
        self,
        max_iterations: int = 5000,
        initial_temperature: float = 150.0,
        cooling_rate: float = 0.997
    ) -> Tuple[List[Dict[str, Any]], OptimizationStats]:
        """
        Run quantum-inspired simulated annealing optimization.
        
        Uses QUBO-inspired energy minimization combined with simulated annealing
        and quantum tunneling to find optimal room allocations with 100% target.
        
        Returns:
            Tuple of (schedule_entries, optimization_stats)
        """
        start_time = time.time()
        
        print(f"🚀 Starting QIA Optimization with {max_iterations} iterations")
        print(f"   Sections: {len(self.sections)}, Rooms: {len(self.rooms)}, Time Slots: {len(self.time_slots)}")
        
        # Generate initial solution
        if not self._generate_initial_solution():
            print("⚠️ Initial solution failed, trying aggressive scheduling...")
            self._aggressive_scheduling_pass()
            
        if not self.schedule:
            print("❌ Could not generate any schedule")
            self.stats.time_elapsed_ms = int((time.time() - start_time) * 1000)
            return [], self.stats
        
        self.stats.initial_cost = self._calculate_cost()
        current_cost = self.stats.initial_cost
        best_cost = current_cost
        best_schedule = dict(self.schedule)
        best_assignments = {k: list(v) for k, v in self.section_assignments.items()}
        
        print(f"📊 Initial cost: {self.stats.initial_cost:.2f}")
        
        temperature = initial_temperature
        stagnation_count = 0
        last_improvement = 0
        
        for iteration in range(max_iterations):
            # Quantum tunneling (more frequent when stagnated)
            if stagnation_count > 100:
                for _ in range(3):  # Multiple tunnel attempts when stagnated
                    self._quantum_tunnel(temperature)
                stagnation_count = 0
            else:
                self._quantum_tunnel(temperature)
            
            # Get neighbor move
            move = self._get_neighbor()
            
            if move:
                # Try the move
                old_cost = current_cost
                
                if self._apply_move(move):
                    new_cost = self._calculate_cost()
                    delta = new_cost - old_cost
                    
                    # Accept or reject (Metropolis criterion)
                    if delta < 0 or random.random() < math.exp(-delta / max(temperature, 0.01)):
                        current_cost = new_cost
                        stagnation_count = 0
                        
                        if new_cost < best_cost:
                            best_cost = new_cost
                            best_schedule = dict(self.schedule)
                            best_assignments = {k: list(v) for k, v in self.section_assignments.items()}
                            self.stats.improvements += 1
                            last_improvement = iteration
                    else:
                        # Revert
                        self._revert_move(move)
                        stagnation_count += 1
            else:
                stagnation_count += 1
            
            # Cool down
            temperature *= cooling_rate
            self.stats.iterations = iteration + 1
            
            # Early termination if optimal found (cost = 0)
            if best_cost == 0:
                print(f"✅ Optimal solution found at iteration {iteration}")
                break
        
        # Restore best solution
        self.schedule = best_schedule
        self.section_assignments = best_assignments
        self.stats.final_cost = best_cost
        
        # Final aggressive pass to try to schedule any remaining sections
        self._aggressive_scheduling_pass()
        
        self.stats.time_elapsed_ms = int((time.time() - start_time) * 1000)
        
        # Count results
        self.stats.scheduled_count = len([
            s for s in self.sections.values()
            if sum(c for _, _, _, c in self.section_assignments.get(s.id, [])) >= s.required_slots
        ])
        self.stats.unscheduled_count = len(self.sections) - self.stats.scheduled_count
        
        success_rate = (self.stats.scheduled_count / len(self.sections) * 100) if self.sections else 0
        
        print(f"📊 Final cost: {self.stats.final_cost:.2f}")
        print(f"✅ Scheduled: {self.stats.scheduled_count}/{len(self.sections)} ({success_rate:.1f}%)")
        print(f"🔄 Quantum tunnels: {self.stats.quantum_tunnels}")
        print(f"⏱️ Time: {self.stats.time_elapsed_ms}ms")
        
        return self._build_result(), self.stats
    
    def _build_result(self) -> List[Dict[str, Any]]:
        """Build the final schedule result"""
        results = []
        
        # Group by section assignment
        seen = set()
        for section_id, assignments in self.section_assignments.items():
            section = self.sections[section_id]
            
            for room_id, day, start_slot, slot_count in assignments:
                key = (section_id, room_id, day, start_slot)
                if key in seen:
                    continue
                seen.add(key)
                
                room = self.rooms[room_id]
                start_time_slot = self.time_slots_by_id.get(start_slot)
                end_time_slot = self.time_slots_by_id.get(start_slot + slot_count - 1)
                
                if not start_time_slot or not end_time_slot:
                    continue
                
                results.append({
                    'section_id': section_id,
                    'section_code': section.section_code,
                    'course_code': section.course_code,
                    'course_name': section.course_name,
                    'subject_code': section.subject_code,
                    'subject_name': section.subject_name,
                    'room_id': room_id,
                    'room_code': room.room_code,
                    'room_name': room.room_name,
                    'building': room.building,
                    'campus': room.campus,
                    'capacity': room.capacity,
                    'day_of_week': day,
                    'start_time': start_time_slot.start_time,
                    'end_time': end_time_slot.end_time,
                    'start_slot_id': start_slot,
                    'slot_count': slot_count,
                    'teacher_id': section.teacher_id,
                    'teacher_name': section.teacher_name,
                    'year_level': section.year_level,
                    'student_count': section.student_count,
                    'department': section.department,
                    'is_lab': section.requires_lab,
                    'lec_hours': section.lec_hours,
                    'lab_hours': section.lab_hours
                })
        
        return results


# ==================== Runner Function ====================

def run_enhanced_scheduler(
    sections_data: List[Dict[str, Any]],
    rooms_data: List[Dict[str, Any]],
    time_slots_data: Optional[List[Dict[str, Any]]] = None,
    config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Run the enhanced Quantum-Inspired Annealing scheduler
    
    Uses QUBO-inspired energy minimization with simulated annealing
    and quantum tunneling for optimal room allocation.
    
    Args:
        sections_data: List of section dictionaries
        rooms_data: List of room dictionaries
        time_slots_data: Optional list of time slot dictionaries (will generate if not provided)
        config: Optional configuration dictionary
    
    Returns:
        Dictionary with schedule results
    """
    config = config or {}
    
    print("=" * 60)
    print("🧠 QUANTUM-INSPIRED ANNEALING SCHEDULER v2.1")
    print("=" * 60)
    print(f"📚 Sections to schedule: {len(sections_data)}")
    print(f"🏢 Available rooms: {len(rooms_data)}")
    
    # Generate 30-minute slots if not provided
    if not time_slots_data:
        start_time = config.get('start_time', '07:00')
        end_time = config.get('end_time', '21:00')
        time_slots = generate_30min_slots(start_time, end_time)
        print(f"⏰ Generated {len(time_slots)} 30-minute time slots")
    else:
        time_slots = [
            TimeSlot(
                id=t.get('id', i+1),
                slot_name=t.get('slot_name', ''),
                start_time=t.get('start_time', ''),
                end_time=t.get('end_time', ''),
                start_minutes=parse_time_to_minutes(t.get('start_time', '07:00')),
                duration_minutes=t.get('duration_minutes', 30)
            )
            for i, t in enumerate(time_slots_data)
        ]
        print(f"⏰ Using {len(time_slots)} time slots from input")
    
    # Convert data to objects
    sections = []
    for i, s in enumerate(sections_data):
        weekly_hours = s.get('weekly_hours')
        if not weekly_hours or weekly_hours == 0:
            # Calculate from lec_hours + lab_hours, minimum 1 hour
            weekly_hours = max(1, (s.get('lec_hours', 0) + s.get('lab_hours', 0)) or 3)
        
        sections.append(Section(
            id=s.get('id', i+1),
            section_code=s.get('section_code', s.get('section', f'SEC-{i+1}')),
            course_code=s.get('course_code', ''),
            course_name=s.get('course_name', ''),
            subject_code=s.get('subject_code', s.get('course_code', '')),
            subject_name=s.get('subject_name', s.get('course_name', '')),
            teacher_id=s.get('teacher_id', 0),
            teacher_name=s.get('teacher_name', ''),
            year_level=s.get('year_level', 1),
            student_count=max(1, s.get('student_count', 30)),  # Minimum 1 student
            required_room_type=s.get('required_room_type', 'lecture'),
            weekly_hours=weekly_hours,
            lec_hours=s.get('lec_hours', 3),
            lab_hours=s.get('lab_hours', 0),
            requires_lab=s.get('requires_lab', s.get('lab_hours', 0) > 0),
            department=s.get('department', ''),
            college=s.get('college', ''),
            semester=s.get('semester', '1st Semester')
        ))
    
    rooms = []
    for i, r in enumerate(rooms_data):
        rooms.append(Room(
            id=r.get('id', i+1),
            room_code=r.get('room_code', r.get('room', f'ROOM-{i+1}')),
            room_name=r.get('room_name', r.get('room', '')),
            building=r.get('building', ''),
            campus=r.get('campus', 'Main Campus'),
            capacity=max(1, r.get('capacity', 30)),  # Minimum capacity 1
            room_type=r.get('room_type', 'lecture'),
            floor=r.get('floor', r.get('floor_number', 1)),
            is_accessible=r.get('is_accessible', r.get('is_pwd_accessible', False)),
            has_projector=r.get('has_projector', False),
            has_ac=r.get('has_ac', False),
            has_computers=r.get('has_computers', 0),
            has_lab_equipment=r.get('has_lab_equipment', False)
        ))
    
    # Create constraints
    constraints = SchedulingConstraints(
        max_teacher_hours_per_day=config.get('max_teacher_hours_per_day', 8),
        max_consecutive_hours=config.get('max_consecutive_hours', 4),
        prioritize_accessibility=config.get('prioritize_accessibility', True),
        avoid_lunch_conflicts=config.get('avoid_lunch_conflicts', True)
    )
    
    # Get active days
    active_days = config.get('active_days')
    if active_days:
        active_days = [d.lower() for d in active_days]
    
    # Create and run scheduler
    scheduler = EnhancedQuantumScheduler(
        sections=sections,
        rooms=rooms,
        time_slots=time_slots,
        constraints=constraints,
        active_days=active_days
    )
    
    allocations, stats = scheduler.optimize(
        max_iterations=config.get('max_iterations', 5000),
        initial_temperature=config.get('initial_temperature', 150.0),
        cooling_rate=config.get('cooling_rate', 0.997)
    )
    
    # Build unscheduled list with detailed reasons
    unscheduled = []
    for section in sections:
        assigned = sum(
            c for _, _, _, c in scheduler.section_assignments.get(section.id, [])
        )
        if assigned < section.required_slots:
            # Determine reason
            compatible_rooms = scheduler.compatible_rooms.get(section.id, [])
            if not compatible_rooms:
                reason = f"No compatible rooms found for {section.student_count} students"
            elif assigned == 0:
                reason = "Could not find any available time slot"
            else:
                reason = f"Partially scheduled ({assigned}/{section.required_slots} slots)"
            
            unscheduled.append({
                'id': section.id,
                'section_code': section.section_code,
                'course_code': section.course_code,
                'course_name': section.course_name,
                'subject_code': section.subject_code,
                'teacher_name': section.teacher_name,
                'needed_slots': section.required_slots,
                'assigned_slots': assigned,
                'reason': reason
            })
    
    success_rate = (stats.scheduled_count / len(sections) * 100) if sections else 0
    
    print("=" * 60)
    print(f"✅ SCHEDULING COMPLETE: {success_rate:.1f}% success rate")
    print("=" * 60)
    
    return {
        'success': stats.scheduled_count == len(sections),  # True only if 100%
        'allocations': allocations,
        'total_sections': len(sections),
        'scheduled_sections': stats.scheduled_count,
        'unscheduled_sections': stats.unscheduled_count,
        'unscheduled_list': unscheduled,
        'success_rate': success_rate,
        'optimization_stats': {
            'initial_cost': stats.initial_cost,
            'final_cost': stats.final_cost,
            'iterations': stats.iterations,
            'improvements': stats.improvements,
            'quantum_tunnels': stats.quantum_tunnels,
            'time_elapsed_ms': stats.time_elapsed_ms
        }
    }
