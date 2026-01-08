# Quantum-Inspired Room Allocation Algorithms

This folder contains four different algorithmic approaches to solve the room allocation/scheduling problem.

## 📁 Folder Structure

```
BACKENDS/
├── requirements.txt      # Python dependencies
├── README.md            # This file
├── compare_algorithms.py # Compare all algorithms
│
├── CP_SAT/              # Constraint Programming solver
│   └── room_allocation_cpsat.py
│
├── QAOA/                # Quantum Approximate Optimization
│   └── room_allocation_qaoa.py
│
├── QIA/                 # Quantum-Inspired Algorithm
│   └── room_allocation_qia.py
│
└── QUBO/                # Quadratic Unconstrained Binary Optimization
    └── room_allocation_qubo.py
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd BACKENDS
pip install -r requirements.txt
```

### 2. Run Individual Algorithms
```bash
# CP-SAT (Classical - Exact)
python CP_SAT/room_allocation_cpsat.py

# QAOA (Quantum)
python QAOA/room_allocation_qaoa.py

# QIA (Quantum-Inspired)
python QIA/room_allocation_qia.py

# QUBO (Hybrid)
python QUBO/room_allocation_qubo.py
```

### 3. Compare All Algorithms
```bash
python compare_algorithms.py
```

---

## 📚 Algorithm Overview

### 1. CP-SAT (Constraint Programming - SAT)
**Type:** Classical / Exact

**How it works:**
- Uses Google OR-Tools constraint programming solver
- Models the problem with binary variables and constraints
- Explores solution space using SAT solving + constraint propagation

**Best for:**
- Small to medium problems (< 1000 variables)
- When you need guaranteed optimal solutions
- Problems with many complex constraints

**Pros:**
- ✅ Guaranteed optimal solution
- ✅ Fast for medium problems
- ✅ Easy constraint modeling

**Cons:**
- ❌ Exponential worst-case
- ❌ May be slow for very large problems

---

### 2. QAOA (Quantum Approximate Optimization Algorithm)
**Type:** Quantum / Hybrid

**How it works:**
1. Encodes problem as a cost Hamiltonian
2. Creates quantum circuit with alternating layers:
   - Cost layer: Applies phase based on solution quality
   - Mixer layer: Explores solution space
3. Classical optimizer finds optimal parameters
4. Measures quantum state to get solution

**Circuit Structure:**
```
|0⟩ ─── H ───[Cost(γ)]───[Mixer(β)]─── ... ─── M
```

**Best for:**
- Demonstrating quantum algorithms
- Problems that map well to Ising/QUBO form
- When you have quantum hardware access

**Pros:**
- ✅ Potential quantum advantage (future)
- ✅ Works on NISQ devices
- ✅ Standard quantum optimization approach

**Cons:**
- ❌ Currently limited by qubit count
- ❌ Simulation is slow for many qubits
- ❌ Results are probabilistic

---

### 3. QIA (Quantum-Inspired Algorithm)
**Type:** Classical / Heuristic (simulating quantum)

**How it works:**
- Simulates quantum mechanics classically
- Solutions represented as probability amplitudes (α, β)
- Uses quantum-inspired operations:
  - **Superposition:** Population of candidate solutions
  - **Q-Gate Rotation:** Amplify good solutions
  - **Quantum Tunneling:** Escape local minima
  - **Measurement:** Collapse to binary solution

**Best for:**
- Large-scale problems
- When quantum hardware is unavailable
- Good balance of speed and quality

**Pros:**
- ✅ No quantum hardware needed
- ✅ Often faster than true quantum (current era)
- ✅ Scales to large problems
- ✅ Good exploration of solution space

**Cons:**
- ❌ No true quantum speedup
- ❌ Heuristic (not guaranteed optimal)
- ❌ Requires parameter tuning

---

### 4. QUBO (Quadratic Unconstrained Binary Optimization)
**Type:** Framework / Hybrid

**How it works:**
- Converts problem to standard QUBO form: `minimize x^T Q x`
- Constraints become penalty terms in Q matrix
- Can be solved by:
  - Simulated Annealing (classical)
  - Tabu Search (classical)
  - D-Wave Quantum Annealer
  - QAOA circuit

**QUBO Matrix:**
```
Q = | Linear terms (diagonal) |
    | Interaction terms (off-diagonal) |
```

**Best for:**
- Standardized problem representation
- Compatibility with quantum annealers (D-Wave)
- When you want multiple solver options

**Pros:**
- ✅ Universal format (many solvers)
- ✅ Can run on D-Wave quantum hardware
- ✅ Simulated annealing works well
- ✅ Can export for different platforms

**Cons:**
- ❌ Constraint penalties need tuning
- ❌ Q matrix can be large
- ❌ Not all problems map well

---

## 🔄 Algorithm Comparison

| Algorithm | Type | Speed | Optimality | Scalability | Quantum HW |
|-----------|------|-------|------------|-------------|------------|
| **CP-SAT** | Classical | ⭐⭐⭐ | Optimal | Medium | No |
| **QAOA** | Quantum | ⭐ | Approximate | Low* | Yes |
| **QIA** | Q-Inspired | ⭐⭐⭐⭐ | Approximate | High | No |
| **QUBO** | Hybrid | ⭐⭐⭐ | Approximate | High | Optional |

*QAOA scalability limited by current quantum hardware

---

## 📊 Problem Encoding

All algorithms encode the room allocation problem the same way:

**Variables:** 
```
x[c][r][t] = 1 if course c is assigned to room r at time t
```

**Constraints:**
1. Each course scheduled exactly once
2. No room double-booking
3. Room capacity ≥ course size
4. No faculty conflicts

**Objective:**
- Minimize wasted room capacity
- Maximize preference satisfaction

---

## 🎯 Choosing the Right Algorithm

| Scenario | Recommended Algorithm |
|----------|----------------------|
| Need exact optimal solution | **CP-SAT** |
| Large-scale scheduling | **QIA** or **QUBO** |
| Research/learning quantum | **QAOA** |
| D-Wave quantum annealer | **QUBO** |
| Fast approximate solution | **QIA** |
| Standard format needed | **QUBO** |

---

## 📖 Further Reading

- **CP-SAT:** [Google OR-Tools](https://developers.google.com/optimization)
- **QAOA:** [Original Paper](https://arxiv.org/abs/1411.4028)
- **QIA:** [Quantum-Inspired Evolutionary Algorithms](https://ieeexplore.ieee.org/document/1004404)
- **QUBO:** [D-Wave Documentation](https://docs.dwavesys.com/docs/latest/)
