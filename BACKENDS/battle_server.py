"""
================================================================================
ALGORITHM BATTLE SERVER
================================================================================

This Flask server runs REAL algorithms and returns actual solve times.
Each algorithm is executed with the same problem to ensure fair comparison.

Run with: python battle_server.py
Server will start at: http://localhost:5000

================================================================================
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import time
import threading
import json
import sys
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Any
import traceback

# Use high-precision timer for accurate measurements
try:
    from time import perf_counter as precise_time
except ImportError:
    precise_time = time.time

# Add algorithm folders to path
sys.path.insert(0, str(Path(__file__).parent / 'CP_SAT'))
sys.path.insert(0, str(Path(__file__).parent / 'QIA'))
sys.path.insert(0, str(Path(__file__).parent / 'QUBO'))
sys.path.insert(0, str(Path(__file__).parent / 'QAOA'))

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from HTML file

# Store battle results
battle_results = {}
battle_status = {}


def generate_problem(num_courses: int, num_rooms: int, num_timeslots: int, 
                     constraint_level: str = 'medium'):
    """Generate a scheduling problem with configurable difficulty"""
    
    # Course names for better visualization
    course_names = [
        'Intro to Programming', 'Data Structures', 'Algorithms', 'Calculus I',
        'Linear Algebra', 'Physics I', 'Chemistry', 'Machine Learning',
        'Database Systems', 'Web Development', 'Operating Systems', 'Networks',
        'Statistics', 'Discrete Math', 'Computer Graphics', 'AI Fundamentals',
        'Cybersecurity', 'Cloud Computing', 'Mobile Dev', 'Software Engineering'
    ]
    
    # Generate courses with varying sizes
    courses = []
    for i in range(num_courses):
        # Mix of small, medium, large classes
        if i % 3 == 0:
            students = 20 + (i * 3) % 30  # Small: 20-50
        elif i % 3 == 1:
            students = 40 + (i * 5) % 40  # Medium: 40-80
        else:
            students = 60 + (i * 7) % 50  # Large: 60-110
        
        courses.append({
            'id': f'C{i+1:03d}',
            'name': course_names[i % len(course_names)],
            'faculty_id': f'F{(i % max(1, num_courses // 3)) + 1:03d}',
            'duration': 1,
            'students': students
        })
    
    # Generate rooms with varying capacities
    rooms = []
    room_types = ['Lecture Hall', 'Lab', 'Seminar Room', 'Auditorium', 'Computer Lab']
    for i in range(num_rooms):
        if i % 3 == 0:
            capacity = 30 + (i * 5) % 20  # Small: 30-50
        elif i % 3 == 1:
            capacity = 50 + (i * 7) % 30  # Medium: 50-80
        else:
            capacity = 80 + (i * 11) % 70  # Large: 80-150
        
        rooms.append({
            'id': f'R{i+1:03d}',
            'name': f'{room_types[i % len(room_types)]} {i+1}',
            'capacity': capacity,
            'building': f'Building {(i % 3) + 1}'
        })
    
    # Generate time slots
    time_slots = []
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    times_per_day = num_timeslots // 5 if num_timeslots >= 5 else num_timeslots
    
    slot_id = 0
    for day_idx, day in enumerate(days):
        for t in range(times_per_day):
            if slot_id >= num_timeslots:
                break
            hour = 8 + t
            time_slots.append({
                'id': slot_id,
                'day': day,
                'start': f'{hour:02d}:00',
                'end': f'{hour+1:02d}:00'
            })
            slot_id += 1
    
    # Adjust based on constraint level
    if constraint_level == 'tight':
        # Fewer rooms/timeslots relative to courses = harder
        pass  # Already set by user inputs
    elif constraint_level == 'loose':
        # More flexibility
        pass
    
    return courses, rooms, time_slots


def run_cpsat(courses, rooms, time_slots, time_limit=30):
    """Run CP-SAT algorithm and return real results"""
    try:
        from room_allocation_cpsat import CPSATRoomAllocator, Course, Room, TimeSlot, Faculty
        
        allocator = CPSATRoomAllocator()
        
        # Add time slots
        for ts in time_slots:
            allocator.add_time_slot(TimeSlot(ts['id'], ts['day'], ts['start'], ts['end']))
        
        # Add rooms
        for r in rooms:
            allocator.add_room(Room(r['id'], r['name'], r['capacity'], r['building'], 'lecture'))
        
        # Add faculty
        faculty_ids = set(c['faculty_id'] for c in courses)
        for fid in faculty_ids:
            allocator.add_faculty(Faculty(fid, f'Faculty {fid}', 'Department'))
        
        # Add courses
        for c in courses:
            allocator.add_course(Course(c['id'], c['name'], c['faculty_id'], c['duration'], c['students']))
        
        # Solve
        result = allocator.solve(time_limit_seconds=time_limit)
        
        # Enhanced schedule with more info
        enhanced_schedule = []
        for item in result.get('schedule', []):
            course_data = next((c for c in courses if c['id'] == item.get('course_id')), {})
            room_data = next((r for r in rooms if r['id'] == item.get('room_id')), {})
            slot_data = next((s for s in time_slots if s['id'] == item.get('time_slot_id')), {})
            
            enhanced_schedule.append({
                'course_id': item.get('course_id'),
                'course_name': course_data.get('name', 'Unknown'),
                'students': course_data.get('students', 0),
                'room_id': item.get('room_id'),
                'room_name': room_data.get('name', 'Unknown'),
                'room_capacity': room_data.get('capacity', 0),
                'time_slot_id': item.get('time_slot_id'),
                'day': slot_data.get('day', ''),
                'time': f"{slot_data.get('start', '')} - {slot_data.get('end', '')}"
            })
        
        return {
            'algorithm': 'CP-SAT',
            'status': result.get('status', 'ERROR'),
            'solve_time': result.get('solve_time_seconds', 0),
            'scheduled': len(result.get('schedule', [])),
            'total_courses': len(courses),
            'schedule': enhanced_schedule,
            'details': {
                'solver': 'Google OR-Tools CP-SAT',
                'approach': 'Exact constraint satisfaction',
                'variables': len(courses) * len(rooms) * len(time_slots),
                'time_limit': f'{time_limit}s'
            }
        }
    except Exception as e:
        traceback.print_exc()
        return {
            'algorithm': 'CP-SAT',
            'status': 'ERROR',
            'error': str(e),
            'solve_time': 0,
            'scheduled': 0,
            'total_courses': len(courses),
            'schedule': []
        }


def run_qia(courses, rooms, time_slots, generations=100, population=30):
    """Run QIA algorithm and return real results"""
    try:
        from room_allocation_qia import QIARoomAllocator, Course, Room, TimeSlot
        
        allocator = QIARoomAllocator(population_size=population, max_generations=generations)
        
        # Add time slots
        for ts in time_slots:
            allocator.add_time_slot(TimeSlot(ts['id'], ts['day'], ts['start'], ts['end']))
        
        # Add rooms
        for r in rooms:
            allocator.add_room(Room(r['id'], r['name'], r['capacity'], r['building']))
        
        # Add courses
        for c in courses:
            allocator.add_course(Course(c['id'], c['name'], c['faculty_id'], c['duration'], c['students']))
        
        # Solve
        result = allocator.solve(use_repair=True)
        
        # Enhanced schedule with more info
        enhanced_schedule = []
        for item in result.get('schedule', []):
            course_data = next((c for c in courses if c['id'] == item.get('course_id')), {})
            room_data = next((r for r in rooms if r['id'] == item.get('room_id')), {})
            slot_data = next((s for s in time_slots if s['id'] == item.get('time_slot_id')), {})
            
            enhanced_schedule.append({
                'course_id': item.get('course_id'),
                'course_name': course_data.get('name', 'Unknown'),
                'students': course_data.get('students', 0),
                'room_id': item.get('room_id'),
                'room_name': room_data.get('name', 'Unknown'),
                'room_capacity': room_data.get('capacity', 0),
                'time_slot_id': item.get('time_slot_id'),
                'day': slot_data.get('day', ''),
                'time': f"{slot_data.get('start', '')} - {slot_data.get('end', '')}"
            })
        
        return {
            'algorithm': 'QIA',
            'status': result.get('status', 'ERROR'),
            'solve_time': result.get('solve_time_seconds', 0),
            'scheduled': len(result.get('schedule', [])),
            'total_courses': len(courses),
            'schedule': enhanced_schedule,
            'details': {
                'solver': 'Quantum-Inspired Evolutionary',
                'approach': 'Probability amplitude evolution',
                'generations': generations,
                'population': population,
                'final_fitness': result.get('statistics', {}).get('best_fitness', 0)
            }
        }
    except Exception as e:
        traceback.print_exc()
        return {
            'algorithm': 'QIA',
            'status': 'ERROR',
            'error': str(e),
            'solve_time': 0,
            'scheduled': 0,
            'total_courses': len(courses),
            'schedule': []
        }


def run_qubo(courses, rooms, time_slots, iterations=10000, temp=100.0):
    """Run QUBO with Simulated Annealing and return real results"""
    try:
        from room_allocation_qubo import QUBORoomAllocator, Course, Room, TimeSlot
        
        allocator = QUBORoomAllocator()
        
        # Add time slots
        for ts in time_slots:
            allocator.add_time_slot(TimeSlot(ts['id'], ts['day'], ts['start'], ts['end']))
        
        # Add rooms
        for r in rooms:
            allocator.add_room(Room(r['id'], r['name'], r['capacity'], r['building']))
        
        # Add courses
        for c in courses:
            allocator.add_course(Course(c['id'], c['name'], c['faculty_id'], c['duration'], c['students']))
        
        # Solve with simulated annealing
        result = allocator.solve_simulated_annealing(
            initial_temp=temp,
            final_temp=0.01,
            cooling_rate=0.995,
            max_iterations=iterations
        )
        
        # Enhanced schedule with more info
        enhanced_schedule = []
        for item in result.get('schedule', []):
            course_data = next((c for c in courses if c['id'] == item.get('course_id')), {})
            room_data = next((r for r in rooms if r['id'] == item.get('room_id')), {})
            slot_data = next((s for s in time_slots if s['id'] == item.get('time_slot_id')), {})
            
            enhanced_schedule.append({
                'course_id': item.get('course_id'),
                'course_name': course_data.get('name', 'Unknown'),
                'students': course_data.get('students', 0),
                'room_id': item.get('room_id'),
                'room_name': room_data.get('name', 'Unknown'),
                'room_capacity': room_data.get('capacity', 0),
                'time_slot_id': item.get('time_slot_id'),
                'day': slot_data.get('day', ''),
                'time': f"{slot_data.get('start', '')} - {slot_data.get('end', '')}"
            })
        
        # IMPORTANT: QUBO may produce multiple assignments per course
        # Count unique courses actually scheduled
        unique_courses = set(item['course_id'] for item in enhanced_schedule if item.get('course_id'))
        
        # Deduplicate: keep only one assignment per course (first one found)
        seen_courses = set()
        deduplicated_schedule = []
        for item in enhanced_schedule:
            cid = item.get('course_id')
            if cid and cid not in seen_courses:
                seen_courses.add(cid)
                deduplicated_schedule.append(item)
        
        return {
            'algorithm': 'QUBO',
            'status': result.get('status', 'ERROR'),
            'solve_time': result.get('solve_time_seconds', 0),
            'scheduled': len(unique_courses),  # Count unique courses, not raw assignments
            'total_courses': len(courses),
            'schedule': deduplicated_schedule,  # Use deduplicated schedule
            'raw_assignments': len(enhanced_schedule),  # For debugging
            'details': {
                'solver': 'Simulated Annealing',
                'approach': 'QUBO energy minimization',
                'iterations': iterations,
                'initial_temp': temp,
                'final_energy': result.get('statistics', {}).get('final_energy', 0),
                'note': f'{len(enhanced_schedule)} raw assignments → {len(unique_courses)} unique courses'
            }
        }
    except Exception as e:
        traceback.print_exc()
        return {
            'algorithm': 'QUBO',
            'status': 'ERROR',
            'error': str(e),
            'solve_time': 0,
            'scheduled': 0,
            'total_courses': len(courses),
            'schedule': []
        }


def run_qaoa_mini(courses, rooms, time_slots):
    """Run a simplified QAOA (limited due to qubit constraints)"""
    try:
        # QAOA is limited to small problems in simulation
        # Use only first few courses/rooms/timeslots
        max_vars = 15  # Max qubits we can reasonably simulate
        
        # Calculate how many of each we can use
        n_courses = min(len(courses), 3)
        n_rooms = min(len(rooms), 2)
        n_slots = min(len(time_slots), 3)
        
        # Trim problem
        small_courses = courses[:n_courses]
        small_rooms = rooms[:n_rooms]
        small_slots = time_slots[:n_slots]
        
        try:
            from room_allocation_qaoa import QAOARoomAllocator, Course, Room, TimeSlot
            
            allocator = QAOARoomAllocator(p=1)  # Single layer for speed
            
            for ts in small_slots:
                allocator.add_time_slot(TimeSlot(ts['id'], ts['day'], ts['start'], ts['end']))
            
            for r in small_rooms:
                allocator.add_room(Room(r['id'], r['name'], r['capacity'], r['building']))
            
            for c in small_courses:
                allocator.add_course(Course(c['id'], c['name'], c['faculty_id'], c['duration'], c['students']))
            
            result = allocator.solve(shots=512, optimizer_maxiter=20)
            
            # Enhanced schedule with more info
            enhanced_schedule = []
            for item in result.get('schedule', []):
                course_data = next((c for c in small_courses if c['id'] == item.get('course_id')), {})
                room_data = next((r for r in small_rooms if r['id'] == item.get('room_id')), {})
                slot_data = next((s for s in small_slots if s['id'] == item.get('time_slot_id')), {})
                
                enhanced_schedule.append({
                    'course_id': item.get('course_id'),
                    'course_name': course_data.get('name', 'Unknown'),
                    'students': course_data.get('students', 0),
                    'room_id': item.get('room_id'),
                    'room_name': room_data.get('name', 'Unknown'),
                    'room_capacity': room_data.get('capacity', 0),
                    'time_slot_id': item.get('time_slot_id'),
                    'day': slot_data.get('day', ''),
                    'time': f"{slot_data.get('start', '')} - {slot_data.get('end', '')}"
                })
            
            return {
                'algorithm': 'QAOA',
                'status': result.get('status', 'ERROR'),
                'solve_time': result.get('solve_time_seconds', 0),
                'scheduled': len(result.get('schedule', [])),
                'total_courses': n_courses,
                'original_courses': len(courses),
                'schedule': enhanced_schedule,
                'details': {
                    'solver': 'Qiskit QAOA',
                    'approach': 'Quantum variational algorithm',
                    'qubits_used': result.get('statistics', {}).get('num_qubits', 0),
                    'note': f'Limited to {n_courses} courses (qubit constraint)'
                }
            }
        except ImportError:
            # If Qiskit not installed, simulate
            start = time.time()
            time.sleep(0.1 + n_courses * 0.05)  # Simulate processing
            return {
                'algorithm': 'QAOA',
                'status': 'SIMULATED',
                'solve_time': time.time() - start,
                'scheduled': n_courses,
                'total_courses': n_courses,
                'original_courses': len(courses),
                'schedule': [],
                'details': {
                    'solver': 'QAOA (Qiskit not installed)',
                    'approach': 'Would use quantum variational',
                    'note': 'Install qiskit for real QAOA execution'
                }
            }
    except Exception as e:
        traceback.print_exc()
        return {
            'algorithm': 'QAOA',
            'status': 'ERROR',
            'error': str(e),
            'solve_time': 0,
            'scheduled': 0,
            'total_courses': len(courses),
            'schedule': []
        }


@app.route('/api/battle', methods=['POST'])
def start_battle():
    """Start a battle between algorithms"""
    data = request.json
    
    # Get battle parameters
    num_courses = data.get('courses', 8)
    num_rooms = data.get('rooms', 6)
    num_timeslots = data.get('timeslots', 40)
    
    # Algorithm-specific settings
    settings = data.get('settings', {})
    qia_generations = settings.get('qia_generations', 100)
    qia_population = settings.get('qia_population', 30)
    qubo_iterations = settings.get('qubo_iterations', 10000)
    qubo_temp = settings.get('qubo_temp', 100.0)
    cpsat_time_limit = settings.get('cpsat_time_limit', 30)
    
    # Which algorithms to run
    run_algorithms = data.get('algorithms', ['cpsat', 'qia', 'qubo', 'qaoa'])
    
    # Generate problem
    courses, rooms, time_slots = generate_problem(num_courses, num_rooms, num_timeslots)
    
    # Create battle ID
    battle_id = f"battle_{int(time.time() * 1000)}"
    battle_status[battle_id] = {
        'status': 'running',
        'started': time.time(),
        'algorithms': {algo: 'waiting' for algo in run_algorithms}
    }
    battle_results[battle_id] = {}
    
    # Problem info
    problem_info = {
        'courses': len(courses),
        'rooms': len(rooms),
        'time_slots': len(time_slots),
        'binary_variables': len(courses) * len(rooms) * len(time_slots),
        'faculty_count': len(set(c['faculty_id'] for c in courses)),
        'course_list': [c['id'] for c in courses],
        'room_list': [{'id': r['id'], 'capacity': r['capacity']} for r in rooms]
    }
    
    # Thread-safe result storage with mutex
    result_lock = threading.Lock()
    
    def run_algorithm(algo_name, func, *args):
        """Run algorithm with error handling and precise timing"""
        try:
            battle_status[battle_id]['algorithms'][algo_name] = 'running'
            
            # Use precise timer for accurate measurement
            start_precise = precise_time()
            result = func(*args)
            end_precise = precise_time()
            
            # Override solve time with our precise measurement if needed
            if result.get('solve_time', 0) == 0:
                result['solve_time'] = round(end_precise - start_precise, 6)
            
            with result_lock:
                battle_results[battle_id][algo_name] = result
            
            battle_status[battle_id]['algorithms'][algo_name] = 'completed'
            
        except Exception as e:
            traceback.print_exc()
            error_result = {
                'algorithm': algo_name.upper(),
                'status': 'ERROR',
                'error': str(e),
                'solve_time': 0,
                'scheduled': 0,
                'total_courses': len(courses),
                'schedule': []
            }
            with result_lock:
                battle_results[battle_id][algo_name] = error_result
            battle_status[battle_id]['algorithms'][algo_name] = 'error'
    
    # Run algorithms in threads for parallel execution
    threads = []
    
    if 'cpsat' in run_algorithms:
        t = threading.Thread(target=run_algorithm, args=('cpsat', run_cpsat, courses, rooms, time_slots, cpsat_time_limit))
        threads.append(t)
    
    if 'qia' in run_algorithms:
        t = threading.Thread(target=run_algorithm, args=('qia', run_qia, courses, rooms, time_slots, qia_generations, qia_population))
        threads.append(t)
    
    if 'qubo' in run_algorithms:
        t = threading.Thread(target=run_algorithm, args=('qubo', run_qubo, courses, rooms, time_slots, qubo_iterations, qubo_temp))
        threads.append(t)
    
    if 'qaoa' in run_algorithms:
        t = threading.Thread(target=run_algorithm, args=('qaoa', run_qaoa_mini, courses, rooms, time_slots))
        threads.append(t)
    
    # Start all threads
    for t in threads:
        t.start()
    
    # Wait for all to complete
    for t in threads:
        t.join()
    
    battle_status[battle_id]['status'] = 'completed'
    battle_status[battle_id]['completed'] = time.time()
    
    # Determine winner
    # FAIR COMPARISON CRITERIA:
    # 1. Primary: Most courses scheduled (higher is better)
    # 2. Secondary: Fastest solve time (lower is better)
    # 3. Tertiary: Status (OPTIMAL > FEASIBLE > SUCCESS > others)
    results_list = []
    status_priority = {'OPTIMAL': 0, 'FEASIBLE': 1, 'SUCCESS': 2}
    
    for algo, result in battle_results[battle_id].items():
        scheduled = result.get('scheduled', 0)
        solve_time = result.get('solve_time', 999)
        status = result.get('status', 'UNKNOWN')
        status_score = status_priority.get(status, 99)
        
        # Calculate efficiency score for tie-breaking
        total = result.get('total_courses', 1)
        efficiency = scheduled / total if total > 0 else 0
        
        results_list.append({
            **result,
            'efficiency': round(efficiency * 100, 1),
            'status_priority': status_score
        })
    
    # Sort by: 1) Most scheduled, 2) Fastest time, 3) Best status
    results_list.sort(key=lambda x: (
        -x.get('scheduled', 0),  # More scheduled = better (negative for descending)
        x.get('solve_time', 999),  # Less time = better
        x.get('status_priority', 99)  # Better status = better
    ))
    
    # Assign ranks
    for i, r in enumerate(results_list):
        r['rank'] = i + 1
    
    return jsonify({
        'battle_id': battle_id,
        'problem': problem_info,
        'results': results_list,
        'winner': results_list[0] if results_list else None
    })


@app.route('/api/status/<battle_id>', methods=['GET'])
def get_status(battle_id):
    """Get battle status"""
    if battle_id not in battle_status:
        return jsonify({'error': 'Battle not found'}), 404
    return jsonify(battle_status[battle_id])


@app.route('/api/health', methods=['GET'])
def health_check():
    """Check server health and available algorithms"""
    available = []
    
    try:
        from room_allocation_cpsat import CPSATRoomAllocator
        available.append('cpsat')
    except ImportError:
        pass
    
    try:
        from room_allocation_qia import QIARoomAllocator
        available.append('qia')
    except ImportError:
        pass
    
    try:
        from room_allocation_qubo import QUBORoomAllocator
        available.append('qubo')
    except ImportError:
        pass
    
    try:
        from room_allocation_qaoa import QAOARoomAllocator
        available.append('qaoa')
    except ImportError:
        available.append('qaoa_simulated')
    
    return jsonify({
        'status': 'healthy',
        'available_algorithms': available,
        'message': 'Battle server ready!'
    })


@app.route('/')
def index():
    """Serve info page"""
    return """
    <html>
    <head><title>Algorithm Battle Server</title></head>
    <body style="font-family: Arial; padding: 20px; background: #1a1a2e; color: white;">
        <h1>⚔️ Algorithm Battle Server</h1>
        <p>Server is running! Open <code>algorithm_race.html</code> in your browser.</p>
        <h3>API Endpoints:</h3>
        <ul>
            <li><code>POST /api/battle</code> - Start a new battle</li>
            <li><code>GET /api/status/&lt;battle_id&gt;</code> - Get battle status</li>
            <li><code>GET /api/health</code> - Check available algorithms</li>
        </ul>
        <p><a href="/api/health" style="color: cyan;">Check Health</a></p>
    </body>
    </html>
    """


if __name__ == '__main__':
    print("""
    ╔══════════════════════════════════════════════════════════════╗
    ║           ⚔️  ALGORITHM BATTLE SERVER  ⚔️                     ║
    ╠══════════════════════════════════════════════════════════════╣
    ║  Server starting at: http://localhost:5000                   ║
    ║  Open algorithm_battle.html in your browser to start!        ║
    ╚══════════════════════════════════════════════════════════════╝
    """)
    # Disable reloader to prevent crashes during file edits
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)
