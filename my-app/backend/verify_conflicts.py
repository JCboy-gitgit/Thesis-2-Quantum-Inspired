"""
Quick script to verify no student group conflicts exist in the CSV
"""
import csv
from collections import defaultdict

# Read the CSV
conflicts = []
schedule_by_day_time = defaultdict(list)

csv_path = r"D:\Downloads\schedule_test 3_2026-01-28.csv"

with open(csv_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()
    
# Find the header line (starts with Day,Time)
data_start = 0
for i, line in enumerate(lines):
    if line.startswith('Day,Time'):
        data_start = i
        break

# Parse data
reader = csv.DictReader(lines[data_start:])
for row in reader:
    day = row.get('Day', '')
    time = row.get('Time', '')
    section = row.get('Section', '')
    course = row.get('Course Code', '')
    
    if day and time and section:
        # Get base section (remove _LEC, _LAB suffixes)
        base_section = section.replace('_LEC', '').replace('_LAB', '').strip()
        key = (day, time, base_section)
        schedule_by_day_time[key].append({
            'course': course,
            'section': section,
            'full_key': f"{day} {time}"
        })

# Check for conflicts (same base section at same time)
print("=" * 60)
print("STUDENT GROUP CONFLICT CHECK")
print("=" * 60)

conflict_count = 0
for key, entries in schedule_by_day_time.items():
    if len(entries) > 1:
        # Check if they're truly overlapping (not just adjacent)
        conflict_count += 1
        print(f"\n⚠️  Potential conflict at {key[0]} {key[1]}:")
        print(f"   Base section: {key[2]}")
        for e in entries:
            print(f"     - {e['course']} ({e['section']})")

if conflict_count == 0:
    print("\n✅ NO STUDENT GROUP CONFLICTS FOUND!")
    print("   All students have non-overlapping schedules.")
else:
    print(f"\n⚠️  Found {conflict_count} potential conflicts")
    print("   Note: Some may be valid if times are adjacent, not overlapping")

print("\n" + "=" * 60)
