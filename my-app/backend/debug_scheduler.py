
from scheduler_v2 import run_enhanced_scheduler
from pprint import pprint

section = {
    "id": 1,
    "section_code": "BSCS-3A",
    "course_code": "BSCS",
    "course_name": "CompSci",
    "teacher_id": 1,
    "teacher_name": "Dr. Smith",
    "student_count": 30,
    "required_room_type": "Lecture Room",
    "weekly_hours": 3,
    "lec_hours": 3,
    "lab_hours": 0,
    "requires_lab": False,
    "department": "IT",
    "college": "CICT"
}

room = {
    "id": 101,
    "room_code": "R101",
    "room_name": "Room 101",
    "building": "Main",
    "campus": "Main",
    "capacity": 50,
    "room_type": "Lecture Room",
    "college": "CICT"
}

try:
    result = run_enhanced_scheduler(
        sections_data=[section],
        rooms_data=[room],
        config={"max_iterations": 10},
        fixed_allocations=[
            {
                "class_id": 1,
                "room_id": 101,
                "schedule_day": "Monday",
                "schedule_time": "08:30 - 10:00",
                "section": "BSCS-3A"
            }
        ]
    )
    print("Success!")
except Exception as e:
    import traceback
    traceback.print_exc()
