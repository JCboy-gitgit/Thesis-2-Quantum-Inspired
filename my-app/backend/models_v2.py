"""
Enhanced Models for College Room Allocation System v2.0

Updated to support:
- Course/Section hierarchy (BSM CS -> 1A, 2A, 3A, 4A)
- 30-minute time slot intervals
- Faculty assigned sections with detailed load management
- Improved room type matching
"""

from pydantic import BaseModel, Field, validator
from typing import List, Dict, Optional, Any, Union
from enum import Enum
from datetime import time, date
from dataclasses import dataclass, field


# ==================== Enums ====================

class RoomType(str, Enum):
    LECTURE = "lecture"
    LABORATORY = "laboratory"
    COMPUTER_LAB = "computer_lab"
    SMART_ROOM = "smart_room"
    DRAWING_ROOM = "drawing_room"
    AVR = "avr"
    GYM = "gym"
    WORKSHOP = "workshop"


class UnitsType(str, Enum):
    LECTURE = "lecture"
    LAB = "lab"
    LECTURE_LAB = "lecture_lab"


class DayOfWeek(str, Enum):
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


class SemesterType(str, Enum):
    FIRST = "1st Semester"
    SECOND = "2nd Semester"
    SUMMER = "Summer"


class ScheduleStatus(str, Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    CONFLICT = "conflict"
    CANCELLED = "cancelled"


class EmploymentType(str, Enum):
    FULL_TIME = "full-time"
    PART_TIME = "part-time"
    VSL = "vsl"  # Visiting Lecturer? Or specific VSL designation
    ADJUNCT = "adjunct"
    GUEST = "guest"


# ==================== Room Models ====================

class RoomCSV(BaseModel):
    """Room CSV format for import"""
    room_id: str = Field(..., description="Unique ID (e.g., MN-CICT-301)")
    capacity: int = Field(..., ge=1, le=500, description="Maximum student seating")
    room_type: RoomType = Field(..., description="Room type for matching class needs")
    equipment_bitmask: str = Field(default="00000", description="Equipment flags: Projector, AC, Whiteboard, Computer, Lab Equipment")
    campus_id: str = Field(default="MAIN", description="Campus identifier")
    building: str = Field(..., description="Building name")
    floor_number: int = Field(default=1, ge=0, le=20)
    is_pwd_accessible: bool = Field(default=False)
    
    @validator('equipment_bitmask')
    def validate_equipment(cls, v):
        if len(v) != 5 or not all(c in '01' for c in v):
            raise ValueError('Equipment bitmask must be 5 binary digits')
        return v
    
    def get_equipment(self) -> Dict[str, bool]:
        """Parse equipment bitmask into readable dict"""
        keys = ['has_projector', 'has_ac', 'has_whiteboard', 'has_computers', 'has_lab_equipment']
        return {k: v == '1' for k, v in zip(keys, self.equipment_bitmask)}


class Room(BaseModel):
    """Full room model for scheduling"""
    id: int
    room_code: str
    room_name: Optional[str] = None
    building: str
    campus: str = "Main Campus"
    capacity: int = 30
    room_type: RoomType = RoomType.LECTURE
    floor_number: int = 1
    has_projector: bool = False
    has_ac: bool = False
    has_whiteboard: bool = True
    has_computers: int = 0
    has_lab_equipment: bool = False
    is_accessible: bool = False
    is_active: bool = True


# ==================== Faculty Models ====================

class FacultyCSV(BaseModel):
    """Faculty CSV format for import"""
    faculty_id: str = Field(..., description="Unique ID (e.g., BSU-CICT-042)")
    first_name: str
    last_name: str
    email: Optional[str] = None
    department: Optional[str] = None
    assigned_loads: List[str] = Field(default_factory=list, description="List of Assignment IDs")
    avail_mask: Optional[str] = Field(default=None, description="Binary availability grid [6 days x 26 slots]")
    home_bldg: Optional[str] = Field(default=None, description="Preferred building")
    max_units: int = Field(default=24, ge=1, le=36)
    employment_type: EmploymentType = Field(default=EmploymentType.FULL_TIME)
    preferred_times: Optional[str] = Field(default=None, description="morning, night, or any")
    unavailable_days: Optional[List[str]] = Field(default_factory=list, description="Days faculty cannot teach")


class FacultyAssignmentCSV(BaseModel):
    """Faculty Assigned Section CSV format"""
    assignment_id: str = Field(..., description="Unique key for this assignment (e.g., AL-001)")
    faculty_id: str = Field(..., description="The pre-assigned instructor")
    section_id: str = Field(..., description="The specific student block (e.g., BS-IT 3-A)")
    subject_code: str = Field(..., description="Subject code (e.g., IT-311)")
    subject_name: Optional[str] = None
    units_type: UnitsType = Field(..., description="Lecture or Lab determines room type")
    weekly_hours: int = Field(..., ge=1, le=12, description="Total hours to be scheduled")
    preferred_days: Optional[List[str]] = None


class Faculty(BaseModel):
    """Full faculty model for scheduling"""
    id: int
    faculty_id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    department: Optional[str] = None
    max_units: int = 24
    current_units: int = 0
    employment_type: str = "full-time"
    preferred_times: Optional[str] = None  # NEW: "morning", "night", "any"
    unavailable_days: List[str] = field(default_factory=list)  # NEW: e.g. ["Saturday"]
    home_building: Optional[str] = None
    is_active: bool = True
    
    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


# ==================== Course/Section Models ====================

class CourseCSV(BaseModel):
    """Course/Class CSV format for import - NEW FORMAT"""
    class_id: str = Field(..., description="Unique ID: Course + Section + Subject (e.g., CS-3A-ALGO)")
    course_code: str = Field(..., description="Program code (e.g., BSCS, BSIT)")
    course_name: str = Field(..., description="Program name")
    section: str = Field(..., description="Section identifier (e.g., 3A, 2B)")
    subject_code: str = Field(..., description="Subject code (e.g., IT-311, CS-201)")
    subject_name: str = Field(..., description="Subject name")
    size: int = Field(..., ge=1, le=500, description="Number of enrolled students")
    duration: int = Field(..., ge=1, le=6, description="Hours required per week")
    room_req: RoomType = Field(..., description="Minimum room type requirement")
    year_level: int = Field(..., ge=1, le=6, description="For conflict prevention")
    semester: SemesterType = SemesterType.FIRST
    academic_year: str = Field(default="2025-2026")
    department: Optional[str] = None
    college: Optional[str] = None
    lec_hours: int = Field(default=3)
    lab_hours: int = Field(default=0)
    total_hours: int = Field(default=3)  # Computed: lec_hours + lab_hours
    
    @validator('year_level', pre=True)
    def extract_year_level(cls, v, values):
        if isinstance(v, int):
            return v
        # Try to extract from section if year_level not provided
        section = values.get('section', '')
        if section and section[0].isdigit():
            return int(section[0])
        return 1


class Course(BaseModel):
    """Course (Program) definition"""
    id: int
    course_code: str
    course_name: str
    department: Optional[str] = None
    college: Optional[str] = None
    total_units: int = 0
    is_active: bool = True


class Section(BaseModel):
    """Section with subject assignment"""
    id: int
    section_code: str  # e.g., "BSCS-3A"
    course_code: str   # e.g., "BSCS"
    course_name: str
    subject_code: str  # e.g., "IT-311"
    subject_name: str
    year_level: int
    student_count: int
    faculty_id: Optional[int] = None
    faculty_name: Optional[str] = None
    required_room_type: RoomType = RoomType.LECTURE
    weekly_hours: int = 3
    lec_hours: int = 3
    lab_hours: int = 0
    requires_lab: bool = False
    semester: str = "1st Semester"
    academic_year: str = "2025-2026"
    department: Optional[str] = None
    college: Optional[str] = None
    status: ScheduleStatus = ScheduleStatus.PENDING


# ==================== Time Slot Models ====================

class TimeSlot(BaseModel):
    """30-minute time slot"""
    id: int
    slot_name: str  # e.g., "07:00-07:30"
    start_time: str  # "HH:MM" format
    end_time: str    # "HH:MM" format
    duration_minutes: int = 30
    
    @classmethod
    def generate_30min_slots(cls, start_hour: int = 7, end_hour: int = 21) -> List['TimeSlot']:
        """Generate all 30-minute slots for a day"""
        slots = []
        slot_id = 1
        for hour in range(start_hour, end_hour):
            for minute in [0, 30]:
                start = f"{hour:02d}:{minute:02d}"
                end_minute = (minute + 30) % 60
                end_hour_adj = hour + (1 if end_minute == 0 else 0)
                end = f"{end_hour_adj:02d}:{end_minute:02d}"
                slots.append(cls(
                    id=slot_id,
                    slot_name=f"{start}-{end}",
                    start_time=start,
                    end_time=end,
                    duration_minutes=30
                ))
                slot_id += 1
        return slots


# ==================== Schedule Entry Models ====================

class ScheduleEntry(BaseModel):
    """A scheduled class session"""
    id: Optional[int] = None
    section_id: int
    section_code: str
    subject_code: str
    subject_name: str
    room_id: int
    room_code: str
    building: str
    day_of_week: DayOfWeek
    start_slot_id: int  # First 30-min slot
    end_slot_id: int    # Last 30-min slot (exclusive)
    start_time: str
    end_time: str
    faculty_id: Optional[int] = None
    faculty_name: Optional[str] = None
    year_level: int = 1
    student_count: int = 30
    is_lab: bool = False
    status: ScheduleStatus = ScheduleStatus.SCHEDULED


class ScheduleConflict(BaseModel):
    """Detected scheduling conflict"""
    conflict_type: str  # "room", "teacher", "section"
    day: str
    time_slot: str
    entry_1: ScheduleEntry
    entry_2: ScheduleEntry
    description: str


# ==================== Request/Response Models ====================

class GenerateScheduleRequest(BaseModel):
    """Request model for schedule generation"""
    schedule_name: str
    semester: SemesterType
    academic_year: str
    
    # Data selection (upload group IDs)
    campus_group_id: Optional[int] = None
    class_group_id: Optional[int] = None
    teacher_group_id: Optional[int] = None
    
    # Direct data (alternative to group IDs)
    sections_data: Optional[List[Dict[str, Any]]] = None
    rooms_data: Optional[List[Dict[str, Any]]] = None
    faculty_data: Optional[List[Dict[str, Any]]] = None
    
    # Time configuration
    start_time: str = "07:00"
    end_time: str = "21:00"
    slot_duration: int = 30  # Now supports 30-minute slots
    active_days: List[str] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    
    # Optimization parameters
    max_iterations: int = 5000
    initial_temperature: float = 150.0
    cooling_rate: float = 0.997
    quantum_tunneling_prob: float = 0.12
    
    # Constraints
    max_teacher_hours_per_day: int = 8
    max_consecutive_hours: int = 4
    prioritize_accessibility: bool = True
    avoid_lunch_conflicts: bool = True
    lunch_start: str = "12:00"
    lunch_end: str = "13:00"


class ScheduleResult(BaseModel):
    """Result from schedule generation"""
    success: bool
    schedule_id: int
    message: str
    
    # Statistics
    total_sections: int
    scheduled_sections: int
    unscheduled_sections: int
    conflict_count: int
    
    # Details
    allocations: List[ScheduleEntry] = []
    unscheduled_list: List[Dict[str, Any]] = []
    conflicts: List[ScheduleConflict] = []
    
    # Optimization metrics
    optimization_stats: Dict[str, Any] = {}


class TimetableEntry(BaseModel):
    """Entry for timetable display (30-min aligned)"""
    section_code: str
    subject_code: str
    subject_name: str
    room: str
    building: str
    faculty_name: Optional[str] = None
    year_level: int
    student_count: int
    color: str = "#3B82F6"  # For UI display
    span: int = 1  # Number of 30-min slots this entry spans


# ==================== Utility Functions ====================

def parse_time_to_minutes(time_str: str) -> int:
    """Convert HH:MM to minutes since midnight"""
    parts = time_str.split(':')
    return int(parts[0]) * 60 + int(parts[1])


def minutes_to_time(minutes: int) -> str:
    """Convert minutes since midnight to HH:MM"""
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def calculate_slot_span(start_time: str, end_time: str, slot_duration: int = 30) -> int:
    """Calculate how many slots an entry spans"""
    start_mins = parse_time_to_minutes(start_time)
    end_mins = parse_time_to_minutes(end_time)
    return (end_mins - start_mins) // slot_duration


def time_slots_overlap(start1: str, end1: str, start2: str, end2: str) -> bool:
    """Check if two time ranges overlap"""
    s1, e1 = parse_time_to_minutes(start1), parse_time_to_minutes(end1)
    s2, e2 = parse_time_to_minutes(start2), parse_time_to_minutes(end2)
    return s1 < e2 and s2 < e1
