"""Test student group conflict detection"""
from scheduler_v2 import run_enhanced_scheduler
from collections import defaultdict

# Test: Two courses for the SAME student group should NOT be at the same time
sections = [
    {
        'id': 1,
        'section_code': 'BSM CS 2B - G2',
        'course_code': 'MAT206',
        'course_name': 'Number Theory',
        'lec_hours': 3,
        'lab_hours': 0,
        'student_count': 30,
        'year_level': 2
    },
    {
        'id': 2,
        'section_code': 'BSM CS 2B - G2',
        'course_code': 'RPH101',
        'course_name': 'Readings in Philippine History',
        'lec_hours': 3,
        'lab_hours': 0,
        'student_count': 30,
        'year_level': 2
    },
    {
        'id': 3,
        'section_code': 'BSM CS 2B - G2',
        'course_code': 'ETH101',
        'course_name': 'Ethics',
        'lec_hours': 3,
        'lab_hours': 0,
        'student_count': 30,
        'year_level': 2
    }
]

rooms = [
    {'id': 1, 'room_code': 'FH-301', 'building': 'Federizo Hall', 'capacity': 40, 'room_type': 'Lecture Room'},
    {'id': 2, 'room_code': 'FH-302', 'building': 'Federizo Hall', 'capacity': 40, 'room_type': 'Lecture Room'},
    {'id': 3, 'room_code': 'FH-303', 'building': 'Federizo Hall', 'capacity': 40, 'room_type': 'Lecture Room'}
]

config = {'max_iterations': 500}

result = run_enhanced_scheduler(sections, rooms, config=config)

print('\n=== SCHEDULE RESULTS ===')
print(f'Scheduled: {result.get("scheduled_classes", 0)} / {result.get("total_classes", 0)}')
print()

# Check for conflicts
time_slots_by_section = defaultdict(list)

for entry in result.get('allocations', []):
    sec = entry.get('section_code', 'N/A')
    day = entry.get('day_of_week', 'N/A')
    start = entry.get('start_time', 'N/A')
    end = entry.get('end_time', 'N/A')
    course = entry.get('course_code', 'N/A')
    
    print(f'{course} ({sec}): {day} {start} - {end}')
    
    # Track for conflict detection
    base_section = sec.replace('_LEC','').replace('_LAB','').strip()
    time_slots_by_section[(base_section, day)].append({
        'course': course,
        'start': start,
        'end': end
    })

print()
print('=== CONFLICT CHECK ===')

def time_to_minutes(t):
    """Convert time like '07:00' or '7:00 AM' to minutes"""
    t = t.strip()
    if 'AM' in t or 'PM' in t:
        parts = t.replace('AM','').replace('PM','').strip().split(':')
        h, m = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
        if 'PM' in t and h != 12:
            h += 12
        if 'AM' in t and h == 12:
            h = 0
        return h * 60 + m
    parts = t.split(':')
    return int(parts[0]) * 60 + int(parts[1])

def check_overlap(slot1, slot2):
    """Check if two time slots overlap"""
    s1_start = time_to_minutes(slot1['start'])
    s1_end = time_to_minutes(slot1['end'])
    s2_start = time_to_minutes(slot2['start'])
    s2_end = time_to_minutes(slot2['end'])
    return s1_start < s2_end and s2_start < s1_end

conflicts_found = False
for (section, day), slots in time_slots_by_section.items():
    for i in range(len(slots)):
        for j in range(i + 1, len(slots)):
            if check_overlap(slots[i], slots[j]):
                print(f'CONFLICT: {section} on {day}')
                print(f'  - {slots[i]["course"]}: {slots[i]["start"]} - {slots[i]["end"]}')
                print(f'  - {slots[j]["course"]}: {slots[j]["start"]} - {slots[j]["end"]}')
                conflicts_found = True

if not conflicts_found:
    print('✅ No student group conflicts detected!')
