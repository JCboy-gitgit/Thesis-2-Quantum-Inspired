"""
================================================================================
QIA (Quantum-Inspired Algorithm) Room Allocation Solver
================================================================================

WHAT IS QIA (Quantum-Inspired Algorithm)?
-----------------------------------------
Quantum-Inspired Algorithms are CLASSICAL algorithms that borrow concepts
from quantum computing to solve optimization problems efficiently.
They don't require quantum hardware but use quantum-like mechanics.

KEY QUANTUM CONCEPTS USED:
--------------------------
1. SUPERPOSITION: Solutions exist in multiple states simultaneously
   - Classical implementation: Population of candidate solutions
   - Each solution has an "amplitude" (probability weight)

2. QUANTUM TUNNELING: Escape local minima
   - Classical implementation: Probabilistic jumps to distant solutions
   - Allows exploration beyond immediate neighbors

3. INTERFERENCE: Good solutions amplify, bad solutions cancel
   - Classical implementation: Update probabilities based on fitness
   - Better solutions get higher selection probability

4. QUANTUM ANNEALING: Gradual reduction of quantum fluctuations
   - Classical implementation: Temperature-like parameter that decreases
   - Starts with exploration, ends with exploitation

HOW QIA WORKS FOR ROOM ALLOCATION:
----------------------------------
1. Initialize population with random/heuristic solutions
2. Evaluate fitness (how good each schedule is)
3. Apply quantum-inspired operations:
   - Q-gate rotation: Update probability amplitudes
   - Quantum crossover: Combine good solutions
   - Quantum mutation: Explore new solutions (tunneling)
4. Measure: Select solutions based on probabilities
5. Repeat until convergence

ADVANTAGES:
-----------
- No quantum hardware needed (runs on any computer)
- Often faster than true quantum for current problem sizes
- Can handle large-scale problems
- Deterministic debugging possible

DISADVANTAGES:
--------------
- No true quantum speedup
- Heuristic, not guaranteed optimal
- Requires careful parameter tuning

================================================================================
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field
import json
import time
import random
import math


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


@dataclass
class QuantumIndividual:
    """
    Represents a quantum-inspired individual (solution).
    
    Uses quantum-inspired probability representation:
    - alpha[i]: Probability amplitude for x_i = 0
    - beta[i]: Probability amplitude for x_i = 1
    
    Constraint: |alpha|^2 + |beta|^2 = 1 for each qubit
    """
    n_qubits: int
    alpha: np.ndarray = field(default=None)  # Amplitudes for |0⟩
    beta: np.ndarray = field(default=None)   # Amplitudes for |1⟩
    fitness: float = 0.0
    solution: np.ndarray = field(default=None)  # Collapsed binary solution
    
    def __post_init__(self):
        if self.alpha is None:
            # Initialize in equal superposition
            self.alpha = np.ones(self.n_qubits) / np.sqrt(2)
            self.beta = np.ones(self.n_qubits) / np.sqrt(2)
        if self.solution is None:
            self.solution = np.zeros(self.n_qubits, dtype=int)
    
    def observe(self) -> np.ndarray:
        """
        Quantum-inspired measurement: Collapse superposition to binary values.
        
        Each qubit collapses to:
        - 0 with probability |alpha|^2
        - 1 with probability |beta|^2
        """
        probabilities = self.beta ** 2  # P(x_i = 1)
        random_values = np.random.random(self.n_qubits)
        self.solution = (random_values < probabilities).astype(int)
        return self.solution
    
    def rotate_qubits(self, best_solution: np.ndarray, rotation_angle: float):
        """
        Quantum-inspired rotation gate (Q-gate).
        
        Rotates probability amplitudes towards the best known solution.
        This is analogous to Grover's algorithm amplitude amplification.
        
        Args:
            best_solution: The best solution found so far
            rotation_angle: How much to rotate (in radians)
        """
        for i in range(self.n_qubits):
            # Determine rotation direction based on comparison with best
            if best_solution[i] == 1 and self.solution[i] == 0:
                # Need to increase probability of 1
                delta_theta = rotation_angle
            elif best_solution[i] == 0 and self.solution[i] == 1:
                # Need to decrease probability of 1
                delta_theta = -rotation_angle
            else:
                # Already aligned, small random perturbation
                delta_theta = rotation_angle * 0.1 * (random.random() - 0.5)
            
            # Rotation matrix:
            # [cos(θ)  -sin(θ)] [α]   [α']
            # [sin(θ)   cos(θ)] [β] = [β']
            cos_theta = np.cos(delta_theta)
            sin_theta = np.sin(delta_theta)
            
            new_alpha = cos_theta * self.alpha[i] - sin_theta * self.beta[i]
            new_beta = sin_theta * self.alpha[i] + cos_theta * self.beta[i]
            
            # Normalize to ensure |α|^2 + |β|^2 = 1
            norm = np.sqrt(new_alpha**2 + new_beta**2)
            self.alpha[i] = new_alpha / norm
            self.beta[i] = new_beta / norm
    
    def quantum_mutation(self, mutation_rate: float):
        """
        Quantum-inspired mutation (analogous to quantum tunneling).
        
        Allows escaping local minima by random amplitude perturbations.
        """
        for i in range(self.n_qubits):
            if random.random() < mutation_rate:
                # Random rotation (tunneling effect)
                random_angle = random.uniform(-np.pi/4, np.pi/4)
                
                cos_theta = np.cos(random_angle)
                sin_theta = np.sin(random_angle)
                
                new_alpha = cos_theta * self.alpha[i] - sin_theta * self.beta[i]
                new_beta = sin_theta * self.alpha[i] + cos_theta * self.beta[i]
                
                norm = np.sqrt(new_alpha**2 + new_beta**2)
                self.alpha[i] = new_alpha / norm
                self.beta[i] = new_beta / norm


class QIARoomAllocator:
    """
    Room Allocation using Quantum-Inspired Algorithm.
    
    Combines:
    - Quantum-inspired evolutionary algorithm (QIEA)
    - Simulated quantum annealing
    - Amplitude amplification heuristics
    """
    
    def __init__(self, population_size: int = 50, max_generations: int = 200):
        """
        Initialize QIA solver.
        
        Args:
            population_size: Number of quantum individuals
            max_generations: Maximum iterations
        """
        self.population_size = population_size
        self.max_generations = max_generations
        
        # Data containers
        self.courses: List[Course] = []
        self.rooms: List[Room] = []
        self.time_slots: List[TimeSlot] = []
        
        # Variable mapping
        self.var_map = {}
        self.reverse_map = {}
        
        # Population
        self.population: List[QuantumIndividual] = []
        self.best_individual: QuantumIndividual = None
        self.best_fitness = float('-inf')
        
        # Statistics
        self.fitness_history = []
        self.solve_time = 0
    
    def add_course(self, course: Course):
        self.courses.append(course)
    
    def add_room(self, room: Room):
        self.rooms.append(room)
    
    def add_time_slot(self, time_slot: TimeSlot):
        self.time_slots.append(time_slot)
    
    def _build_variable_mapping(self):
        """Create mapping between variable indices and assignments."""
        var_idx = 0
        for course in self.courses:
            for room in self.rooms:
                if room.capacity >= course.student_count:
                    for ts in self.time_slots:
                        self.var_map[var_idx] = (course.id, room.id, ts.id)
                        self.reverse_map[(course.id, room.id, ts.id)] = var_idx
                        var_idx += 1
        return var_idx
    
    def _calculate_fitness(self, solution: np.ndarray) -> float:
        """
        Calculate fitness of a solution (higher is better).
        
        Fitness = Reward - Penalties
        
        Rewards:
        - Each scheduled course: +100
        - Room capacity efficiency: +10 * (1 - waste_ratio)
        
        Penalties:
        - Unscheduled course: -1000
        - Room conflict: -500
        - Faculty conflict: -500
        - Over-scheduled course: -500
        """
        fitness = 0.0
        
        # Track assignments
        course_assignments = {c.id: 0 for c in self.courses}
        room_time_usage = {}  # (room_id, time_id) -> count
        faculty_time_usage = {}  # (faculty_id, time_id) -> count
        
        for i, val in enumerate(solution):
            if val == 1 and i in self.var_map:
                course_id, room_id, ts_id = self.var_map[i]
                
                # Track course assignment
                course_assignments[course_id] += 1
                
                # Track room-time usage
                rt_key = (room_id, ts_id)
                room_time_usage[rt_key] = room_time_usage.get(rt_key, 0) + 1
                
                # Track faculty-time usage
                course = next(c for c in self.courses if c.id == course_id)
                ft_key = (course.faculty_id, ts_id)
                faculty_time_usage[ft_key] = faculty_time_usage.get(ft_key, 0) + 1
                
                # Reward for scheduling
                fitness += 100
                
                # Reward for efficient room usage
                room = next(r for r in self.rooms if r.id == room_id)
                waste_ratio = (room.capacity - course.student_count) / room.capacity
                fitness += 10 * (1 - waste_ratio)
        
        # Penalty for unscheduled or over-scheduled courses
        for course_id, count in course_assignments.items():
            if count == 0:
                fitness -= 1000  # Not scheduled
            elif count > 1:
                fitness -= 500 * (count - 1)  # Over-scheduled
        
        # Penalty for room conflicts
        for rt_key, count in room_time_usage.items():
            if count > 1:
                fitness -= 500 * (count - 1)
        
        # Penalty for faculty conflicts
        for ft_key, count in faculty_time_usage.items():
            if count > 1:
                fitness -= 500 * (count - 1)
        
        return fitness
    
    def _initialize_population(self, n_qubits: int):
        """Initialize quantum population."""
        self.population = []
        for _ in range(self.population_size):
            individual = QuantumIndividual(n_qubits)
            self.population.append(individual)
    
    def _repair_solution(self, solution: np.ndarray) -> np.ndarray:
        """
        Repair an infeasible solution using greedy heuristics.
        
        Ensures each course is scheduled exactly once.
        """
        repaired = solution.copy()
        
        # For each course, ensure exactly one assignment
        for course in self.courses:
            # Find all variables for this course
            course_vars = []
            for i in range(len(solution)):
                if i in self.var_map and self.var_map[i][0] == course.id:
                    course_vars.append(i)
            
            # Count current assignments
            assigned = [i for i in course_vars if repaired[i] == 1]
            
            if len(assigned) == 0:
                # Not scheduled - assign to best available slot
                best_var = None
                best_score = float('-inf')
                
                for var_idx in course_vars:
                    _, room_id, ts_id = self.var_map[var_idx]
                    
                    # Check if slot is available
                    conflict = False
                    for other_var in range(len(repaired)):
                        if repaired[other_var] == 1 and other_var in self.var_map:
                            _, other_room, other_ts = self.var_map[other_var]
                            if other_room == room_id and other_ts == ts_id:
                                conflict = True
                                break
                    
                    if not conflict:
                        room = next(r for r in self.rooms if r.id == room_id)
                        score = -abs(room.capacity - course.student_count)
                        if score > best_score:
                            best_score = score
                            best_var = var_idx
                
                if best_var is not None:
                    repaired[best_var] = 1
                    
            elif len(assigned) > 1:
                # Over-scheduled - keep only the best assignment
                best_var = None
                best_score = float('-inf')
                
                for var_idx in assigned:
                    _, room_id, _ = self.var_map[var_idx]
                    room = next(r for r in self.rooms if r.id == room_id)
                    score = -abs(room.capacity - course.student_count)
                    if score > best_score:
                        best_score = score
                        best_var = var_idx
                
                # Remove all except best
                for var_idx in assigned:
                    if var_idx != best_var:
                        repaired[var_idx] = 0
        
        return repaired
    
    def solve(self, use_repair: bool = True) -> Dict:
        """
        Solve the room allocation problem using QIA.
        
        Args:
            use_repair: Whether to repair infeasible solutions
            
        Returns:
            Dictionary containing the solution and statistics
        """
        print("\n" + "="*60)
        print("QIA (Quantum-Inspired Algorithm) Room Allocator")
        print("="*60)
        
        start_time = time.time()
        
        # Build variable mapping
        n_qubits = self._build_variable_mapping()
        print(f"Problem size: {n_qubits} binary variables")
        
        # Initialize population
        self._initialize_population(n_qubits)
        print(f"Population size: {self.population_size}")
        print(f"Max generations: {self.max_generations}")
        
        # Initial observation and evaluation
        for individual in self.population:
            individual.observe()
            if use_repair:
                individual.solution = self._repair_solution(individual.solution)
            individual.fitness = self._calculate_fitness(individual.solution)
            
            if individual.fitness > self.best_fitness:
                self.best_fitness = individual.fitness
                self.best_individual = QuantumIndividual(n_qubits)
                self.best_individual.solution = individual.solution.copy()
                self.best_individual.fitness = individual.fitness
        
        print(f"\nStarting optimization...")
        print(f"Initial best fitness: {self.best_fitness:.2f}")
        
        # Main QIA loop
        for generation in range(self.max_generations):
            # Annealing schedule for rotation angle and mutation rate
            progress = generation / self.max_generations
            
            # Rotation angle: Start large, decrease (exploration -> exploitation)
            rotation_angle = 0.1 * np.pi * (1 - progress) + 0.01 * np.pi * progress
            
            # Mutation rate: Similar annealing
            mutation_rate = 0.3 * (1 - progress) + 0.05 * progress
            
            # Update each individual
            for individual in self.population:
                # Quantum rotation towards best solution
                individual.rotate_qubits(self.best_individual.solution, rotation_angle)
                
                # Quantum mutation (tunneling)
                individual.quantum_mutation(mutation_rate)
                
                # Observe (collapse) to get binary solution
                individual.observe()
                
                # Repair if needed
                if use_repair:
                    individual.solution = self._repair_solution(individual.solution)
                
                # Evaluate fitness
                individual.fitness = self._calculate_fitness(individual.solution)
                
                # Update global best
                if individual.fitness > self.best_fitness:
                    self.best_fitness = individual.fitness
                    self.best_individual.solution = individual.solution.copy()
                    self.best_individual.fitness = individual.fitness
            
            # Record history
            self.fitness_history.append(self.best_fitness)
            
            # Progress output
            if generation % 20 == 0 or generation == self.max_generations - 1:
                print(f"  Generation {generation}: Best fitness = {self.best_fitness:.2f}")
        
        self.solve_time = time.time() - start_time
        
        # Build result
        result = {
            'status': 'SUCCESS',
            'solve_time_seconds': round(self.solve_time, 3),
            'schedule': [],
            'statistics': {
                'courses': len(self.courses),
                'rooms': len(self.rooms),
                'time_slots': len(self.time_slots),
                'variables': n_qubits,
                'population_size': self.population_size,
                'generations': self.max_generations,
                'final_fitness': self.best_fitness
            }
        }
        
        # Extract schedule from best solution
        if self.best_individual is not None:
            for i, val in enumerate(self.best_individual.solution):
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
        
        print(f"\n✓ Optimization completed in {self.solve_time:.3f} seconds!")
        
        return result
    
    def print_schedule(self, result: Dict):
        """Pretty print the schedule"""
        print("\n" + "="*60)
        print("QIA GENERATED SCHEDULE")
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
    
    def plot_convergence(self, filename: str = 'qia_convergence.png'):
        """Plot the fitness convergence curve."""
        try:
            import matplotlib
            matplotlib.use('Agg')
            import matplotlib.pyplot as plt
            
            plt.figure(figsize=(10, 6))
            plt.plot(self.fitness_history, 'b-', linewidth=2)
            plt.xlabel('Generation', fontsize=12)
            plt.ylabel('Best Fitness', fontsize=12)
            plt.title('QIA Convergence Curve', fontsize=14)
            plt.grid(True, alpha=0.3)
            plt.savefig(filename, dpi=150, bbox_inches='tight')
            plt.close()
            print(f"Convergence plot saved to: {filename}")
        except ImportError:
            print("Matplotlib not available for plotting")


def create_sample_data() -> QIARoomAllocator:
    """Create sample data for testing"""
    allocator = QIARoomAllocator(population_size=30, max_generations=100)
    
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
    ║   QIA (Quantum-Inspired Algorithm) Room Allocator            ║
    ║   Classical algorithm with quantum-inspired mechanics         ║
    ╚══════════════════════════════════════════════════════════════╝
    
    This algorithm uses QUANTUM-INSPIRED techniques:
    
    QUANTUM CONCEPTS SIMULATED:
    ===========================
    
    1. SUPERPOSITION
       - Solutions represented as probability amplitudes
       - Each variable has (α, β) where |α|² + |β|² = 1
       - α² = P(x=0), β² = P(x=1)
    
    2. QUANTUM ROTATION (Q-Gate)
       - Rotates probability amplitudes towards best solution
       - Analogous to Grover's amplitude amplification
       - [cos(θ)  -sin(θ)] [α]   [α']
         [sin(θ)   cos(θ)] [β] = [β']
    
    3. QUANTUM TUNNELING (Mutation)
       - Random rotations allow escaping local minima
       - Probability of "tunneling" decreases over time
    
    4. MEASUREMENT (Observation)
       - Collapse superposition to binary solution
       - Sample based on probability amplitudes
    
    5. QUANTUM ANNEALING
       - Parameters decrease over generations
       - Starts exploratory, becomes exploitative
    """)
    
    # Create allocator with sample data
    allocator = create_sample_data()
    
    # Solve the problem
    result = allocator.solve(use_repair=True)
    
    # Print the schedule
    allocator.print_schedule(result)
    
    # Plot convergence
    allocator.plot_convergence()
    
    # Print statistics
    print("\n" + "="*60)
    print("QIA SOLUTION STATISTICS")
    print("="*60)
    print(f"  Status: {result['status']}")
    print(f"  Solve time: {result['solve_time_seconds']} seconds")
    print(f"  Population size: {result['statistics']['population_size']}")
    print(f"  Generations: {result['statistics']['generations']}")
    print(f"  Final fitness: {result['statistics']['final_fitness']:.2f}")
    print(f"  Courses scheduled: {len(result['schedule'])}/{result['statistics']['courses']}")
    
    # Save result to JSON
    output_file = 'qia_schedule_result.json'
    with open(output_file, 'w') as f:
        json.dump(result, f, indent=2)
    print(f"\n  Results saved to: {output_file}")
