"""
================================================================================
QUBO (Quadratic Unconstrained Binary Optimization) Room Allocation Solver
================================================================================

WHAT IS QUBO?
-------------
QUBO is a mathematical framework for representing combinatorial optimization
problems. It's the standard input format for:
- Quantum Annealers (D-Wave)
- Digital Annealers (Fujitsu)
- Many quantum algorithms (QAOA, VQE)

QUBO FORM:
----------
    minimize: f(x) = x^T Q x = Σᵢ Qᵢᵢxᵢ + Σᵢ<ⱼ Qᵢⱼxᵢxⱼ
    
Where:
- x is a vector of binary variables (0 or 1)
- Q is an upper triangular matrix
- Diagonal Qᵢᵢ = linear terms
- Off-diagonal Qᵢⱼ = quadratic terms (interactions)

EQUIVALENT FORM (Ising Model):
------------------------------
    minimize: H(s) = Σᵢ hᵢsᵢ + Σᵢ<ⱼ Jᵢⱼsᵢsⱼ
    
Where s ∈ {-1, +1} instead of {0, 1}

HOW TO CONVERT PROBLEMS TO QUBO:
---------------------------------
1. Define binary variables for each decision
2. Express objective function in quadratic form
3. Convert constraints to penalty terms:
   - Equality constraint (Σxᵢ = k): P(Σxᵢ - k)²
   - Inequality constraint (Σxᵢ ≤ k): Add slack variables

ROOM ALLOCATION QUBO:
---------------------
Variables: xᵢⱼₖ = 1 if course i in room j at time k

Objective: Minimize waste + maximize preferences

Constraints (as penalties):
- Each course exactly once: P(Σⱼₖ xᵢⱼₖ - 1)²
- No room conflicts: P(Σᵢ xᵢⱼₖ)(Σᵢ' xᵢ'ⱼₖ) for i≠i'
- No faculty conflicts: Similar for same faculty

ADVANTAGES:
-----------
- Standard format for quantum/classical optimizers
- Can be solved on D-Wave quantum annealers
- Efficient classical heuristics available

DISADVANTAGES:
--------------
- Converting constraints adds many penalty terms
- Q matrix can become very large
- Penalty weight tuning is crucial

================================================================================
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
import json
import time
import random


@dataclass
class Course:
    """Represents a course to be scheduled"""
    id: str
    name: str
    faculty_id: str
    duration_hours: int
    student_count: int


@dataclass
class Room:
    """Represents a room"""
    id: str
    name: str
    capacity: int
    building: str


@dataclass
class TimeSlot:
    """Represents a time slot"""
    id: int
    day: str
    start_time: str
    end_time: str


class QUBORoomAllocator:
    """
    Room Allocation using QUBO formulation.
    
    This solver:
    1. Converts the problem to QUBO form
    2. Solves using classical simulated annealing
    3. Can export to D-Wave format for quantum annealing
    """
    
    def __init__(self):
        # Data containers
        self.courses: List[Course] = []
        self.rooms: List[Room] = []
        self.time_slots: List[TimeSlot] = []
        
        # Variable mapping
        self.var_map = {}  # idx -> (course_id, room_id, ts_id)
        self.reverse_map = {}  # (course_id, room_id, ts_id) -> idx
        self.n_vars = 0
        
        # QUBO matrix
        self.Q = None
        
        # Results
        self.solve_time = 0
        self.best_solution = None
        self.best_energy = float('inf')
    
    def add_course(self, course: Course):
        self.courses.append(course)
    
    def add_room(self, room: Room):
        self.rooms.append(room)
    
    def add_time_slot(self, time_slot: TimeSlot):
        self.time_slots.append(time_slot)
    
    def _build_variable_mapping(self):
        """Build mapping between variable indices and assignments."""
        var_idx = 0
        for course in self.courses:
            for room in self.rooms:
                if room.capacity >= course.student_count:
                    for ts in self.time_slots:
                        self.var_map[var_idx] = (course.id, room.id, ts.id)
                        self.reverse_map[(course.id, room.id, ts.id)] = var_idx
                        var_idx += 1
        
        self.n_vars = var_idx
        print(f"Variable mapping built: {self.n_vars} binary variables")
    
    def build_qubo(self, penalty: float = 100.0) -> np.ndarray:
        """
        Build the QUBO matrix Q.
        
        The QUBO problem is: minimize x^T Q x
        
        Args:
            penalty: Weight for constraint violation penalties
            
        Returns:
            Upper triangular QUBO matrix Q
        """
        print("\n" + "="*60)
        print("Building QUBO Matrix")
        print("="*60)
        
        self._build_variable_mapping()
        
        # Initialize Q matrix
        self.Q = np.zeros((self.n_vars, self.n_vars))
        
        # ============================================================
        # OBJECTIVE: Minimize room capacity waste
        # ============================================================
        # For each assignment, add linear cost for wasted capacity
        print("\nAdding objective terms (minimize waste)...")
        
        for i in range(self.n_vars):
            course_id, room_id, _ = self.var_map[i]
            course = next(c for c in self.courses if c.id == course_id)
            room = next(r for r in self.rooms if r.id == room_id)
            
            # Linear term: waste penalty
            waste = room.capacity - course.student_count
            self.Q[i, i] += waste * 0.1  # Small weight for objective
        
        # ============================================================
        # CONSTRAINT 1: Each course scheduled exactly once
        # ============================================================
        # Penalty: P * (Σⱼₖ xᵢⱼₖ - 1)²
        # Expanded: P * [Σⱼₖ xᵢⱼₖ² - 2Σⱼₖ xᵢⱼₖ + 1 + 2Σ_{(j,k)<(j',k')} xᵢⱼₖ xᵢⱼ'ₖ']
        # Since xᵢⱼₖ² = xᵢⱼₖ (binary): P * [(1-2)Σⱼₖ xᵢⱼₖ + 1 + 2Σpairs]
        #                              = P * [-Σⱼₖ xᵢⱼₖ + 1 + 2Σpairs]
        
        print("Adding constraint 1: Each course scheduled once...")
        
        for course in self.courses:
            # Get all variables for this course
            course_vars = []
            for i in range(self.n_vars):
                if self.var_map[i][0] == course.id:
                    course_vars.append(i)
            
            # Linear terms: P * (1 - 2) = -P for each variable
            # But we also add P for the constant term, so net linear is -P
            for i in course_vars:
                self.Q[i, i] += -penalty  # Linear: P(-2) from expansion + P(1) from x²=x
            
            # Quadratic terms: 2P for each pair
            for idx1, i in enumerate(course_vars):
                for j in course_vars[idx1 + 1:]:
                    # Ensure upper triangular
                    row, col = min(i, j), max(i, j)
                    self.Q[row, col] += 2 * penalty
        
        # ============================================================
        # CONSTRAINT 2: No room double-booking
        # ============================================================
        # For each (room, time): at most one course
        # Penalty: P * Σ_{i<i'} xᵢⱼₖ xᵢ'ⱼₖ (for same room j, time k)
        
        print("Adding constraint 2: No room conflicts...")
        
        for room in self.rooms:
            for ts in self.time_slots:
                # Get all variables for this room and time
                rt_vars = []
                for i in range(self.n_vars):
                    if self.var_map[i][1] == room.id and self.var_map[i][2] == ts.id:
                        rt_vars.append(i)
                
                # Add quadratic penalty for all pairs
                for idx1, i in enumerate(rt_vars):
                    for j in rt_vars[idx1 + 1:]:
                        row, col = min(i, j), max(i, j)
                        self.Q[row, col] += 2 * penalty
        
        # ============================================================
        # CONSTRAINT 3: No faculty conflicts
        # ============================================================
        # For each (faculty, time): at most one course
        
        print("Adding constraint 3: No faculty conflicts...")
        
        for ts in self.time_slots:
            # Group variables by faculty
            faculty_vars = {}
            for i in range(self.n_vars):
                course_id, _, ts_id = self.var_map[i]
                if ts_id == ts.id:
                    course = next(c for c in self.courses if c.id == course_id)
                    fac_id = course.faculty_id
                    if fac_id not in faculty_vars:
                        faculty_vars[fac_id] = []
                    faculty_vars[fac_id].append(i)
            
            # Add penalty for same faculty at same time
            for fac_id, fac_var_list in faculty_vars.items():
                for idx1, i in enumerate(fac_var_list):
                    for j in fac_var_list[idx1 + 1:]:
                        row, col = min(i, j), max(i, j)
                        self.Q[row, col] += 2 * penalty
        
        # Count non-zero elements
        nonzero = np.count_nonzero(self.Q)
        print(f"\nQUBO matrix built:")
        print(f"  Size: {self.n_vars} x {self.n_vars}")
        print(f"  Non-zero elements: {nonzero}")
        print(f"  Density: {100*nonzero/(self.n_vars**2):.2f}%")
        
        return self.Q
    
    def calculate_energy(self, x: np.ndarray) -> float:
        """
        Calculate QUBO energy for a given solution.
        
        Energy = x^T Q x
        """
        return float(x @ self.Q @ x)
    
    def solve_simulated_annealing(
        self,
        initial_temp: float = 100.0,
        final_temp: float = 0.01,
        cooling_rate: float = 0.995,
        max_iterations: int = 10000
    ) -> Dict:
        """
        Solve QUBO using simulated annealing.
        
        Simulated annealing mimics the physical process of heating
        and slowly cooling a material to reach low-energy state.
        
        Args:
            initial_temp: Starting temperature (high = more exploration)
            final_temp: Ending temperature (low = exploitation)
            cooling_rate: How fast to cool (0.99 = slow, 0.9 = fast)
            max_iterations: Maximum number of iterations
            
        Returns:
            Dictionary containing solution and statistics
        """
        print("\n" + "="*60)
        print("Solving QUBO with Simulated Annealing")
        print("="*60)
        
        if self.Q is None:
            self.build_qubo()
        
        start_time = time.time()
        
        # Initialize with random solution
        x = np.random.randint(0, 2, self.n_vars)
        current_energy = self.calculate_energy(x)
        
        self.best_solution = x.copy()
        self.best_energy = current_energy
        
        temperature = initial_temp
        iteration = 0
        
        energy_history = []
        
        print(f"\nSimulated Annealing Parameters:")
        print(f"  Initial temperature: {initial_temp}")
        print(f"  Final temperature: {final_temp}")
        print(f"  Cooling rate: {cooling_rate}")
        print(f"  Max iterations: {max_iterations}")
        print(f"\nOptimizing...")
        
        while temperature > final_temp and iteration < max_iterations:
            # Choose random variable to flip
            flip_idx = random.randint(0, self.n_vars - 1)
            
            # Calculate energy change (efficient delta calculation)
            # ΔE = Q[i,i](1-2xᵢ) + Σⱼ≠ᵢ Qᵢⱼ(xⱼ)(1-2xᵢ)
            delta_e = self.Q[flip_idx, flip_idx] * (1 - 2 * x[flip_idx])
            for j in range(self.n_vars):
                if j != flip_idx:
                    if flip_idx < j:
                        delta_e += self.Q[flip_idx, j] * x[j] * (1 - 2 * x[flip_idx])
                    else:
                        delta_e += self.Q[j, flip_idx] * x[j] * (1 - 2 * x[flip_idx])
            
            # Metropolis criterion
            if delta_e < 0 or random.random() < np.exp(-delta_e / temperature):
                x[flip_idx] = 1 - x[flip_idx]  # Flip the bit
                current_energy += delta_e
                
                # Update best if improved
                if current_energy < self.best_energy:
                    self.best_energy = current_energy
                    self.best_solution = x.copy()
            
            # Cool down
            temperature *= cooling_rate
            iteration += 1
            
            # Record history periodically
            if iteration % 100 == 0:
                energy_history.append(self.best_energy)
            
            # Progress output
            if iteration % 2000 == 0:
                print(f"  Iteration {iteration}: Best energy = {self.best_energy:.2f}, "
                      f"Temp = {temperature:.4f}")
        
        self.solve_time = time.time() - start_time
        
        print(f"\n✓ Optimization completed in {self.solve_time:.3f} seconds")
        print(f"  Final best energy: {self.best_energy:.2f}")
        
        # Build result
        result = self._extract_solution()
        result['statistics']['iterations'] = iteration
        result['statistics']['final_temperature'] = temperature
        result['statistics']['energy_history'] = energy_history
        
        return result
    
    def solve_tabu_search(
        self,
        tabu_tenure: int = 10,
        max_iterations: int = 5000
    ) -> Dict:
        """
        Solve QUBO using Tabu Search.
        
        Tabu search avoids cycling by keeping a "tabu list" of
        recently visited solutions that cannot be revisited.
        
        Args:
            tabu_tenure: How long a move stays tabu
            max_iterations: Maximum iterations
            
        Returns:
            Dictionary containing solution and statistics
        """
        print("\n" + "="*60)
        print("Solving QUBO with Tabu Search")
        print("="*60)
        
        if self.Q is None:
            self.build_qubo()
        
        start_time = time.time()
        
        # Initialize with random solution
        x = np.random.randint(0, 2, self.n_vars)
        current_energy = self.calculate_energy(x)
        
        self.best_solution = x.copy()
        self.best_energy = current_energy
        
        # Tabu list: stores iteration when each variable was last flipped
        tabu_list = np.zeros(self.n_vars, dtype=int) - tabu_tenure
        
        print(f"\nTabu Search Parameters:")
        print(f"  Tabu tenure: {tabu_tenure}")
        print(f"  Max iterations: {max_iterations}")
        print(f"\nOptimizing...")
        
        for iteration in range(max_iterations):
            best_move = None
            best_move_energy = float('inf')
            
            # Evaluate all possible moves
            for i in range(self.n_vars):
                # Check if move is tabu
                is_tabu = (iteration - tabu_list[i]) < tabu_tenure
                
                # Calculate energy after flip
                delta_e = self.Q[i, i] * (1 - 2 * x[i])
                for j in range(self.n_vars):
                    if j != i:
                        if i < j:
                            delta_e += self.Q[i, j] * x[j] * (1 - 2 * x[i])
                        else:
                            delta_e += self.Q[j, i] * x[j] * (1 - 2 * x[i])
                
                new_energy = current_energy + delta_e
                
                # Accept if not tabu, or if aspiration criterion met
                if not is_tabu or new_energy < self.best_energy:
                    if new_energy < best_move_energy:
                        best_move = i
                        best_move_energy = new_energy
            
            # Make the best move
            if best_move is not None:
                x[best_move] = 1 - x[best_move]
                current_energy = best_move_energy
                tabu_list[best_move] = iteration
                
                if current_energy < self.best_energy:
                    self.best_energy = current_energy
                    self.best_solution = x.copy()
            
            if iteration % 1000 == 0:
                print(f"  Iteration {iteration}: Best energy = {self.best_energy:.2f}")
        
        self.solve_time = time.time() - start_time
        
        print(f"\n✓ Optimization completed in {self.solve_time:.3f} seconds")
        print(f"  Final best energy: {self.best_energy:.2f}")
        
        result = self._extract_solution()
        result['statistics']['algorithm'] = 'tabu_search'
        result['statistics']['tabu_tenure'] = tabu_tenure
        
        return result
    
    def _extract_solution(self) -> Dict:
        """Extract the schedule from the best solution found."""
        result = {
            'status': 'SUCCESS',
            'solve_time_seconds': round(self.solve_time, 3),
            'schedule': [],
            'statistics': {
                'courses': len(self.courses),
                'rooms': len(self.rooms),
                'time_slots': len(self.time_slots),
                'variables': self.n_vars,
                'final_energy': self.best_energy
            }
        }
        
        if self.best_solution is not None:
            for i, val in enumerate(self.best_solution):
                if val == 1 and i in self.var_map:
                    course_id, room_id, ts_id = self.var_map[i]
                    
                    course = next(c for c in self.courses if c.id == course_id)
                    room = next(r for r in self.rooms if r.id == room_id)
                    ts = next(t for t in self.time_slots if t.id == ts_id)
                    
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
        
        return result
    
    def export_to_dwave_format(self, filename: str = 'qubo_dwave.json'):
        """
        Export QUBO to D-Wave compatible format.
        
        D-Wave uses a dictionary format:
        {(i, j): Q[i,j], ...}
        """
        if self.Q is None:
            self.build_qubo()
        
        qubo_dict = {}
        for i in range(self.n_vars):
            for j in range(i, self.n_vars):
                if self.Q[i, j] != 0:
                    qubo_dict[f"({i}, {j})"] = float(self.Q[i, j])
        
        export_data = {
            'format': 'D-Wave QUBO',
            'n_variables': self.n_vars,
            'qubo': qubo_dict,
            'variable_mapping': {str(k): v for k, v in self.var_map.items()}
        }
        
        with open(filename, 'w') as f:
            json.dump(export_data, f, indent=2)
        
        print(f"QUBO exported to D-Wave format: {filename}")
    
    def print_schedule(self, result: Dict):
        """Pretty print the schedule"""
        print("\n" + "="*60)
        print("QUBO GENERATED SCHEDULE")
        print("="*60)
        
        if not result['schedule']:
            print("No schedule generated.")
            return
        
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
                
                sorted_entries = sorted(days[day], key=lambda x: x['start_time'])
                
                for entry in sorted_entries:
                    print(f"  {entry['start_time']}-{entry['end_time']}: "
                          f"{entry['course_name']}")
                    print(f"    Room: {entry['room_name']} ({entry['building']})")
                    print(f"    Students: {entry['student_count']}/{entry['room_capacity']}")


def create_sample_data() -> QUBORoomAllocator:
    """Create sample data for testing"""
    allocator = QUBORoomAllocator()
    
    # Add time slots
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
        ('R101', 'Room 101', 30, 'Main Building'),
        ('R102', 'Room 102', 50, 'Main Building'),
        ('R103', 'Room 103', 25, 'Main Building'),
        ('LAB1', 'Computer Lab 1', 40, 'Science Building'),
        ('LAB2', 'Computer Lab 2', 35, 'Science Building'),
        ('AUD1', 'Auditorium', 200, 'Main Building'),
    ]
    
    for r_id, name, cap, building in rooms_data:
        allocator.add_room(Room(r_id, name, cap, building))
    
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
    ║   QUBO (Quadratic Unconstrained Binary Optimization)         ║
    ║   Room Allocation Solver                                      ║
    ╚══════════════════════════════════════════════════════════════╝
    
    QUBO is the standard format for quantum optimization:
    
    MATHEMATICAL FORM:
    ==================
    
    minimize: f(x) = x^T Q x = Σᵢ Qᵢᵢxᵢ + Σᵢ<ⱼ 2Qᵢⱼxᵢxⱼ
    
    where x ∈ {0, 1}^n (binary vector)
    
    Q MATRIX STRUCTURE:
    ===================
    
        │  x₀    x₁    x₂    x₃  ...
    ────┼───────────────────────────
    x₀  │ Q₀₀   Q₀₁   Q₀₂   Q₀₃
    x₁  │   0   Q₁₁   Q₁₂   Q₁₃
    x₂  │   0     0   Q₂₂   Q₂₃
    x₃  │   0     0     0   Q₃₃
    
    • Diagonal (Qᵢᵢ): Linear terms - cost of selecting xᵢ
    • Off-diagonal (Qᵢⱼ): Interaction terms - cost when both xᵢ=1 and xⱼ=1
    
    CONSTRAINT CONVERSION:
    ======================
    
    Since QUBO is "unconstrained", we add penalty terms:
    
    Equality (Σxᵢ = k):
        Penalty = P × (Σxᵢ - k)²
               = P × [Σxᵢ² + 2Σᵢ<ⱼ xᵢxⱼ - 2kΣxᵢ + k²]
    
    For room allocation:
        xᵢⱼₖ = 1 if course i assigned to room j at time k
        
        Penalty for course i not scheduled once:
            P × (Σⱼₖ xᵢⱼₖ - 1)²
    """)
    
    # Create allocator with sample data
    allocator = create_sample_data()
    
    # Build QUBO
    Q = allocator.build_qubo(penalty=100.0)
    
    # Solve using simulated annealing
    result = allocator.solve_simulated_annealing(
        initial_temp=100.0,
        final_temp=0.01,
        cooling_rate=0.995,
        max_iterations=10000
    )
    
    # Print the schedule
    allocator.print_schedule(result)
    
    # Export to D-Wave format
    allocator.export_to_dwave_format('qubo_dwave_export.json')
    
    # Print statistics
    print("\n" + "="*60)
    print("QUBO SOLUTION STATISTICS")
    print("="*60)
    print(f"  Status: {result['status']}")
    print(f"  Solve time: {result['solve_time_seconds']} seconds")
    print(f"  QUBO variables: {result['statistics']['variables']}")
    print(f"  Final energy: {result['statistics']['final_energy']:.2f}")
    print(f"  Courses scheduled: {len(result['schedule'])}/{result['statistics']['courses']}")
    
    # Save result to JSON
    output_file = 'qubo_schedule_result.json'
    with open(output_file, 'w') as f:
        # Remove numpy arrays from result before saving
        save_result = result.copy()
        if 'energy_history' in save_result.get('statistics', {}):
            save_result['statistics']['energy_history'] = [
                float(e) for e in save_result['statistics']['energy_history']
            ]
        json.dump(save_result, f, indent=2)
    print(f"\n  Results saved to: {output_file}")
