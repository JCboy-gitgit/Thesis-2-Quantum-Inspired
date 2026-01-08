"""
================================================================================
CP-SAT (Constraint Programming - Satisfiability) Room Allocation Solver
================================================================================

WHAT IS CP-SAT?
---------------
CP-SAT is Google's Constraint Programming solver from OR-Tools library.
It uses SAT (Boolean Satisfiability) solving techniques combined with 
constraint propagation to find optimal solutions.

HOW IT WORKS:
-------------
1. Define VARIABLES: Binary variables x[c,r,t] = 1 if course c is in room r at time t
2. Define CONSTRAINTS: Rules that must be satisfied
   - Each course must be scheduled exactly once
   - No room can have multiple courses at the same time
   - Room capacity must fit the course size
   - Faculty availability constraints
3. Define OBJECTIVE: What to optimize (minimize conflicts, maximize preferences)
4. SOLVE: CP-SAT explores the solution space efficiently

ADVANTAGES:
-----------
- Guaranteed optimal solution (if exists)
- Fast for medium-sized problems
- Easy to add complex constraints
- Deterministic results

DISADVANTAGES:
--------------
- Exponential worst-case complexity
- May be slow for very large problems
- Less flexible than heuristic approaches

================================================================================
"""

from ortools.sat.python import cp_model
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
import json
import time


@dataclass
class Course:
    """Represents a course to be scheduled"""
    id: str
    name: str
    faculty_id: str
    duration_hours: int  # Duration in time slots
    student_count: int
    preferred_rooms: List[str] = None  # Optional room preferences
    preferred_times: List[int] = None  # Optional time preferences


@dataclass
class Room:
    """Represents a room"""
    id: str
    name: str
    capacity: int
    building: str
    room_type: str  # 'lecture', 'lab', 'seminar'
    available_times: List[int] = None  # Time slots when room is available


@dataclass
class Faculty:
    """Represents a faculty member"""
    id: str
    name: str
    department: str
    available_times: List[int] = None  # Time slots when faculty is available
    max_courses_per_day: int = 3


@dataclass
class TimeSlot:
    """Represents a time slot"""
    id: int
    day: str  # 'Monday', 'Tuesday', etc.
    start_time: str  # '08:00'
    end_time: str  # '09:00'


class CPSATRoomAllocator:
    """
    Room Allocation using CP-SAT Constraint Programming
    
    This solver creates a mathematical model of the scheduling problem
    and uses Google OR-Tools to find the optimal assignment.
    """
    
    def __init__(self):
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()
        
        # Data containers
        self.courses: List[Course] = []
        self.rooms: List[Room] = []
        self.faculty: List[Faculty] = []
        self.time_slots: List[TimeSlot] = []
        
        # Decision variables: x[course_id][room_id][time_slot] = 1 if assigned
        self.x = {}
        
        # Solution storage
        self.solution = None
        self.solve_time = 0
    
    def add_course(self, course: Course):
        """Add a course to be scheduled"""
        self.courses.append(course)
    
    def add_room(self, room: Room):
        """Add a room to the system"""
        self.rooms.append(room)
    
    def add_faculty(self, faculty: Faculty):
        """Add a faculty member"""
        self.faculty.append(faculty)
    
    def add_time_slot(self, time_slot: TimeSlot):
        """Add a time slot"""
        self.time_slots.append(time_slot)
    
    def _create_variables(self):
        """
        Create decision variables for the model.
        
        x[c][r][t] = 1 if course c is assigned to room r at time t
        
        This is a 3D binary assignment problem.
        """
        print("Creating decision variables...")
        
        for course in self.courses:
            self.x[course.id] = {}
            for room in self.rooms:
                self.x[course.id][room.id] = {}
                for ts in self.time_slots:
                    # Create binary variable
                    var_name = f"x_{course.id}_{room.id}_{ts.id}"
                    self.x[course.id][room.id][ts.id] = self.model.NewBoolVar(var_name)
        
        total_vars = len(self.courses) * len(self.rooms) * len(self.time_slots)
        print(f"Created {total_vars} decision variables")
    
    def _add_constraints(self):
        """
        Add all constraints to the model.
        
        CONSTRAINT TYPES:
        1. Assignment constraints - each course scheduled exactly once
        2. Room conflict constraints - no double booking
        3. Capacity constraints - room must fit students
        4. Faculty constraints - no faculty teaching two courses simultaneously
        """
        print("Adding constraints...")
        
        # ===== CONSTRAINT 1: Each course must be assigned exactly once =====
        # Sum over all rooms and time slots for each course must equal 1
        for course in self.courses:
            assignments = []
            for room in self.rooms:
                for ts in self.time_slots:
                    assignments.append(self.x[course.id][room.id][ts.id])
            
            # Exactly one assignment per course
            self.model.Add(sum(assignments) == 1)
        
        print(f"  Added {len(self.courses)} course assignment constraints")
        
        # ===== CONSTRAINT 2: No room double-booking =====
        # For each room and time slot, at most one course can be assigned
        room_conflicts = 0
        for room in self.rooms:
            for ts in self.time_slots:
                courses_in_room = []
                for course in self.courses:
                    courses_in_room.append(self.x[course.id][room.id][ts.id])
                
                # At most one course per room per time
                self.model.Add(sum(courses_in_room) <= 1)
                room_conflicts += 1
        
        print(f"  Added {room_conflicts} room conflict constraints")
        
        # ===== CONSTRAINT 3: Room capacity must fit course size =====
        # If x[c][r][t] = 1, then room.capacity >= course.student_count
        capacity_constraints = 0
        for course in self.courses:
            for room in self.rooms:
                if room.capacity < course.student_count:
                    # Room is too small - forbid this assignment
                    for ts in self.time_slots:
                        self.model.Add(self.x[course.id][room.id][ts.id] == 0)
                        capacity_constraints += 1
        
        print(f"  Added {capacity_constraints} capacity constraints")
        
        # ===== CONSTRAINT 4: Faculty availability =====
        # Faculty cannot teach two courses at the same time
        faculty_map = {f.id: f for f in self.faculty}
        faculty_constraints = 0
        
        for ts in self.time_slots:
            # Group courses by faculty
            faculty_courses = {}
            for course in self.courses:
                if course.faculty_id not in faculty_courses:
                    faculty_courses[course.faculty_id] = []
                faculty_courses[course.faculty_id].append(course)
            
            # For each faculty, at most one course at each time
            for fac_id, fac_courses in faculty_courses.items():
                if len(fac_courses) > 1:
                    course_vars = []
                    for course in fac_courses:
                        for room in self.rooms:
                            course_vars.append(self.x[course.id][room.id][ts.id])
                    
                    self.model.Add(sum(course_vars) <= 1)
                    faculty_constraints += 1
        
        print(f"  Added {faculty_constraints} faculty conflict constraints")
        
        # ===== CONSTRAINT 5: Room availability =====
        # Some rooms may not be available at certain times
        availability_constraints = 0
        for room in self.rooms:
            if room.available_times is not None:
                for ts in self.time_slots:
                    if ts.id not in room.available_times:
                        for course in self.courses:
                            self.model.Add(self.x[course.id][room.id][ts.id] == 0)
                            availability_constraints += 1
        
        print(f"  Added {availability_constraints} room availability constraints")
    
    def _set_objective(self):
        """
        Set the optimization objective.
        
        We want to MAXIMIZE:
        - Room preference satisfaction
        - Time preference satisfaction
        
        We want to MINIMIZE:
        - Wasted room capacity (assign to appropriately sized rooms)
        """
        print("Setting optimization objective...")
        
        objective_terms = []
        
        for course in self.courses:
            for room in self.rooms:
                for ts in self.time_slots:
                    score = 0
                    
                    # Bonus for room preferences
                    if course.preferred_rooms and room.id in course.preferred_rooms:
                        score += 10
                    
                    # Bonus for time preferences
                    if course.preferred_times and ts.id in course.preferred_times:
                        score += 5
                    
                    # Penalty for wasted capacity (prefer smaller fitting rooms)
                    if room.capacity >= course.student_count:
                        waste = room.capacity - course.student_count
                        score -= waste * 0.1  # Small penalty for each wasted seat
                    
                    if score != 0:
                        objective_terms.append(
                            score * self.x[course.id][room.id][ts.id]
                        )
        
        if objective_terms:
            self.model.Maximize(sum(objective_terms))
    
    def solve(self, time_limit_seconds: int = 60) -> Dict:
        """
        Solve the room allocation problem.
        
        Returns:
            Dictionary containing the solution and statistics
        """
        print("\n" + "="*60)
        print("CP-SAT Room Allocation Solver")
        print("="*60)
        
        # Build the model
        self._create_variables()
        self._add_constraints()
        self._set_objective()
        
        # Set solver parameters
        self.solver.parameters.max_time_in_seconds = time_limit_seconds
        self.solver.parameters.num_search_workers = 4  # Parallel solving
        
        print(f"\nSolving with time limit: {time_limit_seconds}s...")
        start_time = time.time()
        
        # SOLVE THE MODEL
        status = self.solver.Solve(self.model)
        
        self.solve_time = time.time() - start_time
        
        # Process results
        result = {
            'status': self._get_status_string(status),
            'solve_time_seconds': round(self.solve_time, 3),
            'schedule': [],
            'statistics': {
                'courses': len(self.courses),
                'rooms': len(self.rooms),
                'time_slots': len(self.time_slots),
                'variables': len(self.courses) * len(self.rooms) * len(self.time_slots),
            }
        }
        
        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            print(f"\n✓ Solution found in {self.solve_time:.3f} seconds!")
            
            # Extract the solution
            for course in self.courses:
                for room in self.rooms:
                    for ts in self.time_slots:
                        if self.solver.Value(self.x[course.id][room.id][ts.id]) == 1:
                            result['schedule'].append({
                                'course_id': course.id,
                                'course_name': course.name,
                                'room_id': room.id,
                                'room_name': room.name,
                                'building': room.building,
                                'time_slot_id': ts.id,
                                'day': ts.day,
                                'start_time': ts.start_time,
                                'end_time': ts.end_time,
                                'faculty_id': course.faculty_id,
                                'student_count': course.student_count,
                                'room_capacity': room.capacity
                            })
            
            if status == cp_model.OPTIMAL:
                result['objective_value'] = self.solver.ObjectiveValue()
                print(f"  Objective value: {result['objective_value']}")
        else:
            print(f"\n✗ No solution found. Status: {result['status']}")
        
        return result
    
    def _get_status_string(self, status: int) -> str:
        """Convert solver status to readable string"""
        status_map = {
            cp_model.OPTIMAL: 'OPTIMAL',
            cp_model.FEASIBLE: 'FEASIBLE',
            cp_model.INFEASIBLE: 'INFEASIBLE',
            cp_model.MODEL_INVALID: 'MODEL_INVALID',
            cp_model.UNKNOWN: 'UNKNOWN'
        }
        return status_map.get(status, 'UNKNOWN')
    
    def print_schedule(self, result: Dict):
        """Pretty print the schedule"""
        print("\n" + "="*60)
        print("GENERATED SCHEDULE")
        print("="*60)
        
        if not result['schedule']:
            print("No schedule generated.")
            return
        
        # Group by day
        days = {}
        for entry in result['schedule']:
            day = entry['day']
            if day not in days:
                days[day] = []
            days[day].append(entry)
        
        for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']:
            if day in days:
                print(f"\n{day}:")
                print("-" * 50)
                
                # Sort by start time
                sorted_entries = sorted(days[day], key=lambda x: x['start_time'])
                
                for entry in sorted_entries:
                    print(f"  {entry['start_time']}-{entry['end_time']}: "
                          f"{entry['course_name']}")
                    print(f"    Room: {entry['room_name']} ({entry['building']})")
                    print(f"    Capacity: {entry['student_count']}/{entry['room_capacity']}")


def create_sample_data() -> CPSATRoomAllocator:
    """Create sample data for testing"""
    allocator = CPSATRoomAllocator()
    
    # Add time slots (Monday-Friday, 8AM-5PM, 1-hour slots)
    slot_id = 0
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    times = [
        ('08:00', '09:00'), ('09:00', '10:00'), ('10:00', '11:00'),
        ('11:00', '12:00'), ('13:00', '14:00'), ('14:00', '15:00'),
        ('15:00', '16:00'), ('16:00', '17:00')
    ]
    
    for day in days:
        for start, end in times:
            allocator.add_time_slot(TimeSlot(slot_id, day, start, end))
            slot_id += 1
    
    # Add rooms
    rooms_data = [
        ('R101', 'Room 101', 30, 'Main Building', 'lecture'),
        ('R102', 'Room 102', 50, 'Main Building', 'lecture'),
        ('R103', 'Room 103', 25, 'Main Building', 'seminar'),
        ('LAB1', 'Computer Lab 1', 40, 'Science Building', 'lab'),
        ('LAB2', 'Computer Lab 2', 35, 'Science Building', 'lab'),
        ('AUD1', 'Auditorium', 200, 'Main Building', 'lecture'),
    ]
    
    for r_id, name, cap, building, r_type in rooms_data:
        allocator.add_room(Room(r_id, name, cap, building, r_type))
    
    # Add faculty
    faculty_data = [
        ('F001', 'Dr. Smith', 'Computer Science'),
        ('F002', 'Dr. Johnson', 'Mathematics'),
        ('F003', 'Dr. Williams', 'Physics'),
        ('F004', 'Dr. Brown', 'Computer Science'),
    ]
    
    for f_id, name, dept in faculty_data:
        allocator.add_faculty(Faculty(f_id, name, dept))
    
    # Add courses
    courses_data = [
        ('CS101', 'Intro to Programming', 'F001', 1, 45),
        ('CS201', 'Data Structures', 'F001', 1, 35),
        ('CS301', 'Algorithms', 'F004', 1, 28),
        ('MATH101', 'Calculus I', 'F002', 1, 50),
        ('MATH201', 'Linear Algebra', 'F002', 1, 40),
        ('PHY101', 'Physics I', 'F003', 1, 55),
        ('PHY102', 'Physics Lab', 'F003', 1, 30),
        ('CS401', 'Machine Learning', 'F004', 1, 25),
    ]
    
    for c_id, name, fac_id, duration, students in courses_data:
        allocator.add_course(Course(c_id, name, fac_id, duration, students))
    
    return allocator


# ============================================================================
# MAIN EXECUTION
# ============================================================================
if __name__ == "__main__":
    print("""
    ╔══════════════════════════════════════════════════════════════╗
    ║   CP-SAT (Constraint Programming - SAT) Room Allocator       ║
    ║   Using Google OR-Tools                                      ║
    ╚══════════════════════════════════════════════════════════════╝
    
    This algorithm uses CONSTRAINT PROGRAMMING to solve room allocation.
    
    KEY CONCEPTS:
    • Variables: x[course][room][time] = 0 or 1
    • Constraints: Rules that must be satisfied
    • Objective: What to optimize (preferences, efficiency)
    
    The solver explores the solution space using:
    • SAT solving techniques
    • Constraint propagation
    • Branch and bound
    """)
    
    # Create allocator with sample data
    allocator = create_sample_data()
    
    # Solve the problem
    result = allocator.solve(time_limit_seconds=30)
    
    # Print the schedule
    allocator.print_schedule(result)
    
    # Print statistics
    print("\n" + "="*60)
    print("SOLUTION STATISTICS")
    print("="*60)
    print(f"  Status: {result['status']}")
    print(f"  Solve time: {result['solve_time_seconds']} seconds")
    print(f"  Courses scheduled: {len(result['schedule'])}/{result['statistics']['courses']}")
    
    # Save result to JSON
    output_file = 'cpsat_schedule_result.json'
    with open(output_file, 'w') as f:
        json.dump(result, f, indent=2)
    print(f"\n  Results saved to: {output_file}")
