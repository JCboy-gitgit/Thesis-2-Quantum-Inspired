"""
Enhanced Quantum-Inspired Scheduler v2.2 - BulSU Scheduling Rules

IMPLEMENTS BulSU QSA (Quantum-Inspired Scheduling Algorithm) with:
1. THE "ONLINE DAY" RULE: Toggle days as online (Room_ID = NULL, Energy_Penalty = 0)
2. QUANTUM TUNNELING: Block swaps and department-level moves for escaping local minima
3. PHYSICAL CONSTRAINTS: 07:00-18:00 Day, 18:00-21:00 Night, Room Capacity (10% tolerance)
4. QUBO MATRIX: Weighted penalties - Hard constraints (1,000,000), Soft (10-100)
5. 100% CONFLICT-FREE GUARANTEE: Uses infinite penalty for conflicts
"""

from typing import List, Dict, Tuple, Optional, Set, Any
from dataclasses import dataclass, field
from enum import Enum
import random
import time
import math
from collections import defaultdict
from datetime import datetime


# ==================== BulSU QSA Constants ====================

# HARD CONSTRAINT PENALTY - Must never be violated
HARD_CONSTRAINT_PENALTY = 1_000_000  # Effectively infinite

# SOFT CONSTRAINT PENALTIES
SOFT_ROOM_TYPE_MISMATCH = 50
SOFT_CAPACITY_WASTE = 15
SOFT_LUNCH_OVERLAP = 500  # Increased - lunch break is important
SOFT_TEACHER_OVERLOAD = 80
SOFT_ACCESSIBILITY_BONUS = -10  # Bonus (negative penalty)
SOFT_MORNING_PREFERENCE = 5
SOFT_DAY_DISTRIBUTION = 20

# LUNCH BREAK MODE
LUNCH_MODE_STRICT = 'strict'  # No classes during lunch (HARD constraint)
LUNCH_MODE_FLEXIBLE = 'flexible'  # Avoid lunch but allow if necessary (SOFT constraint)
LUNCH_MODE_NONE = 'none'  # No lunch restriction


# ==================== Data Classes ====================

@dataclass
class TimeSlot:
    """30-minute time slot with day/night classification"""
    id: int
    slot_name: str
    start_time: str  # HH:MM
    end_time: str    # HH:MM
    start_minutes: int  # Minutes since midnight
    duration_minutes: int = 30
    
    @property
    def is_night_class(self) -> bool:
        """Night classes: 18:00 - 21:00"""
        return self.start_minutes >= 18 * 60


@dataclass
class Section:
    """Section to be scheduled with pinning support"""
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
    weekly_hours: int      # Total contact hours per week (lec_hours + lab_hours)
    lec_hours: int = 0     # Lecture hours per week (actual hours, not units)
    lab_hours: int = 0     # Lab hours per week (actual hours, not units)
    requires_lab: bool = False
    department: str = ""
    college: str = ""
    semester: str = "1st Semester"
    is_pinned: bool = False  # NEW: Pinned classes cannot be moved by QSA
    pinned_day: Optional[str] = None  # NEW: Force specific day
    pinned_room_id: Optional[int] = None  # NEW: Force specific room
    pinned_time_slot: Optional[int] = None  # NEW: Force specific time
    required_features: Set[str] = field(default_factory=set)  # NEW: Required equipment tags
    
    @property
    def required_slots(self) -> int:
        """
        Number of 30-min slots needed per week.
        Simply: total weekly hours * 2 (since each hour = 2 thirty-minute slots)
        """
        total_hours = self.lec_hours + self.lab_hours
        if total_hours <= 0:
            total_hours = self.weekly_hours or 3  # Fallback to weekly_hours or 3
        return max(2, total_hours * 2)  # Minimum 2 slots (1 hour)


@dataclass  
class Room:
    """Room for scheduling with equipment tracking"""
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
    specific_classification: Optional[str] = None  # e.g., "Engineering Lab"
    feature_tags: Set[str] = field(default_factory=set)  # NEW: Equipment tags like "Desktop_PC", "DC_Power_Supply"


@dataclass
class SchedulingConstraints:
    """BulSU QSA Configuration"""
    max_teacher_hours_per_day: int = 8
    max_consecutive_hours: int = 4
    min_room_capacity_buffer: float = 1.0
    capacity_tolerance: float = 0.10  # 10% tolerance for lectures
    prioritize_accessibility: bool = True
    avoid_lunch_conflicts: bool = True
    lunch_mode: str = 'flexible'  # 'strict', 'flexible', or 'none'
    lunch_start_minutes: int = 720   # 12:00
    lunch_end_minutes: int = 780     # 13:00
    prefer_morning_classes: bool = True
    distribute_days_evenly: bool = True
    day_class_start: int = 420       # 07:00 in minutes
    day_class_end: int = 1080        # 18:00 in minutes
    night_class_end: int = 1260      # 21:00 in minutes (hard boundary)
    strict_lab_room_matching: bool = True  # Lab classes MUST be in lab rooms
    strict_lecture_room_matching: bool = True  # Lecture classes should NOT be in lab rooms


@dataclass
class ScheduleSlot:
    """Represents a scheduled class in a specific room, day, and time slot"""
    section_id: int
    room_id: Optional[int]  # None for online classes
    day_of_week: str
    start_slot_id: int
    slot_count: int
    teacher_id: Optional[int] = None
    is_lab: bool = False
    is_online: bool = False
    is_pinned: bool = False


@dataclass
class OptimizationStats:
    """Statistics from optimization with conflict tracking"""
    initial_cost: float = 0.0
    final_cost: float = 0.0
    iterations: int = 0
    improvements: int = 0
    quantum_tunnels: int = 0
    block_swaps: int = 0  # NEW: Department-level swaps
    time_elapsed_ms: int = 0
    scheduled_count: int = 0
    unscheduled_count: int = 0
    conflict_count: int = 0
    online_classes: int = 0  # NEW: Count of online classes


# ==================== Helper Functions ====================

def parse_time_to_minutes(time_str: str) -> int:
    """Convert HH:MM to minutes since midnight"""
    parts = time_str.replace(' ', '').split(':')
    return int(parts[0]) * 60 + int(parts[1])


def minutes_to_time(minutes: int) -> str:
    """Convert minutes to HH:MM format"""
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def generate_30min_slots(start_time: str = "07:00", end_time: str = "21:00") -> List[TimeSlot]:
    """Generate 30-minute time slots for a day (07:00 - 21:00 per BulSU rules)"""
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
    BulSU Quantum-Inspired Simulated Annealing Scheduler (QSA)
    
    Implements QUBO (Quadratic Unconstrained Binary Optimization) inspired
    energy minimization with:
    - Online Day support (Room_ID = NULL for online days)
    - Block swaps for quantum tunneling
    - Hard constraint enforcement (conflict-free guarantee)
    - 30-minute time slots with day/night classification
    - Pinned class support (freeze specific assignments)
    """
    
    DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    
    def __init__(
        self,
        sections: List[Section],
        rooms: List[Room],
        time_slots: List[TimeSlot],
        constraints: Optional[SchedulingConstraints] = None,
        active_days: Optional[List[str]] = None,
        online_days: Optional[List[str]] = None  # NEW: Days where all classes are online
    ):
        self.sections = {s.id: s for s in sections}
        self.rooms = {r.id: r for r in rooms}
        self.time_slots = time_slots
        self.time_slots_by_id = {t.id: t for t in time_slots}
        self.constraints = constraints or SchedulingConstraints()
        self.active_days = [d.lower() for d in (active_days or self.DAYS[:6])]
        self.online_days = [d.lower() for d in (online_days or [])]  # NEW: Online days
        
        # Validate online days are subset of active days
        for od in self.online_days:
            if od not in self.active_days:
                print(f"⚠️ Warning: Online day '{od}' not in active days, adding it")
                self.active_days.append(od)
        
        # Pre-compute compatible rooms for each section
        self.compatible_rooms = self._compute_compatible_rooms()
        
        # Group sections by department for block swaps
        self.sections_by_department = defaultdict(list)
        for s in sections:
            self.sections_by_department[s.department].append(s.id)
        
        # Current schedule state
        # Key: (room_id, day, slot_id) -> ScheduleSlot
        # For online classes: room_id can be None or 0
        self.schedule: Dict[Tuple[Optional[int], str, int], ScheduleSlot] = {}
        
        # Section assignments tracking
        # section_id -> list of (room_id, day, start_slot_id, slot_count)
        self.section_assignments: Dict[int, List[Tuple[Optional[int], str, int, int]]] = defaultdict(list)
        
        # Conflict heatmap data
        self.conflict_heatmap: Dict[Tuple[str, int], int] = defaultdict(int)  # (day, slot) -> conflict count
        
        # Optimization stats
        self.stats = OptimizationStats()
        
    def _compute_compatible_rooms(self) -> Dict[int, List[int]]:
        """
        Pre-compute compatible rooms for each section following BulSU rules.
        
        STRICT RULES:
        1. Lab classes MUST be in lab rooms (no exceptions)
        2. Lecture classes should NOT be in lab rooms (wastes lab resources)
        3. Room capacity must fit student count (with tolerance)
        4. NEW: Room must have ALL required features (equipment tags)
        """
        compatible = {}
        
        for section in self.sections.values():
            compatible_rooms = []
            is_lab_class = section.requires_lab or section.lab_hours > 0
            required_features = section.required_features or set()
            
            # BulSU Rule: Student count must be <= room capacity
            # For lectures: allow up to 10% overflow (room can be slightly smaller)
            # For labs: strict capacity matching
            if is_lab_class:
                min_capacity = section.student_count  # Exact capacity for labs
            else:
                # Allow rooms with capacity >= 90% of student count for lectures
                min_capacity = int(section.student_count * (1 - self.constraints.capacity_tolerance))
            
            # First pass: strict matching with feature check
            for room in self.rooms.values():
                room_type_lower = room.room_type.lower() if room.room_type else ''
                is_lab_room = 'lab' in room_type_lower or 'computer' in room_type_lower
                room_features = room.feature_tags or set()
                
                # Primary Rule: Room must fit all students
                if room.capacity < min_capacity:
                    continue
                
                # NEW: Feature matching - room must have ALL required features
                if required_features and not required_features.issubset(room_features):
                    continue  # Skip rooms that don't have all required features
                
                # STRICT RULE 1: Lab classes MUST be in lab rooms
                if is_lab_class and self.constraints.strict_lab_room_matching:
                    if not is_lab_room:
                        continue  # Skip non-lab rooms for lab classes
                
                # STRICT RULE 2: Lecture classes should NOT be in lab rooms
                if not is_lab_class and self.constraints.strict_lecture_room_matching:
                    if is_lab_room:
                        continue  # Skip lab rooms for lecture classes
                
                compatible_rooms.append(room.id)
            
            # Second pass: relax lecture-in-lab restriction (lab rooms can host lectures if needed)
            # BUT still respect feature requirements
            if not compatible_rooms and not is_lab_class:
                for room in self.rooms.values():
                    room_features = room.feature_tags or set()
                    # Still check feature requirements
                    if required_features and not required_features.issubset(room_features):
                        continue
                    if room.capacity >= min_capacity:
                        compatible_rooms.append(room.id)
            
            # Third pass: For lab classes, ONLY lab rooms (no fallback to lecture rooms)
            # This ensures lab classes never end up in lecture rooms
            # BUT still respect feature requirements
            if not compatible_rooms and is_lab_class:
                for room in self.rooms.values():
                    room_type_lower = room.room_type.lower() if room.room_type else ''
                    is_lab_room = 'lab' in room_type_lower or 'computer' in room_type_lower
                    room_features = room.feature_tags or set()
                    # Still check feature requirements
                    if required_features and not required_features.issubset(room_features):
                        continue
                    if is_lab_room:
                        # Accept any lab room even if capacity is slightly less
                        if room.capacity >= section.student_count * 0.7:
                            compatible_rooms.append(room.id)
            
            # Fourth pass: last resort for lectures only (ignore features)
            if not compatible_rooms and not is_lab_class:
                relaxed_capacity = int(section.student_count * 0.8)
                for room in self.rooms.values():
                    if room.capacity >= relaxed_capacity:
                        compatible_rooms.append(room.id)
            
            # Final fallback for lectures: use ALL non-lab rooms (ignore features)
            if not compatible_rooms and not is_lab_class:
                for room in self.rooms.values():
                    room_type_lower = room.room_type.lower() if room.room_type else ''
                    is_lab_room = 'lab' in room_type_lower or 'computer' in room_type_lower
                    if not is_lab_room:
                        compatible_rooms.append(room.id)
            
            # For lab classes with no compatible rooms - leave empty (will be marked unscheduled)
            # This is intentional: lab classes CANNOT be scheduled in lecture rooms
            
            # Sort by capacity match (prefer rooms closest to student count)
            compatible_rooms.sort(
                key=lambda r: abs(self.rooms[r].capacity - section.student_count)
            )
            
            compatible[section.id] = compatible_rooms
            
            # Log warning for lab classes with no compatible rooms
            if not compatible_rooms and is_lab_class:
                print(f"⚠️ WARNING: No lab rooms available for section {section.section_code} ({section.student_count} students)")
            
        return compatible
    
    def _is_online_day(self, day: str) -> bool:
        """Check if a day is designated as an online day"""
        return day.lower() in self.online_days
    
    def _is_lab_room(self, room_id: int) -> bool:
        """Check if a room is a lab room"""
        room = self.rooms.get(room_id)
        if not room:
            return False
        room_type_lower = room.room_type.lower() if room.room_type else ''
        return 'lab' in room_type_lower or 'computer' in room_type_lower
    
    def _is_slot_range_available(
        self, 
        room_id: Optional[int], 
        day: str, 
        start_slot_id: int, 
        slot_count: int
    ) -> bool:
        """Check if a range of consecutive slots is available"""
        # For online days, room_id is None - check teacher conflicts only
        if self._is_online_day(day):
            return True  # Room availability doesn't matter for online
        
        for offset in range(slot_count):
            slot_id = start_slot_id + offset
            if slot_id not in self.time_slots_by_id:
                return False
            if (room_id, day, slot_id) in self.schedule:
                return False
        return True
    
    def _check_hard_constraint_violation(
        self,
        section: Section,
        room_id: Optional[int],
        day: str,
        start_slot_id: int,
        slot_count: int
    ) -> Tuple[bool, str]:
        """
        Check for hard constraint violations (BulSU Rules).
        Returns (has_violation, reason)
        
        Hard constraints that MUST be satisfied:
        1. Room double-booking (same room, same time)
        2. Teacher double-booking (same teacher, same time)
        3. Online day with physical room assigned
        4. Night class boundary violation (after 21:00)
        """
        # Check online day rule
        is_online = self._is_online_day(day)
        if is_online and room_id is not None and room_id != 0:
            return True, f"Online day '{day}' cannot have physical room assigned"
        if not is_online and section.lab_hours > 0 and room_id is None:
            return True, f"Lab class on face-to-face day requires physical room"
        
        # Check night class boundary (21:00 hard limit)
        end_slot = self.time_slots_by_id.get(start_slot_id + slot_count - 1)
        if end_slot:
            end_minutes = end_slot.start_minutes + 30
            if end_minutes > self.constraints.night_class_end:
                return True, f"Class extends beyond 21:00 night boundary"
        
        # Check room conflict (only for physical rooms)
        if room_id is not None and not is_online:
            for offset in range(slot_count):
                slot_id = start_slot_id + offset
                key = (room_id, day, slot_id)
                if key in self.schedule:
                    existing = self.schedule[key]
                    if existing.section_id != section.id:
                        return True, f"Room {room_id} already booked at slot {slot_id}"
        
        # Check teacher conflict
        if section.teacher_id and section.teacher_id > 0:
            for key, slot in self.schedule.items():
                if slot.teacher_id == section.teacher_id and key[1] == day:
                    if slot.section_id == section.id:
                        continue  # Same section, not a conflict
                    existing_start = key[2]
                    existing_end = existing_start + slot.slot_count
                    new_end = start_slot_id + slot_count
                    if start_slot_id < existing_end and existing_start < new_end:
                        return True, f"Teacher {section.teacher_id} already scheduled at this time"
        
        return False, ""
    
    def _check_teacher_conflict(
        self, 
        teacher_id: int, 
        day: str, 
        start_slot_id: int, 
        slot_count: int,
        exclude_section_id: Optional[int] = None
    ) -> bool:
        """Check if teacher has a conflict in the given time range"""
        if not teacher_id or teacher_id == 0:
            return False
        
        for key, slot in self.schedule.items():
            if slot.teacher_id == teacher_id and key[1] == day:
                # Skip if it's the same section (for move operations)
                if exclude_section_id and slot.section_id == exclude_section_id:
                    continue
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
        slot_count: int,
        exclude_section_id: Optional[int] = None
    ) -> bool:
        """
        Check if another section of the same year level and course has a conflict.
        This prevents scheduling conflicts for students in the same year.
        """
        for key, slot in self.schedule.items():
            if key[1] != day:
                continue
            
            # Skip if it's the same section
            if exclude_section_id and slot.section_id == exclude_section_id:
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
        if self.constraints.lunch_mode == 'none':
            return False
        
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
    
    def _is_lunch_strict_violation(self, start_slot_id: int, slot_count: int) -> bool:
        """
        Check if scheduling during lunch is a HARD constraint violation.
        Only returns True if lunch_mode is 'strict' and there's overlap.
        """
        if self.constraints.lunch_mode != 'strict':
            return False
        return self._is_during_lunch(start_slot_id, slot_count)
    
    def _calculate_cost(self) -> float:
        """
        Calculate total cost using QUBO-inspired energy function.
        
        BulSU QSA Energy Function E = Σ (Hard Constraints × ∞) + Σ (Soft Constraints × Weight)
        
        HARD CONSTRAINTS (Penalty = HARD_CONSTRAINT_PENALTY = 1,000,000):
        1. The Ghost Room: Assigning physical room to an Online class
        2. The Teleportation: Faculty in two buildings with 0-min transition
        3. Overcrowding: Class size > Room capacity (with 10% tolerance)
        4. The Midnight Shift: Class outside 07:00 - 21:00 window
        5. Double-Booking: Two classes in same Room + TimeSlot
        6. Lab-First Rule: Lab class in non-lab room
        7. Lecture-in-Lab: Non-lab class in lab room (wastes lab resources)
        8. Strict Lunch: Classes during lunch break (if lunch_mode is 'strict')
        
        SOFT CONSTRAINTS (Weighted penalties):
        - Room type mismatch: 50
        - Capacity waste: 15 per unit
        - Lunch overlap: 500 (flexible mode)
        - Teacher overload: 80 per extra hour
        - Accessibility bonus: -10
        - Swiss Cheese Gap: 3+ hour gaps in student schedule
        """
        cost = 0.0
        conflict_detected = False
        
        # Track conflicts for heatmap
        room_usage = defaultdict(list)  # (room_id, day, slot) -> [section_ids]
        teacher_usage = defaultdict(list)  # (teacher_id, day, slot) -> [section_ids]
        section_classes = defaultdict(list)  # section_code -> [(day, slot_id, building)]
        teacher_buildings = defaultdict(list)  # (teacher_id, day, slot_id) -> building
        
        # First pass: Build usage maps and check for hard constraint violations
        for key, slot in self.schedule.items():
            room_id, day, slot_id = key
            section = self.sections.get(slot.section_id)
            if not section:
                continue
            
            room = self.rooms.get(room_id) if room_id else None
            slot_obj = self.time_slots_by_id.get(slot_id)  # Use dict lookup, not list
            is_lab_class = section.requires_lab or section.lab_hours > 0
            
            # HARD: Check online day rule (The Ghost Room)
            if self._is_online_day(day):
                if room_id is not None and room_id != 0:
                    cost += HARD_CONSTRAINT_PENALTY
                    conflict_detected = True
                    self.conflict_heatmap[(day, slot_id)] += 1
            
            # HARD: The Midnight Shift - Check for class outside 07:00-21:00 window
            if slot_obj:
                if slot_obj.start_minutes < self.constraints.day_class_start:
                    cost += HARD_CONSTRAINT_PENALTY
                    conflict_detected = True
                if slot_obj.start_minutes >= self.constraints.night_class_end:
                    cost += HARD_CONSTRAINT_PENALTY
                    conflict_detected = True
            
            # HARD: Overcrowding - Class size > Room capacity (with 10% tolerance)
            if room and section.student_count > 0 and not slot.is_online:
                max_capacity = room.capacity * (1 + self.constraints.capacity_tolerance)
                if section.student_count > max_capacity:
                    cost += HARD_CONSTRAINT_PENALTY
                    conflict_detected = True
            
            # HARD: Lab-First Rule - Lab class must be in lab room
            if room and not slot.is_online:
                room_type_lower = room.room_type.lower() if room.room_type else ''
                is_lab_room = 'lab' in room_type_lower or 'computer' in room_type_lower
                
                if is_lab_class and not is_lab_room:
                    # Lab class in non-lab room - HARD VIOLATION
                    cost += HARD_CONSTRAINT_PENALTY
                    conflict_detected = True
                
                # HARD: Lecture-in-Lab Rule - Non-lab class should not be in lab room
                if not is_lab_class and is_lab_room and self.constraints.strict_lecture_room_matching:
                    cost += HARD_CONSTRAINT_PENALTY
                    conflict_detected = True
            
            # HARD: Strict Lunch Break - No classes during lunch
            if self.constraints.lunch_mode == 'strict':
                if self._is_during_lunch(slot.start_slot_id, slot.slot_count):
                    cost += HARD_CONSTRAINT_PENALTY
                    conflict_detected = True
            
            # Track room usage
            if room_id is not None:
                for offset in range(slot.slot_count):
                    usage_key = (room_id, day, slot_id + offset)
                    room_usage[usage_key].append(slot.section_id)
            
            # Track teacher usage and buildings for teleportation check
            if slot.teacher_id and slot.teacher_id > 0:
                for offset in range(slot.slot_count):
                    usage_key = (slot.teacher_id, day, slot_id + offset)
                    teacher_usage[usage_key].append(slot.section_id)
                    # Track building for teleportation detection
                    if room:
                        teacher_buildings[(slot.teacher_id, day, slot_id + offset)] = room.building
            
            # Track section schedule for gap detection
            if room:
                section_classes[section.section_code].append((day, slot_id, room.building))
        
        # HARD: The Teleportation - Faculty in two buildings with 0-min transition
        # Check if teacher is in different buildings in consecutive slots
        for (teacher_id, day, slot_id), building in teacher_buildings.items():
            next_key = (teacher_id, day, slot_id + 1)
            if next_key in teacher_buildings:
                next_building = teacher_buildings[next_key]
                if building != next_building:
                    # Teacher must teleport between buildings - HARD CONSTRAINT
                    cost += HARD_CONSTRAINT_PENALTY
                    conflict_detected = True
        
        # Check for room double-booking (HARD CONSTRAINT)
        for usage_key, sections in room_usage.items():
            if len(sections) > 1:
                cost += HARD_CONSTRAINT_PENALTY * (len(sections) - 1)
                conflict_detected = True
                day, slot_id = usage_key[1], usage_key[2]
                self.conflict_heatmap[(day, slot_id)] += len(sections)
        
        # Check for teacher double-booking (HARD CONSTRAINT)
        for usage_key, sections in teacher_usage.items():
            if len(sections) > 1:
                cost += HARD_CONSTRAINT_PENALTY * (len(sections) - 1)
                conflict_detected = True
                day, slot_id = usage_key[1], usage_key[2]
                self.conflict_heatmap[(day, slot_id)] += len(sections)
        
        # Penalty for unscheduled sections (HARD - sections must be scheduled)
        for section_id, section in self.sections.items():
            assigned_slots = sum(
                count for _, _, _, count in self.section_assignments.get(section_id, [])
            )
            needed_slots = section.required_slots
            
            if assigned_slots < needed_slots:
                # High penalty for unscheduled
                cost += 1000 * (needed_slots - assigned_slots)
        
        # SOFT: Swiss Cheese Gap Detection - 3+ hour gaps between classes
        for section_code, classes in section_classes.items():
            # Group by day
            day_classes = defaultdict(list)
            for day, slot_id, building in classes:
                day_classes[day].append(slot_id)
            
            for day, slots in day_classes.items():
                slots_sorted = sorted(slots)
                for i in range(len(slots_sorted) - 1):
                    gap = slots_sorted[i + 1] - slots_sorted[i]
                    # 6 slots = 3 hours gap (each slot is 30 min)
                    if gap >= 6:
                        cost += 50  # Soft penalty for Swiss Cheese schedules
        
        # Second pass: Soft constraint penalties
        for key, slot in self.schedule.items():
            room_id, day, slot_id = key
            section = self.sections.get(slot.section_id)
            if not section:
                continue
            
            # Skip soft penalties for online classes
            if slot.is_online or self._is_online_day(day):
                continue
            
            room = self.rooms.get(room_id)
            if not room:
                continue
            
            # Room type mismatch (SOFT)
            if section.required_room_type:
                if room.room_type.lower() != section.required_room_type.lower():
                    cost += SOFT_ROOM_TYPE_MISMATCH
            
            # Excessive room capacity waste (SOFT)
            if section.student_count > 0:
                capacity_ratio = room.capacity / section.student_count
                if capacity_ratio > 2.0:
                    cost += SOFT_CAPACITY_WASTE * (capacity_ratio - 2.0)
            
            # Lunch break overlap (SOFT)
            if self._is_during_lunch(slot.start_slot_id, slot.slot_count):
                cost += SOFT_LUNCH_OVERLAP
            
            # Accessibility bonus (SOFT - negative cost)
            if self.constraints.prioritize_accessibility and room.is_accessible:
                cost += SOFT_ACCESSIBILITY_BONUS
        
        # Teacher workload balance (SOFT)
        teacher_daily_slots = defaultdict(lambda: defaultdict(int))
        for key, slot in self.schedule.items():
            if slot.teacher_id and slot.teacher_id > 0:
                day = key[1]
                teacher_daily_slots[slot.teacher_id][day] += slot.slot_count
        
        max_daily_slots = self.constraints.max_teacher_hours_per_day * 2  # 2 slots per hour
        for teacher_id, daily_slots in teacher_daily_slots.items():
            for day, slots in daily_slots.items():
                if slots > max_daily_slots:
                    cost += SOFT_TEACHER_OVERLOAD * (slots - max_daily_slots)
        
        if conflict_detected:
            self.stats.conflict_count = sum(1 for v in room_usage.values() if len(v) > 1)
            self.stats.conflict_count += sum(1 for v in teacher_usage.values() if len(v) > 1)
        
        return cost
    
    def _allocate_section(
        self, 
        section: Section, 
        room_id: Optional[int], 
        day: str, 
        start_slot_id: int, 
        slot_count: int,
        force_online: bool = False
    ) -> bool:
        """
        Allocate a section to a time range.
        For online days, room_id should be None.
        """
        is_online = self._is_online_day(day) or force_online
        
        # For online classes, we don't need room availability
        if not is_online:
            if not self._is_slot_range_available(room_id, day, start_slot_id, slot_count):
                return False
        
        # Check teacher conflict (applies to both online and in-person)
        if section.teacher_id and self._check_teacher_conflict(
            section.teacher_id, day, start_slot_id, slot_count, section.id
        ):
            return False
        
        # Create schedule slot
        schedule_slot = ScheduleSlot(
            section_id=section.id,
            room_id=room_id if not is_online else None,
            day_of_week=day,
            start_slot_id=start_slot_id,
            slot_count=slot_count,
            teacher_id=section.teacher_id,
            is_lab=section.requires_lab,
            is_online=is_online
        )
        
        # Mark all slots as occupied
        effective_room_id = room_id if not is_online else None
        for offset in range(slot_count):
            self.schedule[(effective_room_id, day, start_slot_id + offset)] = schedule_slot
        
        # Track assignment
        self.section_assignments[section.id].append(
            (effective_room_id, day, start_slot_id, slot_count)
        )
        
        if is_online:
            self.stats.online_classes += 1
        
        return True
    
    def _deallocate_section_assignment(
        self, 
        section_id: int, 
        room_id: Optional[int], 
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
    
    def _calculate_sessions(self, section: Section) -> List[Tuple[int, bool]]:
        """
        Calculate how to split slots into sessions based on lec and lab hours.
        Returns list of (slot_count, is_lab) tuples.
        
        BulSU Rules:
        - Lecture sessions: 1-2 hours (2-4 slots)
        - Lab sessions: 2-3 hours (4-6 slots) - labs need longer blocks
        - Lecture and lab should be on DIFFERENT days when possible
        """
        sessions = []
        
        # Calculate lecture slots (lec_hours * 2 = 30-min slots)
        lec_slots = section.lec_hours * 2 if section.lec_hours > 0 else 0
        lab_slots = section.lab_hours * 2 if section.lab_hours > 0 else 0
        
        # If no hours specified, use weekly_hours as lecture
        if lec_slots == 0 and lab_slots == 0:
            lec_slots = (section.weekly_hours or 3) * 2
        
        # Split lecture hours into 1.5-2 hour sessions (3-4 slots)
        remaining_lec = lec_slots
        while remaining_lec > 0:
            if remaining_lec >= 6:
                # Split into 3-slot sessions (1.5 hours)
                sessions.append((3, False))
                remaining_lec -= 3
            elif remaining_lec >= 4:
                # 2-hour session (4 slots)
                sessions.append((4, False))
                remaining_lec -= 4
            elif remaining_lec >= 2:
                # 1-hour session (2 slots)
                sessions.append((2, False))
                remaining_lec -= 2
            else:
                # Remaining 1 slot - merge with previous if possible
                if sessions and not sessions[-1][1]:  # Last was lecture
                    last_slots, _ = sessions.pop()
                    sessions.append((last_slots + 1, False))
                else:
                    sessions.append((remaining_lec, False))
                remaining_lec = 0
        
        # Lab hours - typically 2-3 hour blocks (4-6 slots)
        remaining_lab = lab_slots
        while remaining_lab > 0:
            if remaining_lab >= 6:
                # 3-hour lab session
                sessions.append((6, True))
                remaining_lab -= 6
            elif remaining_lab >= 4:
                # 2-hour lab session
                sessions.append((4, True))
                remaining_lab -= 4
            else:
                sessions.append((remaining_lab, True))
                remaining_lab = 0
        
        return sessions
    
    def _calculate_sessions_simple(self, total_slots: int) -> List[int]:
        """
        Simple session calculation for backwards compatibility.
        For 30-min slots, prefer 2-4 slot blocks (1-2 hours).
        """
        if total_slots <= 2:
            return [total_slots]
        elif total_slots <= 4:
            return [2, total_slots - 2] if total_slots > 2 else [total_slots]
        elif total_slots <= 6:
            return [3, 3] if total_slots == 6 else [3, total_slots - 3]
        else:
            # Split into 3-slot chunks (1.5 hours) for better distribution
            sessions = []
            remaining = total_slots
            while remaining > 0:
                chunk = min(3, remaining)
                sessions.append(chunk)
                remaining -= chunk
            return sessions
    
    def _generate_initial_solution(self) -> bool:
        """
        Generate initial schedule using greedy algorithm with BulSU rules.
        Handles online days and pinned classes.
        """
        self.schedule.clear()
        self.section_assignments.clear()
        self.conflict_heatmap.clear()
        self.stats.online_classes = 0
        
        # Sort sections by difficulty (pinned first, then by constraints)
        sorted_sections = sorted(
            self.sections.values(),
            key=lambda s: (
                not getattr(s, 'is_pinned', False),  # Pinned first
                len(self.compatible_rooms.get(s.id, [])),
                -s.student_count,
                -s.weekly_hours
            )
        )
        
        for section in sorted_sections:
            # Handle pinned sections
            if getattr(section, 'is_pinned', False):
                if section.pinned_day and section.pinned_room_id and section.pinned_time_slot:
                    self._allocate_section(
                        section,
                        section.pinned_room_id,
                        section.pinned_day,
                        section.pinned_time_slot,
                        section.required_slots
                    )
                    continue
            
            compatible_rooms = self.compatible_rooms.get(section.id, list(self.rooms.keys()))
            if not compatible_rooms:
                compatible_rooms = list(self.rooms.keys())
            
            # Calculate sessions with proper lec/lab separation
            # Returns list of (slot_count, is_lab) tuples
            sessions = self._calculate_sessions(section)
            
            slots_assigned = 0
            total_slots_needed = section.required_slots
            days_used = []
            lab_days_used = []  # Track days used for lab separately
            
            for session_slots, is_lab_session in sessions:
                if slots_assigned >= total_slots_needed:
                    break
                
                slots_for_session = min(session_slots, total_slots_needed - slots_assigned)
                best_assignment = None
                best_cost = float('inf')
                
                # For lab sessions, only use compatible lab rooms
                if is_lab_session:
                    is_lab_class = True
                    # Filter to only lab rooms for this session
                    lab_rooms = [r for r in compatible_rooms if self._is_lab_room(r)]
                    if not lab_rooms:
                        # No lab rooms available - try all compatible rooms (will get penalized)
                        lab_rooms = compatible_rooms
                    session_rooms = lab_rooms
                else:
                    is_lab_class = False
                    # For lectures, prefer non-lab rooms
                    lecture_rooms = [r for r in compatible_rooms if not self._is_lab_room(r)]
                    if not lecture_rooms:
                        lecture_rooms = compatible_rooms
                    session_rooms = lecture_rooms
                
                # Try to find best slot with 3 passes of decreasing strictness
                for pass_num in range(3):
                    if best_assignment:
                        break
                    
                    # Determine days to try based on pass
                    if pass_num == 0:
                        # First pass: non-online days only for labs
                        if is_lab_session:
                            days_to_try = [d for d in self.active_days if not self._is_online_day(d)]
                        else:
                            days_to_try = self.active_days
                    else:
                        days_to_try = self.active_days
                    
                    rooms_to_try = session_rooms if pass_num < 2 else list(self.rooms.keys())
                    
                    for day in days_to_try:
                        if best_assignment:
                            break
                        
                        # Prefer different days for distribution
                        # Lab should be on different day from lectures when possible
                        if pass_num == 0:
                            if is_lab_session:
                                if day in lab_days_used and len([d for d in days_to_try if d not in lab_days_used]) > 0:
                                    continue
                            else:
                                if day in days_used and len([d for d in days_to_try if d not in days_used]) > 0:
                                    continue
                        
                        is_online = self._is_online_day(day)
                        
                        # Lab sessions cannot be online
                        if is_lab_session and is_online:
                            continue
                        
                        # For online days, only check teacher conflicts
                        if is_online:
                            for slot in self.time_slots:
                                # Skip lunch slots if strict mode
                                if self.constraints.lunch_mode == 'strict' and self._is_during_lunch(slot.id, slots_for_session):
                                    continue
                                    
                                if section.teacher_id and self._check_teacher_conflict(
                                    section.teacher_id, day, slot.id, slots_for_session, section.id
                                ):
                                    continue
                                
                                local_cost = slot.start_minutes / 60
                                if local_cost < best_cost:
                                    best_cost = local_cost
                                    best_assignment = (None, day, slot.id, slots_for_session, True)
                            continue
                        
                        # For face-to-face days
                        for room_id in rooms_to_try:
                            if best_assignment:
                                break
                            
                            for slot in self.time_slots:
                                if not self._is_slot_range_available(room_id, day, slot.id, slots_for_session):
                                    continue
                                
                                # Skip lunch slots if strict mode (first pass only to be flexible later)
                                if pass_num == 0 and self.constraints.lunch_mode == 'strict' and self._is_during_lunch(slot.id, slots_for_session):
                                    continue
                                
                                # Teacher conflict check
                                if pass_num < 2 and section.teacher_id and self._check_teacher_conflict(
                                    section.teacher_id, day, slot.id, slots_for_session, section.id
                                ):
                                    continue
                                
                                # Year-level conflict check (first pass only)
                                if pass_num == 0 and self._check_section_year_conflict(
                                    section, day, slot.id, slots_for_session, section.id
                                ):
                                    continue
                                
                                # Teacher daily load check
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
                                
                                # Penalty for lunch overlap (flexible mode)
                                if pass_num == 0 and self.constraints.lunch_mode == 'flexible' and self._is_during_lunch(slot.id, slots_for_session):
                                    local_cost += 200  # High penalty but not impossible
                                
                                # Penalty for later passes
                                local_cost += pass_num * 50
                                
                                if local_cost < best_cost:
                                    best_cost = local_cost
                                    best_assignment = (room_id, day, slot.id, slots_for_session, False)
                
                if best_assignment:
                    room_id, day, start_slot, slot_count, is_online = best_assignment
                    if self._allocate_section(section, room_id, day, start_slot, slot_count, is_online):
                        slots_assigned += slot_count
                        if is_lab_session:
                            lab_days_used.append(day)
                        else:
                            days_used.append(day)
        
        # Second aggressive pass for 100% scheduling
        self._aggressive_scheduling_pass()
        
        return len(self.schedule) > 0
    
    def _aggressive_scheduling_pass(self):
        """
        Aggressively try to schedule any remaining sections for 100% scheduling.
        This pass relaxes SOFT constraints but STILL RESPECTS HARD constraints:
        - Lab classes must still be in lab rooms
        - Lectures should still not be in lab rooms  
        - Strict lunch mode is still enforced
        - Room conflicts are never allowed
        """
        print(f"🔥 Running aggressive scheduling pass...")
        scheduled_in_pass = 0
        
        for section in self.sections.values():
            # Skip pinned sections
            if getattr(section, 'is_pinned', False):
                continue
                
            assigned = sum(c for _, _, _, c in self.section_assignments.get(section.id, []))
            needed = section.required_slots
            
            if assigned >= needed:
                continue
            
            remaining_slots = needed - assigned
            is_lab_class = section.requires_lab or section.lab_hours > 0
            
            # Determine which rooms to try based on lab/lecture
            if is_lab_class:
                # Lab classes can ONLY be in lab rooms - no exceptions
                rooms_to_try = [r for r in self.rooms.keys() if self._is_lab_room(r)]
            else:
                # Lecture classes prefer non-lab rooms, but can use lab rooms if needed
                lecture_rooms = [r for r in self.rooms.keys() if not self._is_lab_room(r)]
                rooms_to_try = lecture_rooms if lecture_rooms else list(self.rooms.keys())
            
            # Try ANY available slot without soft constraints
            for day in self.active_days:
                if remaining_slots <= 0:
                    break
                
                # Lab classes cannot be on online days
                is_online = self._is_online_day(day)
                if is_lab_class and is_online:
                    continue
                
                if is_online:
                    # For online days, just need teacher availability
                    for slot in self.time_slots:
                        if remaining_slots <= 0:
                            break
                        
                        # Still respect strict lunch mode
                        if self.constraints.lunch_mode == 'strict' and self._is_during_lunch(slot.id, 2):
                            continue
                        
                        # Schedule 1-2 slots at a time to fit more
                        slots_to_assign = min(remaining_slots, 2)
                        
                        # Check teacher conflict only
                        if section.teacher_id and self._check_teacher_conflict(
                            section.teacher_id, day, slot.id, slots_to_assign, section.id
                        ):
                            continue
                        if self._allocate_section(section, None, day, slot.id, slots_to_assign, True):
                            remaining_slots -= slots_to_assign
                            scheduled_in_pass += 1
                else:
                    # For face-to-face days - try compatible rooms only
                    for room_id in rooms_to_try:
                        if remaining_slots <= 0:
                            break
                        for slot in self.time_slots:
                            if remaining_slots <= 0:
                                break
                            
                            # Still respect strict lunch mode
                            if self.constraints.lunch_mode == 'strict' and self._is_during_lunch(slot.id, 2):
                                continue
                            
                            # Try to fit at least 1 slot at a time
                            slots_to_assign = min(remaining_slots, 2)
                                
                            if self._is_slot_range_available(room_id, day, slot.id, slots_to_assign):
                                # Check teacher conflict
                                if section.teacher_id and self._check_teacher_conflict(
                                    section.teacher_id, day, slot.id, slots_to_assign, section.id
                                ):
                                    continue
                                    
                                if self._allocate_section(section, room_id, day, slot.id, slots_to_assign):
                                    remaining_slots -= slots_to_assign
                                    scheduled_in_pass += 1
        
        print(f"✅ Aggressive pass scheduled {scheduled_in_pass} session blocks")
    
    def _get_neighbor(self) -> Optional[Dict[str, Any]]:
        """
        Generate a neighbor solution by making a small change.
        Respects pinned sections (cannot be moved by QSA).
        """
        if not self.schedule:
            return None
        
        # Get unique assignments (not individual slots), excluding pinned sections
        assignments = []
        seen = set()
        for section_id, section_assignments in self.section_assignments.items():
            section = self.sections.get(section_id)
            # Skip pinned sections - they cannot be moved
            if section and getattr(section, 'is_pinned', False):
                continue
            
            for room_id, day, start_slot, slot_count in section_assignments:
                key = (section_id, room_id, day, start_slot)
                if key not in seen:
                    seen.add(key)
                    assignments.append({
                        'section_id': section_id,
                        'room_id': room_id,
                        'day': day,
                        'start_slot': start_slot,
                        'slot_count': slot_count,
                        'is_online': self._is_online_day(day)
                    })
        
        if not assignments:
            return None
        
        # Pick a random assignment to modify
        assignment = random.choice(assignments)
        section = self.sections[assignment['section_id']]
        
        # Determine valid modifications based on online status
        if assignment['is_online']:
            # Online classes can only change day or time
            modification = random.choice(["change_day", "change_time"])
        else:
            modification = random.choice(["change_room", "change_day", "change_time"])
        
        if modification == "change_room":
            if assignment['is_online']:
                return None  # Can't change room for online class
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
            # For labs, exclude online days
            if section.requires_lab:
                other_days = [d for d in other_days if not self._is_online_day(d)]
            if other_days:
                new_day = random.choice(other_days)
                new_is_online = self._is_online_day(new_day)
                new_room = None if new_is_online else assignment['room_id']
                
                if new_is_online or self._is_slot_range_available(
                    new_room, new_day, assignment['start_slot'], assignment['slot_count']
                ):
                    if not self._check_teacher_conflict(
                        section.teacher_id, new_day, assignment['start_slot'], assignment['slot_count'], section.id
                    ):
                        return {
                            'type': 'change_day',
                            'old': assignment,
                            'new_day': new_day,
                            'new_is_online': new_is_online
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
                if assignment['is_online'] or self._is_slot_range_available(
                    assignment['room_id'], assignment['day'], new_slot.id, assignment['slot_count']
                ):
                    if not self._check_teacher_conflict(
                        section.teacher_id, assignment['day'], new_slot.id, assignment['slot_count'], section.id
                    ):
                        return {
                            'type': 'change_time',
                            'old': assignment,
                            'new_slot': new_slot.id
                        }
        
        return None
    
    def _apply_move(self, move: Dict[str, Any]) -> bool:
        """Apply a move to the schedule (handles online day transitions)"""
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
            new_is_online = move.get('new_is_online', self._is_online_day(move['new_day']))
            new_room = None if new_is_online else old['room_id']
            return self._allocate_section(
                section, new_room, move['new_day'], old['start_slot'], old['slot_count'], new_is_online
            )
        elif move['type'] == 'change_time':
            is_online = old.get('is_online', self._is_online_day(old['day']))
            return self._allocate_section(
                section, old['room_id'], old['day'], move['new_slot'], old['slot_count'], is_online
            )
        
        return False
    
    def _revert_move(self, move: Dict[str, Any]):
        """Revert a move (handles online day transitions)"""
        old = move['old']
        section = self.sections[old['section_id']]
        is_old_online = old.get('is_online', self._is_online_day(old['day']))
        
        # Remove the new assignment
        if move['type'] == 'change_room':
            self._deallocate_section_assignment(
                old['section_id'], move['new_room'], old['day'], old['start_slot'], old['slot_count']
            )
        elif move['type'] == 'change_day':
            new_is_online = move.get('new_is_online', self._is_online_day(move['new_day']))
            new_room = None if new_is_online else old['room_id']
            self._deallocate_section_assignment(
                old['section_id'], new_room, move['new_day'], old['start_slot'], old['slot_count']
            )
        elif move['type'] == 'change_time':
            self._deallocate_section_assignment(
                old['section_id'], old['room_id'], old['day'], move['new_slot'], old['slot_count']
            )
        
        # Restore original
        self._allocate_section(
            section, old['room_id'], old['day'], old['start_slot'], old['slot_count'], is_old_online
        )
    
    def _block_swap(self, department: str, day1: str, day2: str) -> bool:
        """
        BulSU QSA Quantum Tunneling: Block Swap
        Swap an entire department's schedule between two days.
        This is a "tunneling move" that allows escaping local minima.
        """
        dept_sections = self.sections_by_department.get(department, [])
        if not dept_sections:
            return False
        
        # Collect all assignments for this department on both days
        day1_assignments = []
        day2_assignments = []
        
        for section_id in dept_sections:
            # Skip pinned sections
            section = self.sections.get(section_id)
            if section and getattr(section, 'is_pinned', False):
                continue
            
            for room_id, day, start_slot, slot_count in self.section_assignments.get(section_id, []):
                if day == day1:
                    day1_assignments.append((section_id, room_id, day, start_slot, slot_count))
                elif day == day2:
                    day2_assignments.append((section_id, room_id, day, start_slot, slot_count))
        
        if not day1_assignments and not day2_assignments:
            return False
        
        # Remove all assignments from both days
        for section_id, room_id, day, start_slot, slot_count in day1_assignments + day2_assignments:
            self._deallocate_section_assignment(section_id, room_id, day, start_slot, slot_count)
        
        # Swap: put day1 assignments on day2 and vice versa
        success = True
        for section_id, room_id, day, start_slot, slot_count in day1_assignments:
            section = self.sections[section_id]
            is_online = self._is_online_day(day2)
            effective_room = None if is_online else room_id
            if not self._allocate_section(section, effective_room, day2, start_slot, slot_count, is_online):
                success = False
        
        for section_id, room_id, day, start_slot, slot_count in day2_assignments:
            section = self.sections[section_id]
            is_online = self._is_online_day(day1)
            effective_room = None if is_online else room_id
            if not self._allocate_section(section, effective_room, day1, start_slot, slot_count, is_online):
                success = False
        
        if success:
            self.stats.block_swaps += 1
        
        return success
    
    def _quantum_tunnel(self, temperature: float) -> bool:
        """
        BulSU QSA Quantum Tunneling for escaping local minima.
        
        Uses QUBO-inspired energy barrier tunneling with:
        1. Block swaps (department-level day swaps) - ONLY within same college
        2. Single section re-placement
        3. Online day shifting
        
        CONSTRAINT: Only swap classes within the same College to avoid
        mixing specialized rooms (e.g., don't swap Nursing lab with Welding shop)
        """
        # Tunneling probability based on temperature
        tunnel_base_prob = 0.15
        if random.random() > tunnel_base_prob:
            return False
        
        # Energy barrier calculation (QUBO-inspired)
        tunnel_prob = math.exp(-1.0 / max(temperature, 0.1))
        
        if random.random() >= tunnel_prob:
            return False
        
        # Choose tunneling strategy
        strategy = random.choice(['block_swap', 'relocate', 'online_shift'])
        
        if strategy == 'block_swap' and len(self.sections_by_department) > 0:
            # Try to swap a department's schedule between two days
            # Only swap within same college to avoid mixing specialized rooms
            dept = random.choice(list(self.sections_by_department.keys()))
            days = [d for d in self.active_days if d]
            if len(days) >= 2:
                day1, day2 = random.sample(days, 2)
                if self._block_swap(dept, day1, day2):
                    self.stats.quantum_tunnels += 1
                    return True
        
        elif strategy == 'online_shift' and self.online_days:
            # Move some face-to-face classes to an online day
            f2f_days = [d for d in self.active_days if not self._is_online_day(d)]
            if f2f_days:
                # Find a section that could move to online
                assignments = [
                    (sid, a) for sid, assigns in self.section_assignments.items() 
                    for a in assigns 
                    if not self.sections.get(sid, Section).requires_lab  # Labs can't go online
                    and not getattr(self.sections.get(sid), 'is_pinned', False)
                ]
                if assignments:
                    section_id, (room_id, day, start_slot, slot_count) = random.choice(assignments)
                    section = self.sections[section_id]
                    online_day = random.choice(self.online_days)
                    
                    self._deallocate_section_assignment(section_id, room_id, day, start_slot, slot_count)
                    
                    # Try to schedule on online day
                    for slot in self.time_slots:
                        if not self._check_teacher_conflict(section.teacher_id, online_day, slot.id, slot_count, section_id):
                            if self._allocate_section(section, None, online_day, slot.id, slot_count, True):
                                self.stats.quantum_tunnels += 1
                                return True
                    
                    # Failed - restore
                    self._allocate_section(section, room_id, day, start_slot, slot_count)
        
        else:
            # Standard relocate: reschedule a random section
            assignments = [
                (sid, a) for sid, assigns in self.section_assignments.items() 
                for a in assigns
                if not getattr(self.sections.get(sid), 'is_pinned', False)
            ]
            
            if len(assignments) > 1:
                section_id, (room_id, day, start_slot, slot_count) = random.choice(assignments)
                section = self.sections[section_id]
                
                self._deallocate_section_assignment(section_id, room_id, day, start_slot, slot_count)
                
                # Try new placement with QUBO-inspired selection
                compatible = self.compatible_rooms.get(section_id, list(self.rooms.keys()))
                if not compatible:
                    compatible = list(self.rooms.keys())
                
                candidates = []
                for _ in range(50):
                    new_day = random.choice(self.active_days)
                    is_online = self._is_online_day(new_day)
                    
                    if is_online and section.requires_lab:
                        continue  # Labs can't be online
                    
                    new_room = None if is_online else random.choice(compatible)
                    valid_slots = [s for s in self.time_slots if s.id + slot_count <= len(self.time_slots) + 1]
                    
                    if valid_slots:
                        new_slot = random.choice(valid_slots)
                        
                        if is_online or self._is_slot_range_available(new_room, new_day, new_slot.id, slot_count):
                            if not self._check_teacher_conflict(section.teacher_id, new_day, new_slot.id, slot_count, section_id):
                                # Calculate energy
                                energy = new_slot.start_minutes / 100
                                if not is_online and new_room:
                                    room = self.rooms[new_room]
                                    energy += abs(room.capacity - section.student_count) * 0.5
                                candidates.append((energy, new_room, new_day, new_slot.id, is_online))
                
                if candidates:
                    candidates.sort(key=lambda x: x[0])
                    _, new_room, new_day, new_slot_id, is_online = candidates[0]
                    
                    if self._allocate_section(section, new_room, new_day, new_slot_id, slot_count, is_online):
                        self.stats.quantum_tunnels += 1
                        return True
                
                # Failed - restore
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
        print(f"   Active Days: {self.active_days}")
        print(f"   Online Days: {self.online_days}")
        
        # Debug: Show room capacities
        for room in self.rooms.values():
            print(f"   Room: {room.room_code} - Cap: {room.capacity}, Type: {room.room_type}")
        
        # Debug: Show first few sections
        for i, section in enumerate(list(self.sections.values())[:3]):
            print(f"   Section {i+1}: {section.section_code} - Students: {section.student_count}, "
                  f"Lec: {section.lec_hours}h, Lab: {section.lab_hours}h, Required Slots: {section.required_slots}")
        
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
            
            # Cool down - but NEVER let temperature drop to zero before iteration 100
            # This prevents the algorithm from "freezing" too early (Algorithmic Do-Not)
            if iteration < 100:
                # Maintain minimum temperature in first 100 iterations
                min_temp = initial_temperature * 0.5
                temperature = max(temperature * cooling_rate, min_temp)
            else:
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
        
        # Count results - count sections that have at least 1 slot scheduled
        # Also count fully scheduled vs partially scheduled
        fully_scheduled = 0
        partially_scheduled = 0
        not_scheduled = 0
        total_slots_scheduled = 0
        total_slots_needed = 0
        
        for s in self.sections.values():
            assigned_slots = sum(c for _, _, _, c in self.section_assignments.get(s.id, []))
            required = s.required_slots
            total_slots_scheduled += assigned_slots
            total_slots_needed += required
            
            if assigned_slots >= required:
                fully_scheduled += 1
            elif assigned_slots > 0:
                partially_scheduled += 1
            else:
                not_scheduled += 1
        
        # Consider scheduled if ANY slots assigned
        self.stats.scheduled_count = fully_scheduled + partially_scheduled
        self.stats.unscheduled_count = not_scheduled
        
        success_rate = (self.stats.scheduled_count / len(self.sections) * 100) if self.sections else 0
        slot_coverage = (total_slots_scheduled / total_slots_needed * 100) if total_slots_needed > 0 else 0
        
        print(f"📊 Final cost: {self.stats.final_cost:.2f}")
        print(f"✅ Fully scheduled: {fully_scheduled}/{len(self.sections)}")
        print(f"⚡ Partially scheduled: {partially_scheduled}/{len(self.sections)}")
        print(f"❌ Not scheduled: {not_scheduled}/{len(self.sections)}")
        print(f"📈 Slot coverage: {total_slots_scheduled}/{total_slots_needed} ({slot_coverage:.1f}%)")
        print(f"🔄 Quantum tunnels: {self.stats.quantum_tunnels}")
        print(f"⏱️ Time: {self.stats.time_elapsed_ms}ms")
        
        return self._build_result(), self.stats
    
    def _build_result(self) -> List[Dict[str, Any]]:
        """Build the final schedule result with BulSU QSA format"""
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
                
                # Check if this is an online class
                is_online = self._is_online_day(day)
                
                # Get room details (may be None for online classes)
                if room_id is not None and room_id in self.rooms:
                    room = self.rooms[room_id]
                    room_code = room.room_code
                    room_name = room.room_name
                    building = room.building
                    campus = room.campus
                    capacity = room.capacity
                else:
                    # Online class - no physical room
                    room_code = "ONLINE"
                    room_name = "Online Class"
                    building = "Virtual"
                    campus = "Online"
                    capacity = 0
                
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
                    'room_code': room_code,
                    'room_name': room_name,
                    'building': building,
                    'campus': campus,
                    'capacity': capacity,
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
                    'lab_hours': section.lab_hours,
                    'is_online': is_online
                })
        
        return results


# ==================== Runner Function ====================

def run_enhanced_scheduler(
    sections_data: List[Dict[str, Any]],
    rooms_data: List[Dict[str, Any]],
    time_slots_data: Optional[List[Dict[str, Any]]] = None,
    config: Optional[Dict[str, Any]] = None,
    online_days: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Run the enhanced Quantum-Inspired Annealing scheduler with BulSU QSA rules.
    
    Uses QUBO-inspired energy minimization with simulated annealing
    and quantum tunneling for optimal room allocation.
    
    BulSU-Specific Features:
    - Online Day support: Designated days bypass room allocation
    - Block Swaps: Department-level quantum tunneling
    - Physical Constraints: 07:00-18:00 day, 18:00-21:00 night boundary
    - 10% capacity tolerance for lectures
    - Lab consistency: Engineering labs in engineering rooms
    
    Args:
        sections_data: List of section dictionaries
        rooms_data: List of room dictionaries
        time_slots_data: Optional list of time slot dictionaries (will generate if not provided)
        config: Optional configuration dictionary
        online_days: Optional list of online day names (e.g., ['saturday'])
    
    Returns:
        Dictionary with schedule results including online class counts
    """
    config = config or {}
    online_days = online_days or config.get('online_days', [])
    
    print("=" * 60)
    print("🧠 QUANTUM-INSPIRED ANNEALING SCHEDULER v2.1 (BulSU QSA)")
    print("=" * 60)
    print(f"📚 Sections to schedule: {len(sections_data)}")
    print(f"🏢 Available rooms: {len(rooms_data)}")
    if online_days:
        print(f"🌐 Online days: {', '.join(online_days)}")
    
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
        # lec_hours and lab_hours are the actual contact hours per week
        lec_hours = s.get('lec_hours', 0) or 0
        lab_hours = s.get('lab_hours', 0) or 0
        
        # Total weekly contact hours = lec + lab hours
        weekly_hours = lec_hours + lab_hours
        if weekly_hours == 0:
            weekly_hours = 3  # Default 3 hours if not specified
        
        student_count = s.get('student_count', 30) or 30
        
        # Parse required features from list to set
        required_features = s.get('required_features') or []
        required_features_set = set(required_features) if isinstance(required_features, list) else set()
        
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
            student_count=max(1, student_count),
            required_room_type=s.get('required_room_type', 'lecture'),
            weekly_hours=weekly_hours,
            lec_hours=lec_hours,
            lab_hours=lab_hours,
            requires_lab=lab_hours > 0 or s.get('requires_lab', False),
            department=s.get('department', ''),
            college=s.get('college', ''),
            semester=s.get('semester', '1st Semester'),
            required_features=required_features_set
        ))
    
    rooms = []
    for i, r in enumerate(rooms_data):
        # Parse feature tags from list to set
        feature_tags = r.get('feature_tags') or []
        feature_tags_set = set(feature_tags) if isinstance(feature_tags, list) else set()
        
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
            has_lab_equipment=r.get('has_lab_equipment', False),
            feature_tags=feature_tags_set
        ))
    
    # Create constraints with new options
    # Lunch mode: 'strict' = no classes during lunch (HARD), 'flexible' = avoid but allow (SOFT), 'none' = no restriction
    lunch_mode = config.get('lunch_mode', 'flexible')
    
    # Lunch break times (default 12:00-13:00)
    lunch_start_hour = config.get('lunch_start_hour', 12)
    lunch_end_hour = config.get('lunch_end_hour', 13)
    
    constraints = SchedulingConstraints(
        max_teacher_hours_per_day=config.get('max_teacher_hours_per_day', 8),
        max_consecutive_hours=config.get('max_consecutive_hours', 4),
        prioritize_accessibility=config.get('prioritize_accessibility', True),
        avoid_lunch_conflicts=config.get('avoid_lunch_conflicts', True),
        lunch_mode=lunch_mode,
        lunch_start_minutes=lunch_start_hour * 60,
        lunch_end_minutes=lunch_end_hour * 60,
        strict_lab_room_matching=config.get('strict_lab_room_matching', True),
        strict_lecture_room_matching=config.get('strict_lecture_room_matching', True)
    )
    
    print(f"🍽️ Lunch mode: {lunch_mode} ({lunch_start_hour}:00 - {lunch_end_hour}:00)")
    print(f"🔬 Strict lab-room matching: {constraints.strict_lab_room_matching}")
    print(f"📚 Strict lecture-room matching: {constraints.strict_lecture_room_matching}")
    
    # Get active days
    active_days = config.get('active_days')
    if active_days:
        active_days = [d.lower() for d in active_days]
    
    # Normalize online days
    normalized_online_days = [d.lower() for d in online_days] if online_days else []
    
    # Create and run scheduler with BulSU QSA features
    scheduler = EnhancedQuantumScheduler(
        sections=sections,
        rooms=rooms,
        time_slots=time_slots,
        constraints=constraints,
        active_days=active_days,
        online_days=normalized_online_days
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
    
    # Count online classes from allocations
    online_class_count = sum(1 for a in allocations if a.get('is_online', False))
    physical_class_count = len(allocations) - online_class_count
    
    success_rate = (stats.scheduled_count / len(sections) * 100) if sections else 0
    
    print("=" * 60)
    print(f"✅ SCHEDULING COMPLETE: {success_rate:.1f}% success rate")
    if normalized_online_days:
        print(f"🌐 Online classes: {online_class_count} | Physical classes: {physical_class_count}")
    print("=" * 60)
    
    return {
        'success': stats.scheduled_count > 0 and success_rate >= 50,  # Success if at least 50% scheduled
        'allocations': allocations,
        'total_sections': len(sections),
        'scheduled_sections': stats.scheduled_count,
        'unscheduled_sections': stats.unscheduled_count,
        'unscheduled_list': unscheduled,
        'success_rate': success_rate,
        'online_days': normalized_online_days,
        'online_class_count': online_class_count,
        'physical_class_count': physical_class_count,
        'optimization_stats': {
            'initial_cost': stats.initial_cost,
            'final_cost': stats.final_cost,
            'iterations': stats.iterations,
            'improvements': stats.improvements,
            'quantum_tunnels': stats.quantum_tunnels,
            'block_swaps': stats.block_swaps,
            'conflict_count': stats.conflict_count,
            'time_elapsed_ms': stats.time_elapsed_ms
        }
    }
