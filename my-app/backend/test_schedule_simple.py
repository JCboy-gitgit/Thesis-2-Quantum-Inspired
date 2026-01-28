"""Simple test to debug scheduler error"""
from scheduler_v2 import run_enhanced_scheduler, generate_time_slots

# Minimal test case
sections = [
    {
        'id': 1,
        'section_code': 'TEST-1A',
        'course_code': 'CS101',
        'course_name': 'Intro to CS',
        'teacher_id': 1,
        'teacher_name': 'Dr. Test',
        'year_level': 1,
        'student_count': 30,
        'required_room_type': 'Lecture Room',
        'weekly_hours': 3,
        'lec_hours': 3,
        'lab_hours': 0,
        'department': 'CS'
    }
]

rooms = [
    {
        'id': 1,
        'room_code': 'LR-101',
        'room_name': 'Lecture Room 101',
        'building': 'Main',
        'campus': 'Campus',
        'capacity': 40,
        'room_type': 'Lecture Room',
        'floor': 1,
        'is_accessible': True
    }
]

config = {
    'slot_duration': 90,
    'start_time': '07:00',
    'end_time': '20:00',
    'max_iterations': 100
}

if __name__ == "__main__":
    try:
        result = run_enhanced_scheduler(sections, rooms, None, config)
        print(f"Success: {result['success']}")
        print(f"Scheduled: {result['scheduled_sections']}/{result['total_sections']}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
