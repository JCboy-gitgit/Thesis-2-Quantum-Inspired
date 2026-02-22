
import requests
import json

url = "http://127.0.0.1:8000/api/schedules/generate"

# Mock section
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

# Mock room
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

payload = {
    "schedule_name": "Test Schedule",
    "semester": "1st Semester",
    "academic_year": "2024-2025",
    "sections_data": [section],
    "rooms_data": [room],
    "time_slots": [
        {"id": 1, "start_time": "07:00", "end_time": "08:30", "duration_minutes": 90},
        {"id": 2, "start_time": "08:30", "end_time": "10:00", "duration_minutes": 90},
    ],
    "active_days": ["Monday", "Tuesday"],
    "fixed_allocations": [
        {
            "class_id": 1,
            "room_id": 101,
            "schedule_day": "Monday",
            "schedule_time": "08:30 - 10:00",
            "section": "BSCS-3A",
            "slot_count": 2
        }
    ],
    "max_iterations": 10
}

try:
    response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
    print(f"Status Code: {response.status_code}")
    print(response.text[:200])  # print start of response
except Exception as e:
    print(f"Error: {e}")
