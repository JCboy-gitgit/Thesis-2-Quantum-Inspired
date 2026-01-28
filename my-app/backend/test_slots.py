"""Test slot generation with 90-minute slots"""
from scheduler_v2 import generate_time_slots, Section

# Test 1: Generate 90-minute slots
print("=" * 50)
print("TEST 1: Generate 90-minute slots (7AM - 8PM)")
print("=" * 50)
slots = generate_time_slots('07:00', '20:00', 90)
print(f"Generated {len(slots)} slots of 90 min each:")
for s in slots:
    print(f"  Slot {s.id}: {s.slot_name} ({s.duration_minutes} min)")

# Test 2: Section required slots calculation
print()
print("=" * 50)
print("TEST 2: Section slot requirements")
print("=" * 50)

# 3 Lec + 3 Lab = 6 hours = 4 slots (as frontend says)
s1 = Section(
    id=1, section_code='TEST-1', course_code='TEST', course_name='Test',
    subject_code='T101', subject_name='Test', teacher_id=1, teacher_name='Teacher',
    year_level=1, student_count=30, required_room_type='lecture', weekly_hours=6,
    lec_hours=3, lab_hours=3
)
print(f"3 Lec + 3 Lab hours = 6 hours => {s1.required_slots} slots (expected: 4)")

# 2 Lec + 0 Lab = 2 hours = 2 slots (rounded up from 1.33)
s2 = Section(
    id=2, section_code='TEST-2', course_code='TEST', course_name='Test',
    subject_code='T102', subject_name='Test', teacher_id=1, teacher_name='Teacher',
    year_level=1, student_count=30, required_room_type='lecture', weekly_hours=2,
    lec_hours=2, lab_hours=0
)
print(f"2 Lec + 0 Lab hours = 2 hours => {s2.required_slots} slots (expected: 2)")

# 3 Lec + 0 Lab = 3 hours = 2 slots
s3 = Section(
    id=3, section_code='TEST-3', course_code='TEST', course_name='Test',
    subject_code='T103', subject_name='Test', teacher_id=1, teacher_name='Teacher',
    year_level=1, student_count=30, required_room_type='lecture', weekly_hours=3,
    lec_hours=3, lab_hours=0
)
print(f"3 Lec + 0 Lab hours = 3 hours => {s3.required_slots} slots (expected: 2)")

# 0 Lec + 3 Lab = 3 hours = 2 slots
s4 = Section(
    id=4, section_code='TEST-4', course_code='TEST', course_name='Test',
    subject_code='T104', subject_name='Test', teacher_id=1, teacher_name='Teacher',
    year_level=1, student_count=30, required_room_type='lab', weekly_hours=3,
    lec_hours=0, lab_hours=3, requires_lab=True
)
print(f"0 Lec + 3 Lab hours = 3 hours => {s4.required_slots} slots (expected: 2)")

print()
print("✅ Tests completed!")
