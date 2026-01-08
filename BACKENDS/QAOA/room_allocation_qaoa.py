"""
================================================================================
QAOA (Quantum Approximate Optimization Algorithm) Room Allocation Solver
================================================================================

WHAT IS QAOA?
-------------
QAOA is a hybrid quantum-classical algorithm designed to solve combinatorial
optimization problems. It was introduced by Farhi et al. in 2014.

HOW IT WORKS:
-------------
1. PROBLEM ENCODING: Convert the room allocation problem into a cost Hamiltonian
   - Each valid assignment is encoded as a quantum state
   - The cost function becomes the Hamiltonian we want to minimize

2. QUANTUM CIRCUIT: Alternating layers of:
   - Cost layer (e^{-iγH_C}): Applies phase based on solution quality
   - Mixer layer (e^{-iβH_M}): Explores the solution space
   
3. PARAMETER OPTIMIZATION: Classical optimizer finds best γ and β
   - Run quantum circuit with parameters
   - Measure the output
   - Update parameters to improve solution

4. MEASUREMENT: Sample from the final quantum state
   - Higher amplitude states = better solutions
   - Run multiple times and keep best result

ADVANTAGES:
-----------
- Can potentially solve problems faster than classical (quantum speedup)
- Works on near-term quantum computers (NISQ devices)
- Provides approximate solutions quickly

DISADVANTAGES:
--------------
- Requires quantum hardware or simulator
- Results are probabilistic
- Limited by qubit count and noise
- May not always find optimal solution

QISKIT COMPONENTS USED:
-----------------------
- QuantumCircuit: Build the quantum circuit
- QAOA: Pre-built QAOA algorithm
- COBYLA/SPSA: Classical optimizers
- Aer: Quantum simulator

================================================================================
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
import json
import time

# Qiskit imports
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
from qiskit.primitives import Sampler
from qiskit_algorithms import QAOA
from qiskit_algorithms.optimizers import COBYLA, SPSA
from qiskit_optimization import QuadraticProgram
from qiskit_optimization.algorithms import MinimumEigenOptimizer
from qiskit_optimization.converters import QuadraticProgramToQubo

# For visualization
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt


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


class QAOARoomAllocator:
    """
    Room Allocation using QAOA (Quantum Approximate Optimization Algorithm)
    
    This solver converts the room allocation problem into a QUBO form
    and uses QAOA to find the optimal solution.
    
    QUBO = Quadratic Unconstrained Binary Optimization
    """
    
    def __init__(self, p: int = 2):
        """
        Initialize QAOA solver
        
        Args:
            p: Number of QAOA layers (circuit depth)
               Higher p = potentially better solutions but longer runtime
        """
        self.p = p  # QAOA circuit depth
        
        # Data containers
        self.courses: List[Course] = []
        self.rooms: List[Room] = []
        self.time_slots: List[TimeSlot] = []
        
        # Variable mapping
        self.var_map = {}  # Maps variable index to (course, room, time)
        self.reverse_map = {}  # Maps (course, room, time) to variable index
        
        # Results
        self.solve_time = 0
        self.optimization_result = None
    
    def add_course(self, course: Course):
        """Add a course to be scheduled"""
        self.courses.append(course)
    
    def add_room(self, room: Room):
        """Add a room to the system"""
        self.rooms.append(room)
    
    def add_time_slot(self, time_slot: TimeSlot):
        """Add a time slot"""
        self.time_slots.append(time_slot)
    
    def _build_variable_mapping(self):
        """
        Create mapping between variable indices and assignments.
        
        For QAOA, we need to convert our problem to binary variables.
        Variable x_i = 1 means the i-th assignment is selected.
        """
        print("Building variable mapping...")
        
        var_idx = 0
        for course in self.courses:
            for room in self.rooms:
                # Only consider rooms with sufficient capacity
                if room.capacity >= course.student_count:
                    for ts in self.time_slots:
                        self.var_map[var_idx] = (course.id, room.id, ts.id)
                        self.reverse_map[(course.id, room.id, ts.id)] = var_idx
                        var_idx += 1
        
        print(f"  Total binary variables: {var_idx}")
        return var_idx
    
    def _build_qubo(self) -> QuadraticProgram:
        """
        Build the Quadratic Unconstrained Binary Optimization (QUBO) problem.
        
        The QUBO form is:
            minimize: x^T Q x
        
        Where Q encodes:
        1. Objective: Preferences and efficiency
        2. Penalties: Constraint violations (converted to cost)
        
        PENALTY METHOD:
        Since QUBO is "unconstrained", we convert constraints to penalties:
        - If constraint violated: add large penalty to cost
        - If constraint satisfied: no penalty
        """
        print("Building QUBO formulation...")
        
        n_vars = self._build_variable_mapping()
        
        # Create quadratic program
        qp = QuadraticProgram(name='Room_Allocation_QUBO')
        
        # Add binary variables
        for i in range(n_vars):
            qp.binary_var(name=f'x_{i}')
        
        # ============================================================
        # OBJECTIVE FUNCTION: Preferences and efficiency
        # ============================================================
        # Linear terms (diagonal of Q matrix)
        linear_coeffs = {}
        for i in range(n_vars):
            course_id, room_id, ts_id = self.var_map[i]
            course = next(c for c in self.courses if c.id == course_id)
            room = next(r for r in self.rooms if r.id == room_id)
            
            # Small bonus for selecting this assignment (we minimize, so negative)
            # Prefer rooms with less wasted capacity
            waste = room.capacity - course.student_count
            linear_coeffs[f'x_{i}'] = waste * 0.01  # Minimize waste
        
        # ============================================================
        # CONSTRAINT PENALTIES (converted to quadratic terms)
        # ============================================================
        # Penalty weight - should be large enough to enforce constraints
        PENALTY = 100.0
        
        quadratic_coeffs = {}
        
        # PENALTY 1: Each course assigned exactly once
        # For each course c: (sum_i x_i - 1)^2 where i are assignments for c
        # Expanded: sum_i x_i^2 - 2*sum_i x_i + 1 + 2*sum_{i<j} x_i*x_j
        
        print("  Adding course assignment penalties...")
        for course in self.courses:
            # Get all variables for this course
            course_vars = []
            for i in range(n_vars):
                if self.var_map[i][0] == course.id:
                    course_vars.append(i)
            
            # Add penalty for not selecting exactly one
            # Quadratic penalty: P * (sum x_i - 1)^2
            # = P * (sum x_i^2 + 2*sum_{i<j} x_i*x_j - 2*sum x_i + 1)
            
            # Linear terms: -2P * x_i (offset by +P for each)
            for i in course_vars:
                key = f'x_{i}'
                linear_coeffs[key] = linear_coeffs.get(key, 0) - 2 * PENALTY
            
            # Quadratic terms: 2P * x_i * x_j for all pairs
            for i_idx, i in enumerate(course_vars):
                for j in course_vars[i_idx + 1:]:
                    key = (f'x_{i}', f'x_{j}')
                    quadratic_coeffs[key] = quadratic_coeffs.get(key, 0) + 2 * PENALTY
        
        # PENALTY 2: No room conflicts (at most one course per room per time)
        print("  Adding room conflict penalties...")
        for room in self.rooms:
            for ts in self.time_slots:
                # Get all variables for this room and time
                rt_vars = []
                for i in range(n_vars):
                    if self.var_map[i][1] == room.id and self.var_map[i][2] == ts.id:
                        rt_vars.append(i)
                
                # Quadratic penalty for selecting more than one
                # sum_{i<j} x_i * x_j should be 0
                for i_idx, i in enumerate(rt_vars):
                    for j in rt_vars[i_idx + 1:]:
                        key = (f'x_{i}', f'x_{j}')
                        quadratic_coeffs[key] = quadratic_coeffs.get(key, 0) + 2 * PENALTY
        
        # PENALTY 3: Faculty conflicts (no faculty teaching two courses at same time)
        print("  Adding faculty conflict penalties...")
        for ts in self.time_slots:
            # Group variables by faculty and time
            faculty_vars = {}
            for i in range(n_vars):
                course_id, _, ts_id = self.var_map[i]
                if ts_id == ts.id:
                    course = next(c for c in self.courses if c.id == course_id)
                    fac_id = course.faculty_id
                    if fac_id not in faculty_vars:
                        faculty_vars[fac_id] = []
                    faculty_vars[fac_id].append(i)
            
            # Add conflict penalty for same faculty
            for fac_id, fac_var_list in faculty_vars.items():
                for i_idx, i in enumerate(fac_var_list):
                    for j in fac_var_list[i_idx + 1:]:
                        key = (f'x_{i}', f'x_{j}')
                        quadratic_coeffs[key] = quadratic_coeffs.get(key, 0) + 2 * PENALTY
        
        # Set the objective
        qp.minimize(linear=linear_coeffs, quadratic=quadratic_coeffs)
        
        print(f"  QUBO built with {n_vars} variables")
        print(f"  Linear terms: {len(linear_coeffs)}")
        print(f"  Quadratic terms: {len(quadratic_coeffs)}")
        
        return qp
    
    def solve(self, shots: int = 1024, optimizer_maxiter: int = 100) -> Dict:
        """
        Solve the room allocation problem using QAOA.
        
        Args:
            shots: Number of measurement shots
            optimizer_maxiter: Maximum iterations for classical optimizer
            
        Returns:
            Dictionary containing the solution and statistics
        """
        print("\n" + "="*60)
        print("QAOA (Quantum Approximate Optimization) Room Allocator")
        print("="*60)
        
        start_time = time.time()
        
        # Build QUBO formulation
        qp = self._build_qubo()
        
        # Check if problem is small enough for simulation
        n_vars = len(self.var_map)
        if n_vars > 20:
            print(f"\n⚠ Warning: {n_vars} qubits required. This may be slow to simulate.")
            print("  For large problems, consider using QIA (quantum-inspired) instead.")
        
        print(f"\nConfiguring QAOA with p={self.p} layers...")
        
        # Create quantum instance (simulator)
        simulator = AerSimulator()
        sampler = Sampler()
        
        # Create classical optimizer
        # COBYLA is gradient-free, good for noisy quantum systems
        optimizer = COBYLA(maxiter=optimizer_maxiter)
        
        # Create QAOA instance
        qaoa = QAOA(
            sampler=sampler,
            optimizer=optimizer,
            reps=self.p,  # Number of QAOA layers
        )
        
        # Create minimum eigen optimizer that uses QAOA
        qaoa_optimizer = MinimumEigenOptimizer(qaoa)
        
        print(f"Running QAOA optimization...")
        print(f"  Shots: {shots}")
        print(f"  Optimizer iterations: {optimizer_maxiter}")
        
        # Solve the problem
        try:
            result = qaoa_optimizer.solve(qp)
            self.optimization_result = result
        except Exception as e:
            print(f"\n✗ Error during QAOA: {str(e)}")
            return {
                'status': 'ERROR',
                'error': str(e),
                'solve_time_seconds': time.time() - start_time,
                'schedule': []
            }
        
        self.solve_time = time.time() - start_time
        
        # Process results
        output = {
            'status': 'SUCCESS' if result.x is not None else 'FAILED',
            'solve_time_seconds': round(self.solve_time, 3),
            'schedule': [],
            'statistics': {
                'courses': len(self.courses),
                'rooms': len(self.rooms),
                'time_slots': len(self.time_slots),
                'qubits': n_vars,
                'qaoa_layers': self.p,
                'objective_value': result.fval if result.fval else None
            }
        }
        
        if result.x is not None:
            print(f"\n✓ Solution found in {self.solve_time:.3f} seconds!")
            
            # Extract the solution
            for i, val in enumerate(result.x):
                if val == 1 and i in self.var_map:
                    course_id, room_id, ts_id = self.var_map[i]
                    
                    course = next(c for c in self.courses if c.id == course_id)
                    room = next(r for r in self.rooms if r.id == room_id)
                    ts = next(t for t in self.time_slots if t.id == ts_id)
                    
                    output['schedule'].append({
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
        
        return output
    
    def print_schedule(self, result: Dict):
        """Pretty print the schedule"""
        print("\n" + "="*60)
        print("QAOA GENERATED SCHEDULE")
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
                
                sorted_entries = sorted(days[day], key=lambda x: x['start_time'])
                
                for entry in sorted_entries:
                    print(f"  {entry['start_time']}-{entry['end_time']}: "
                          f"{entry['course_name']}")
                    print(f"    Room: {entry['room_name']} ({entry['building']})")
                    print(f"    Students: {entry['student_count']}/{entry['room_capacity']}")


def create_sample_data() -> QAOARoomAllocator:
    """Create sample data for testing (smaller dataset for quantum simulation)"""
    allocator = QAOARoomAllocator(p=2)
    
    # Smaller dataset for quantum simulation (fewer qubits needed)
    # Add time slots (just 2 days, 4 slots each for demo)
    slot_id = 0
    days = ['Monday', 'Tuesday']
    times = [
        ('08:00', '09:00'), ('09:00', '10:00'),
        ('10:00', '11:00'), ('11:00', '12:00')
    ]
    
    for day in days:
        for start, end in times:
            allocator.add_time_slot(TimeSlot(slot_id, day, start, end))
            slot_id += 1
    
    # Add fewer rooms
    rooms_data = [
        ('R101', 'Room 101', 30, 'Main Building'),
        ('R102', 'Room 102', 50, 'Main Building'),
        ('LAB1', 'Computer Lab', 40, 'Science Building'),
    ]
    
    for r_id, name, cap, building in rooms_data:
        allocator.add_room(Room(r_id, name, cap, building))
    
    # Add fewer courses
    courses_data = [
        ('CS101', 'Intro to Programming', 'F001', 1, 25),
        ('CS201', 'Data Structures', 'F001', 1, 30),
        ('MATH101', 'Calculus I', 'F002', 1, 45),
        ('PHY101', 'Physics I', 'F003', 1, 35),
    ]
    
    for c_id, name, fac_id, duration, students in courses_data:
        allocator.add_course(Course(c_id, name, fac_id, duration, students))
    
    return allocator


# ============================================================================
# QAOA CIRCUIT EXPLANATION
# ============================================================================
def explain_qaoa_circuit():
    """
    Create and explain a simple QAOA circuit visually.
    """
    print("""
    ╔══════════════════════════════════════════════════════════════╗
    ║                 QAOA CIRCUIT STRUCTURE                        ║
    ╚══════════════════════════════════════════════════════════════╝
    
    The QAOA circuit has the following structure:
    
    |0⟩ ─── H ───[Cost(γ₁)]───[Mixer(β₁)]───[Cost(γ₂)]───[Mixer(β₂)]─── M
    |0⟩ ─── H ───[Cost(γ₁)]───[Mixer(β₁)]───[Cost(γ₂)]───[Mixer(β₂)]─── M
    |0⟩ ─── H ───[Cost(γ₁)]───[Mixer(β₁)]───[Cost(γ₂)]───[Mixer(β₂)]─── M
     .       .         .              .             .             .      .
     .       .         .              .             .             .      .
    |0⟩ ─── H ───[Cost(γ₁)]───[Mixer(β₁)]───[Cost(γ₂)]───[Mixer(β₂)]─── M
    
    COMPONENTS:
    ===========
    
    1. INITIAL STATE: |+⟩⊗n
       - Start with all qubits in superposition
       - H gates create equal probability for all bitstrings
    
    2. COST LAYER: e^{-iγ H_C}
       - Applies phase rotation based on cost function
       - Implemented using ZZ gates between interacting qubits
       - γ parameter controls "how much" cost we apply
    
    3. MIXER LAYER: e^{-iβ H_M}
       - Mixes amplitudes between different solutions
       - Usually implemented as X rotations: Rx(2β)
       - β parameter controls exploration vs exploitation
    
    4. MEASUREMENT: Sample the quantum state
       - Collapse superposition to classical bitstring
       - Each bit indicates if that assignment is selected
    
    OPTIMIZATION LOOP:
    ==================
    
    ┌─────────────────────────────────────────────────────────────┐
    │  Classical Computer                                          │
    │  ┌──────────────────────────────────────────────────────┐   │
    │  │  1. Initialize parameters γ, β                        │   │
    │  │  2. Send to quantum computer                          │   │
    │  │  3. Receive measurement results                       │   │
    │  │  4. Compute expectation value ⟨H_C⟩                   │   │
    │  │  5. Update γ, β using optimizer (COBYLA/SPSA)        │   │
    │  │  6. Repeat until converged                            │   │
    │  └──────────────────────────────────────────────────────┘   │
    │                          ↕                                   │
    │  ┌──────────────────────────────────────────────────────┐   │
    │  │  Quantum Computer                                      │   │
    │  │  • Execute QAOA circuit with given γ, β               │   │
    │  │  • Measure and return bitstrings                       │   │
    │  └──────────────────────────────────────────────────────┘   │
    └─────────────────────────────────────────────────────────────┘
    
    WHY QAOA WORKS:
    ===============
    
    1. Cost layer "marks" good solutions with favorable phases
    2. Mixer layer allows transitions between solutions
    3. Interference amplifies good solutions, cancels bad ones
    4. With optimal γ, β, best solutions have highest probability
    
    ROOM ALLOCATION ENCODING:
    =========================
    
    For room allocation with C courses, R rooms, T time slots:
    - Need C × R × T qubits (one per possible assignment)
    - Qubit |1⟩ means that assignment is selected
    - Cost function penalizes:
      • Courses not scheduled exactly once
      • Room double-bookings  
      • Faculty conflicts
    """)


# ============================================================================
# MAIN EXECUTION
# ============================================================================
if __name__ == "__main__":
    print("""
    ╔══════════════════════════════════════════════════════════════╗
    ║   QAOA (Quantum Approximate Optimization Algorithm)          ║
    ║   Room Allocation using Qiskit                               ║
    ╚══════════════════════════════════════════════════════════════╝
    """)
    
    # Explain the algorithm
    explain_qaoa_circuit()
    
    print("\n" + "="*60)
    print("RUNNING QAOA ROOM ALLOCATION")
    print("="*60)
    
    # Create allocator with sample data
    allocator = create_sample_data()
    
    # Solve the problem
    result = allocator.solve(shots=1024, optimizer_maxiter=50)
    
    # Print the schedule
    allocator.print_schedule(result)
    
    # Print statistics
    print("\n" + "="*60)
    print("QAOA SOLUTION STATISTICS")
    print("="*60)
    print(f"  Status: {result['status']}")
    print(f"  Solve time: {result['solve_time_seconds']} seconds")
    print(f"  Qubits used: {result['statistics'].get('qubits', 'N/A')}")
    print(f"  QAOA layers (p): {result['statistics'].get('qaoa_layers', 'N/A')}")
    print(f"  Courses scheduled: {len(result['schedule'])}/{result['statistics']['courses']}")
    
    # Save result to JSON
    output_file = 'qaoa_schedule_result.json'
    with open(output_file, 'w') as f:
        json.dump(result, f, indent=2)
    print(f"\n  Results saved to: {output_file}")
