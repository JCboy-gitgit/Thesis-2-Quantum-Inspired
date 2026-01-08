import math
from typing import List, Tuple

import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector, Pauli


def qaoa_ansatz(n_qubits: int, edges: List[Tuple[int, int]], gamma: float, beta: float) -> QuantumCircuit:
    """Construct a single-layer (p=1) QAOA ansatz for MaxCut.

    - Start in uniform superposition with H on all qubits
    - Cost layer: for each edge, apply ZZ rotation with angle 2*gamma
    - Mixer layer: apply RX rotations with angle 2*beta on all qubits
    """
    qc = QuantumCircuit(n_qubits)

    # Initial state |+>^n
    for q in range(n_qubits):
        qc.h(q)

    # Cost layer using rzz(2*gamma) per edge (global phase from I term ignored)
    for (i, j) in edges:
        qc.rzz(2.0 * gamma, i, j)

    # Mixer layer
    for q in range(n_qubits):
        qc.rx(2.0 * beta, q)

    return qc


def cut_size(bitstring: str, edges: List[Tuple[int, int]]) -> int:
    """Compute cut size for a bitstring assignment across edges."""
    return sum(1 for i, j in edges if bitstring[i] != bitstring[j])


def maxcut_expectation_from_state(state: Statevector, edges: List[Tuple[int, int]]) -> float:
    """Compute expectation of MaxCut cost H_C = sum_{(i,j)} (I - Z_i Z_j)/2 from a statevector."""
    n_qubits = int(math.log2(state.dim))
    val = 0.0
    for (i, j) in edges:
        # +1/2 * I contributes 1/2
        term = 0.5
        # -1/2 * Z_i Z_j expectation
        pauli_str = ["I"] * n_qubits
        pauli_str[i] = "Z"
        pauli_str[j] = "Z"
        zzij = Pauli("".join(pauli_str))
        term -= 0.5 * float(state.expectation_value(zzij).real)
        val += term
    return val


def run_qaoa_maxcut(n_qubits: int, edges: List[Tuple[int, int]], grid_points: int = 21):
    """Run a simple grid-search QAOA for MaxCut with p=1 using Statevector.

    - Searches beta in [0, pi], gamma in [0, pi]
    - Evaluates expectation of MaxCut cost via statevector expectations
    - Returns best angles and a sampled bitstring with its cut size
    """
    betas = np.linspace(0.0, math.pi, grid_points)
    gammas = np.linspace(0.0, math.pi, grid_points)

    best_val = -1.0
    best_beta = None
    best_gamma = None

    for beta in betas:
        for gamma in gammas:
            qc = qaoa_ansatz(n_qubits, edges, gamma, beta)
            state = Statevector.from_instruction(qc)
            val = maxcut_expectation_from_state(state, edges)
            if val > best_val:
                best_val = val
                best_beta = beta
                best_gamma = gamma

    # Build circuit for best parameters and sample a bitstring from the statevector
    qc_best = qaoa_ansatz(n_qubits, edges, best_gamma, best_beta)
    state_best = Statevector.from_instruction(qc_best)
    counts = state_best.sample_counts(shots=4096)

    # Pick most probable bitstring (convert dict keys to strings if needed)
    best_bitstring = max(counts.items(), key=lambda kv: kv[1])[0]
    if isinstance(best_bitstring, tuple):
        best_bitstring = "".join(str(int(b)) for b in best_bitstring)
    best_cut = cut_size(best_bitstring, edges)

    print("QAOA MaxCut (p=1) on graph with", n_qubits, "nodes")
    print("Edges:", edges)
    print(f"Best expectation value: {best_val:.4f}")
    print(f"Best angles: beta={best_beta:.4f}, gamma={best_gamma:.4f}")
    print("Most likely assignment:", best_bitstring)
    print("Cut size:", best_cut)


if __name__ == "__main__":
    # Example: 4-node ring (cycle) graph — optimal cut is 4 with alternating bits
    n = 4
    E = [(0, 1), (1, 2), (2, 3), (3, 0)]
    run_qaoa_maxcut(n, E, grid_points=21)

# Quick run; from you rworkspace root, run: & ".\.venv\Scripts\python.exe" ".\qaoa_maxcut.py"
