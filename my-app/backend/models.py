"""
Pydantic Models for College Room Allocation System
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, time
from enum import Enum


class RoomType(str, Enum):
    LECTURE_HALL = "lecture_hall"
    LABORATORY = "laboratory"
    COMPUTER_LAB = "computer_lab"
    SEMINAR_ROOM = "seminar_room"
    AUDITORIUM = "auditorium"
    CLASSROOM = "classroom"


class DayOfWeek(str, Enum):
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


# ==================== Room Models ====================
class Room(BaseModel):
    id: int
    room_code: str
    room_name: str
    building: str
    campus: str
    capacity: int
    room_type: RoomType = RoomType.CLASSROOM
    floor: int = 1
    is_accessible: bool = False  # PWD accessible
    has_projector: bool = True
    has_ac: bool = False
    is_available: bool = True


class RoomCreate(BaseModel):
    room_code: str
    room_name: str
    building: str
    campus: str
    capacity: int
    room_type: RoomType = RoomType.CLASSROOM
    floor: int = 1
    is_accessible: bool = False
    has_projector: bool = True
    has_ac: bool = False


# ==================== Course/Class Models ====================
class Course(BaseModel):
    id: int
    course_code: str
    course_name: str
    department: str
    credits: int = 3
    required_room_type: RoomType = RoomType.CLASSROOM
    weekly_hours: int = 3
    requires_lab: bool = False
    lab_hours: int = 0


class CourseCreate(BaseModel):
    course_code: str
    course_name: str
    department: str
    credits: int = 3
    required_room_type: RoomType = RoomType.CLASSROOM
    weekly_hours: int = 3
    requires_lab: bool = False
    lab_hours: int = 0


# ==================== Section/Class Models ====================
class Section(BaseModel):
    id: int
    section_code: str
    course_id: int
    course_code: str
    course_name: str
    teacher_id: int
    teacher_name: str
    student_count: int
    semester: str
    academic_year: str
    required_room_type: RoomType = RoomType.CLASSROOM


class SectionCreate(BaseModel):
    section_code: str
    course_id: int
    teacher_id: int
    student_count: int
    semester: str
    academic_year: str


# ==================== Teacher Models ====================
class Teacher(BaseModel):
    id: int
    employee_id: str
    name: str
    email: str
    department: str
    specialization: Optional[str] = None
    max_hours_per_day: int = 6
    preferred_days: List[DayOfWeek] = []
    is_available: bool = True


class TeacherCreate(BaseModel):
    employee_id: str
    name: str
    email: str
    department: str
    specialization: Optional[str] = None
    max_hours_per_day: int = 6
    preferred_days: List[DayOfWeek] = []


# ==================== Time Slot Models ====================
class TimeSlot(BaseModel):
    id: int
    slot_name: str
    start_time: str  # "08:00"
    end_time: str    # "09:30"
    duration_minutes: int = 90


class TimeSlotCreate(BaseModel):
    slot_name: str
    start_time: str
    end_time: str
    duration_minutes: int = 90


# ==================== Schedule Models ====================
class ScheduleEntry(BaseModel):
    id: Optional[int] = None
    section_id: int
    section_code: str
    course_code: str
    course_name: str
    teacher_id: int
    teacher_name: str
    room_id: int
    room_code: str
    room_name: str
    building: str
    day_of_week: DayOfWeek
    time_slot_id: int
    start_time: str
    end_time: str
    student_count: int
    room_capacity: int
    is_lab_session: bool = False


class ScheduleConflict(BaseModel):
    conflict_type: str  # "room", "teacher", "section"
    description: str
    involved_entries: List[int]


class GenerateScheduleRequest(BaseModel):
    semester: str
    academic_year: str
    campus: Optional[str] = None
    department: Optional[str] = None
    prioritize_accessibility: bool = False
    max_iterations: int = 1000
    initial_temperature: float = 100.0
    cooling_rate: float = 0.995
    use_quantum_inspired: bool = True


class ScheduleResult(BaseModel):
    success: bool
    message: str
    schedule_id: Optional[int] = None
    total_sections: int = 0
    scheduled_sections: int = 0
    unscheduled_sections: int = 0
    conflicts: List[ScheduleConflict] = []
    execution_time_ms: int = 0
    schedule_entries: List[ScheduleEntry] = []
    optimization_stats: Optional[dict] = None


# ==================== Analytics Models ====================
class RoomUtilization(BaseModel):
    room_id: int
    room_code: str
    room_name: str
    total_slots: int
    used_slots: int
    utilization_percentage: float


class TeacherWorkload(BaseModel):
    teacher_id: int
    teacher_name: str
    total_hours: int
    sections_count: int
    days_working: List[DayOfWeek]


class ScheduleSummary(BaseModel):
    id: int
    semester: str
    academic_year: str
    created_at: str
    total_sections: int
    scheduled_sections: int
    total_rooms_used: int
    avg_room_utilization: float
    conflicts_count: int


# ==================== Import/Export Models ====================
class BulkSectionImport(BaseModel):
    sections: List[SectionCreate]


class BulkRoomImport(BaseModel):
    rooms: List[RoomCreate]


class BulkTeacherImport(BaseModel):
    teachers: List[TeacherCreate]
