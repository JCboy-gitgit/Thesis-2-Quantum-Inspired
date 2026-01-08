"""
================================================================================
Compare All Room Allocation Algorithms
================================================================================

This script runs all four algorithms on the same dataset and compares their
performance in terms of:
- Solution quality (fitness/energy)
- Computation time
- Schedule completeness (courses scheduled)

================================================================================
"""

import json
import time
import sys
from pathlib import Path

# Add algorithm folders to path
sys.path.insert(0, str(Path(__file__).parent / 'CP_SAT'))
sys.path.insert(0, str(Path(__file__).parent / 'QAOA'))
sys.path.insert(0, str(Path(__file__).parent / 'QIA'))
sys.path.insert(0, str(Path(__file__).parent / 'QUBO'))


def create_common_dataset():
    """Create a common dataset for all algorithms"""
    courses = [
        {'id': 'CS101', 'name': 'Intro to Programming', 'faculty_id': 'F001', 'duration': 1, 'students': 45},
        {'id': 'CS201', 'name': 'Data Structures', 'faculty_id': 'F001', 'duration': 1, 'students': 35},
        {'id': 'CS301', 'name': 'Algorithms', 'faculty_id': 'F004', 'duration': 1, 'students': 28},
        {'id': 'MATH101', 'name': 'Calculus I', 'faculty_id': 'F002', 'duration': 1, 'students': 50},
        {'id': 'MATH201', 'name': 'Linear Algebra', 'faculty_id': 'F002', 'duration': 1, 'students': 40},
        {'id': 'PHY101', 'name': 'Physics I', 'faculty_id': 'F003', 'duration': 1, 'students': 55},
        {'id': 'PHY102', 'name': 'Physics Lab', 'faculty_id': 'F003', 'duration': 1, 'students': 30},
        {'id': 'CS401', 'name': 'Machine Learning', 'faculty_id': 'F004', 'duration': 1, 'students': 25},
    ]
    
    rooms = [
        {'id': 'R101', 'name': 'Room 101', 'capacity': 30, 'building': 'Main Building'},
        {'id': 'R102', 'name': 'Room 102', 'capacity': 50, 'building': 'Main Building'},
        {'id': 'R103', 'name': 'Room 103', 'capacity': 25, 'building': 'Main Building'},
        {'id': 'LAB1', 'name': 'Computer Lab 1', 'capacity': 40, 'building': 'Science Building'},
        {'id': 'LAB2', 'name': 'Computer Lab 2', 'capacity': 35, 'building': 'Science Building'},
        {'id': 'AUD1', 'name': 'Auditorium', 'capacity': 200, 'building': 'Main Building'},
    ]
    
    time_slots = []
    slot_id = 0
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    times = [
        ('08:00', '09:00'), ('09:00', '10:00'), ('10:00', '11:00'),
        ('11:00', '12:00'), ('13:00', '14:00'), ('14:00', '15:00'),
        ('15:00', '16:00'), ('16:00', '17:00')
    ]
    
    for day in days:
        for start, end in times:
            time_slots.append({'id': slot_id, 'day': day, 'start': start, 'end': end})
            slot_id += 1
    
    return courses, rooms, time_slots


def run_cpsat(courses, rooms, time_slots):
    """Run CP-SAT algorithm"""
    print("\n" + "="*60)
    print("Running CP-SAT Algorithm")
    print("="*60)
    
    try:
        from room_allocation_cpsat import CPSATRoomAllocator, Course, Room, TimeSlot, Faculty
        
        allocator = CPSATRoomAllocator()
        
        # Add data
        for ts in time_slots:
            allocator.add_time_slot(TimeSlot(ts['id'], ts['day'], ts['start'], ts['end']))
        
        for r in rooms:
            allocator.add_room(Room(r['id'], r['name'], r['capacity'], r['building'], 'lecture'))
        
        faculty_ids = set(c['faculty_id'] for c in courses)
        for fid in faculty_ids:
            allocator.add_faculty(Faculty(fid, f'Faculty {fid}', 'Dept'))
        
        for c in courses:
            allocator.add_course(Course(c['id'], c['name'], c['faculty_id'], c['duration'], c['students']))
        
        result = allocator.solve(time_limit_seconds=30)
        return result
    except Exception as e:
        print(f"Error: {e}")
        return {'status': 'ERROR', 'error': str(e), 'schedule': [], 'solve_time_seconds': 0}


def run_qia(courses, rooms, time_slots):
    """Run QIA algorithm"""
    print("\n" + "="*60)
    print("Running QIA (Quantum-Inspired) Algorithm")
    print("="*60)
    
    try:
        from room_allocation_qia import QIARoomAllocator, Course, Room, TimeSlot
        
        allocator = QIARoomAllocator(population_size=30, max_generations=100)
        
        # Add data
        for ts in time_slots:
            allocator.add_time_slot(TimeSlot(ts['id'], ts['day'], ts['start'], ts['end']))
        
        for r in rooms:
            allocator.add_room(Room(r['id'], r['name'], r['capacity'], r['building']))
        
        for c in courses:
            allocator.add_course(Course(c['id'], c['name'], c['faculty_id'], c['duration'], c['students']))
        
        result = allocator.solve(use_repair=True)
        return result
    except Exception as e:
        print(f"Error: {e}")
        return {'status': 'ERROR', 'error': str(e), 'schedule': [], 'solve_time_seconds': 0}


def run_qubo(courses, rooms, time_slots):
    """Run QUBO algorithm"""
    print("\n" + "="*60)
    print("Running QUBO Algorithm")
    print("="*60)
    
    try:
        from room_allocation_qubo import QUBORoomAllocator, Course, Room, TimeSlot
        
        allocator = QUBORoomAllocator()
        
        # Add data
        for ts in time_slots:
            allocator.add_time_slot(TimeSlot(ts['id'], ts['day'], ts['start'], ts['end']))
        
        for r in rooms:
            allocator.add_room(Room(r['id'], r['name'], r['capacity'], r['building']))
        
        for c in courses:
            allocator.add_course(Course(c['id'], c['name'], c['faculty_id'], c['duration'], c['students']))
        
        result = allocator.solve_simulated_annealing(
            initial_temp=100.0,
            final_temp=0.01,
            cooling_rate=0.995,
            max_iterations=10000
        )
        return result
    except Exception as e:
        print(f"Error: {e}")
        return {'status': 'ERROR', 'error': str(e), 'schedule': [], 'solve_time_seconds': 0}


def run_qaoa(courses, rooms, time_slots):
    """Run QAOA algorithm (smaller dataset due to qubit limitations)"""
    print("\n" + "="*60)
    print("Running QAOA Algorithm")
    print("="*60)
    print("Note: Using smaller dataset due to qubit limitations in simulation")
    
    try:
        from room_allocation_qaoa import QAOARoomAllocator, Course, Room, TimeSlot
        
        allocator = QAOARoomAllocator(p=2)
        
        # Use smaller subset for QAOA (simulation is slow with many qubits)
        small_time_slots = time_slots[:8]  # Just Monday
        small_rooms = rooms[:3]
        small_courses = courses[:4]
        
        for ts in small_time_slots:
            allocator.add_time_slot(TimeSlot(ts['id'], ts['day'], ts['start'], ts['end']))
        
        for r in small_rooms:
            allocator.add_room(Room(r['id'], r['name'], r['capacity'], r['building']))
        
        for c in small_courses:
            allocator.add_course(Course(c['id'], c['name'], c['faculty_id'], c['duration'], c['students']))
        
        result = allocator.solve(shots=1024, optimizer_maxiter=30)
        result['note'] = 'Used reduced dataset for simulation'
        return result
    except Exception as e:
        print(f"Error: {e}")
        return {'status': 'ERROR', 'error': str(e), 'schedule': [], 'solve_time_seconds': 0}


def print_comparison(results):
    """Print comparison table"""
    print("\n" + "="*80)
    print("ALGORITHM COMPARISON RESULTS")
    print("="*80)
    
    headers = ['Algorithm', 'Status', 'Time (s)', 'Scheduled', 'Notes']
    row_format = "{:<15} {:<12} {:<12} {:<12} {:<30}"
    
    print(row_format.format(*headers))
    print("-" * 80)
    
    for name, result in results.items():
        status = result.get('status', 'N/A')
        time_taken = f"{result.get('solve_time_seconds', 0):.3f}"
        scheduled = f"{len(result.get('schedule', []))}/{result.get('statistics', {}).get('courses', '?')}"
        notes = result.get('note', '')[:28] if 'note' in result else ''
        
        print(row_format.format(name, status, time_taken, scheduled, notes))
    
    print("="*80)


def main():
    print("""
    ╔══════════════════════════════════════════════════════════════╗
    ║       QUANTUM-INSPIRED ROOM ALLOCATION COMPARISON            ║
    ╚══════════════════════════════════════════════════════════════╝
    
    This script compares all four algorithms:
    1. CP-SAT - Classical Constraint Programming
    2. QAOA   - Quantum Approximate Optimization
    3. QIA    - Quantum-Inspired Algorithm
    4. QUBO   - Quadratic Unconstrained Binary Optimization
    """)
    
    # Create common dataset
    courses, rooms, time_slots = create_common_dataset()
    
    print(f"\nDataset Summary:")
    print(f"  Courses: {len(courses)}")
    print(f"  Rooms: {len(rooms)}")
    print(f"  Time slots: {len(time_slots)}")
    
    results = {}
    
    # Run each algorithm
    results['CP-SAT'] = run_cpsat(courses, rooms, time_slots)
    results['QIA'] = run_qia(courses, rooms, time_slots)
    results['QUBO'] = run_qubo(courses, rooms, time_slots)
    
    # QAOA is optional (requires qiskit and may be slow)
    try:
        results['QAOA'] = run_qaoa(courses, rooms, time_slots)
    except ImportError:
        print("\nQAOA skipped (qiskit not installed)")
        results['QAOA'] = {'status': 'SKIPPED', 'schedule': [], 'solve_time_seconds': 0,
                          'statistics': {'courses': 4}, 'note': 'qiskit not installed'}
    
    # Print comparison
    print_comparison(results)
    
    # Save all results
    output_file = 'comparison_results.json'
    
    # Clean up results for JSON serialization
    for name, result in results.items():
        if 'statistics' in result and 'energy_history' in result['statistics']:
            result['statistics']['energy_history'] = [
                float(e) for e in result['statistics']['energy_history']
            ]
    
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\nResults saved to: {output_file}")


if __name__ == "__main__":
    main()
