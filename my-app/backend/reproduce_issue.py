
import sys
import os
from pprint import pprint

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'my-app', 'backend'))

from scheduler_v2 import EnhancedQuantumScheduler, Section, Room, TimeSlot

def test_college_constraint():
    print("--- Testing College Constraint ---")
    
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
    
    # Define Section for "CICT" - Top Level
    section_cict_top_level = {
        'id': 1,
        'section_code': 'BSIT-1A',
        'student_count': 40,
        'college': 'CICT',
        'department': 'IT',
        'std_course': 'BSIT', # dummy
        'lec_hours': 3,
        'lab_hours': 0
    }

    # Define Section for "CICT" - Nested in courses (Simulating DB return if joined)
    section_cict_nested = {
        'id': 2,
        'section_code': 'BSIT-1B',
        'student_count': 40,
        'courses': {
            'college': 'CICT',
            'department': 'IT'
        },
        'lec_hours': 3,
        'lab_hours': 0
    }
    
    # Define Time Slots
    time_slots = [
        {'id': 1, 'start_time': '07:00', 'end_time': '08:30', 'duration_minutes': 90},
        {'id': 2, 'start_time': '08:30', 'end_time': '10:00', 'duration_minutes': 90}
    ]

    # Initialize Scheduler with Top Level Section
    print("\n1. Testing Top-Level College Definition (Should Block):")
    scheduler_1 = EnhancedQuantumScheduler(
        sections=[create_section_obj(section_cict_top_level)],
        rooms=[create_room_obj(room_coed)],
        time_slots=[create_timeslot_obj(t) for t in time_slots]
    )
    compatible_1 = scheduler_1.compatible_rooms.get(1, [])
    print(f"   Section College: {scheduler_1.sections[1].college}")
    print(f"   Room College: {scheduler_1.rooms[101].college}")
    print(f"   Compatible Rooms: {compatible_1}")
    if not compatible_1:
        print("   ✅ PASS: Room successfully blocked.")
    else:
        print("   ❌ FAIL: Room was NOT blocked.")

    # Initialize Scheduler with Nested Section
    # Note: We need to manually simulate how run_enhanced_scheduler creates the object
    # because passing the dict to the constructor expects 'Section' objects.
    # So we will emulate the logic inside run_enhanced_scheduler where it does s.get('college')
    
    print("\n2. Testing Nested College Definition (Simulating Bug):")
    
    # Simulate extraction (Current buggy logic)
    college_extracted = section_cict_nested.get('college', '') 
    
    section_obj_nested = create_section_obj(section_cict_nested, college_override=college_extracted)
    
    scheduler_2 = EnhancedQuantumScheduler(
        sections=[section_obj_nested],
        rooms=[create_room_obj(room_coed)],
        time_slots=[create_timeslot_obj(t) for t in time_slots]
    )
    
    compatible_2 = scheduler_2.compatible_rooms.get(2, [])
    print(f"   Section College: '{scheduler_2.sections[2].college}'")
    print(f"   Room College: {scheduler_2.rooms[101].college}")
    print(f"   Compatible Rooms: {compatible_2}")
    
    if compatible_2:
        print("   ❌ FAIL: Room was allowed (Bug Reproduced) because college was empty.")
    else:
        print("   ✅ PASS: Room was blocked.")


def create_section_obj(data, college_override=None):
    from scheduler_v2 import Section
    college = college_override if college_override is not None else data.get('college', '')
    return Section(
        id=data['id'],
        section_code=data['section_code'],
        course_code='TEST',
        course_name='Test Course',
        subject_code='TEST-101',
        subject_name='Test Subject',
        teacher_id=1,
        teacher_name='Test Teacher',
        year_level=1,
        student_count=data['student_count'],
        required_room_type='Lecture Room',
        weekly_hours=3,
        lec_hours=3,
        lab_hours=0,
        department=data.get('department', ''),
        college=college
    )

def create_room_obj(data):
    from scheduler_v2 import Room
    return Room(
        id=data['id'],
        room_code=data['room_code'],
        room_name=data['room_name'],
        building=data['building'],
        campus='Main',
        capacity=data['capacity'],
        room_type=data['room_type'],
        college=data.get('college')
    )

def create_timeslot_obj(data):
    from scheduler_v2 import TimeSlot
    return TimeSlot(
        id=data['id'],
        slot_name=f"Slot {data['id']}",
        start_time=data['start_time'],
        end_time=data['end_time'],
        start_minutes=0, # dummy
        duration_minutes=data['duration_minutes']
    )

if __name__ == "__main__":
    test_college_constraint()
