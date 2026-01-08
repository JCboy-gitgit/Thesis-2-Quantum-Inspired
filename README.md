# QAOA MaxCut Demo (Qiskit)

This workspace includes a minimal, self-contained QAOA example for the MaxCut problem on a 4-node cycle graph.

## Files
- [qaoa_maxcut.py](qaoa_maxcut.py): single-layer (p=1) QAOA that searches a grid of angles, evaluates the MaxCut expectation, and samples an assignment.

## Prerequisites
- Python virtual environment is already configured for this workspace.
- Qiskit is installed in the workspace environment.

If you need to reinstall manually:

```powershell
# From the workspace root
& ".\.venv\Scripts\python.exe" -m pip install --upgrade pip
& ".\.venv\Scripts\python.exe" -m pip install qiskit
```

## Run
Execute the script from the workspace root:

```powershell
& ".\.venv\Scripts\python.exe" ".\qaoa_maxcut.py"
```

Expected output includes the best angles found, the most likely bitstring, and the resulting cut size (should be 4 for the provided ring graph).