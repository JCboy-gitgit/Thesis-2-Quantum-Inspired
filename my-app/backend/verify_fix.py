
import sys
import os
from pprint import pprint

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'my-app', 'backend'))

from scheduler_v2 import run_enhanced_scheduler

def test_college_constraint_integrated():
    print("--- Testing College Constraint (Integrated) ---")
    
    # Define Room in "COEd"
    room_coed = {
        'id': 101,
        'room_code': 'COEd-101',
        'room_name': 'Education Room',
        'building': 'Educ Bldg',
        'capacity': 50,
        'room_type': 'Lecture Room',
        'college': 'COEd'
    }
    
    # Define Section for "CICT" - Nested in courses (The case we fixed)
    section_cict_nested = {
        'id': 2,
        'section_code': 'BSIT-1B',
        'student_count': 40,
        'courses': {
            'college': 'CICT',
            'department': 'IT'
        },
        'lec_hours': 3,
        'lab_hours': 0,
        'semester': '1st Semester',
        'course_code': 'BSIT',
        'subject_code': 'IT101'
    }
    
    # Define Time Slots (Input format for run_enhanced_scheduler)
    time_slots = [
        {'id': 1, 'start_time': '07:00', 'end_time': '08:30', 'duration_minutes': 90},
        {'id': 2, 'start_time': '08:30', 'end_time': '10:00', 'duration_minutes': 90}
    ]

    # Run Scheduler
    print("\nRunning Scheduler with Nested College Data...")
    result = run_enhanced_scheduler(
        sections_data=[section_cict_nested],
        rooms_data=[room_coed],
        time_slots_data=time_slots,
        config={
            'max_iterations': 100, # Fast run
            'strict_lecture_room_matching': True,
            'lunch_mode': 'none'
        }
    )
    
    # Check results
    print(f"\nScheduling Success: {result['success']}")
    print(f"Scheduled Sections: {result['scheduled_sections']}")
    print(f"Unscheduled Sections: {result['unscheduled_sections']}")
    
    allocations = result.get('allocations', [])
    if allocations:
        print("❌ FAIL: Section was scheduled! (Should have been blocked due to college mismatch)")
        pprint(allocations)
    else:
        print("✅ PASS: Section was NOT scheduled. (Correctly blocked due to college mismatch)")
        # Verify reason if possible (would need to check unscheduled list if it was returned in detail)
        # But absence of schedule is what we expect here since there are no valid rooms.

if __name__ == "__main__":
    test_college_constraint_integrated()
