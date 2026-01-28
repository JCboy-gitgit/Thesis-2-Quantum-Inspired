"""Test to find the error source"""
import traceback
from scheduler_v2 import run_enhanced_scheduler

# Larger test case to trigger the error
sections = []
for i in range(1, 100):
    sections.append({
        'id': i, 
        'section_code': f'BSM CS 2A - G{i % 5}', 
        'course_code': f'MAT{100+i}', 
        'course_name': f'Math Course {i}', 
        'lec_hours': 2, 
        'lab_hours': 1 if i % 3 == 0 else 0,  # Some hybrid courses
        'student_count': 30, 
        'year_level': (i % 4) + 1
    })

rooms = []
for i in range(1, 30):
    room_type = 'Science Lab' if i <= 5 else 'Lecture Room'
    rooms.append({
        'id': i, 
        'room_code': f'FH-{300+i}', 
        'building': 'Federizo Hall', 
        'capacity': 40, 
        'room_type': room_type
    })

try:
    result = run_enhanced_scheduler(sections, rooms, config={'max_iterations': 500})
    print('Success!')
    print(f'Scheduled: {result.get("scheduled_sections", 0)}')
except Exception as e:
    print(f'Error type: {type(e).__name__}')
    print(f'Error message: {e}')
    print()
    traceback.print_exc()
