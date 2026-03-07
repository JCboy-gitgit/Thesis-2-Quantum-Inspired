#!/usr/bin/env python3
"""Run a repeatable two-profile benchmark for scheduler_v2 using a JSON payload."""

from __future__ import annotations

import argparse
import copy
import json
import statistics
import time
from pathlib import Path
from typing import Any, Dict, List

from scheduler_v2 import run_enhanced_scheduler


def _run_once(payload: Dict[str, Any], iterations: int, trials: int) -> Dict[str, Any]:
    """Run N trials and aggregate key scheduler metrics."""
    times_ms: List[float] = []
    rows: List[Dict[str, Any]] = []

    for _ in range(trials):
        run_payload = copy.deepcopy(payload)
        config = dict(run_payload.get("config") or {})
        config["max_iterations"] = iterations
        run_payload["config"] = config

        start = time.perf_counter()
        result = run_enhanced_scheduler(
            sections_data=run_payload.get("sections_data") or [],
            rooms_data=run_payload.get("rooms_data") or [],
            time_slots_data=run_payload.get("time_slots"),
            config=run_payload.get("config") or {},
            online_days=run_payload.get("online_days") or [],
            faculty_profiles_data=run_payload.get("faculty_profiles_data"),
            fixed_allocations=run_payload.get("fixed_allocations"),
        )
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        times_ms.append(elapsed_ms)
        rows.append(result)

    last = rows[-1] if rows else {}
    optimization_stats = last.get("optimization_stats") or {}

    return {
        "iterations_requested": iterations,
        "trials": trials,
        "avg_wall_time_ms": round(statistics.mean(times_ms), 2) if times_ms else 0.0,
        "min_wall_time_ms": round(min(times_ms), 2) if times_ms else 0.0,
        "max_wall_time_ms": round(max(times_ms), 2) if times_ms else 0.0,
        "reported_time_elapsed_ms": optimization_stats.get("time_elapsed_ms", 0),
        "success": bool(last.get("success", False)),
        "success_rate": float(last.get("success_rate", 0.0)),
        "scheduled_sections": int(last.get("scheduled_sections", 0)),
        "unscheduled_sections": int(last.get("unscheduled_sections", 0)),
        "conflict_count": int(optimization_stats.get("conflict_count", 0)),
        "initial_cost": float(optimization_stats.get("initial_cost", 0.0)),
        "final_cost": float(optimization_stats.get("final_cost", 0.0)),
        "iterations_used": int(optimization_stats.get("iterations", 0)),
        "improvements": int(optimization_stats.get("improvements", 0)),
        "quantum_tunnels": int(optimization_stats.get("quantum_tunnels", 0)),
        "block_swaps": int(optimization_stats.get("block_swaps", 0)),
    }


def _print_profile(name: str, row: Dict[str, Any]) -> None:
    print(f"\n[{name}]")
    print(f"  iterations_requested: {row['iterations_requested']}")
    print(f"  trials: {row['trials']}")
    print(f"  avg_wall_time_ms: {row['avg_wall_time_ms']}")
    print(f"  min_wall_time_ms: {row['min_wall_time_ms']}")
    print(f"  max_wall_time_ms: {row['max_wall_time_ms']}")
    print(f"  reported_time_elapsed_ms: {row['reported_time_elapsed_ms']}")
    print(f"  success: {row['success']}")
    print(f"  success_rate: {row['success_rate']}")
    print(f"  scheduled_sections: {row['scheduled_sections']}")
    print(f"  unscheduled_sections: {row['unscheduled_sections']}")
    print(f"  conflict_count: {row['conflict_count']}")
    print(f"  initial_cost: {row['initial_cost']}")
    print(f"  final_cost: {row['final_cost']}")
    print(f"  iterations_used: {row['iterations_used']}")
    print(f"  improvements: {row['improvements']}")
    print(f"  quantum_tunnels: {row['quantum_tunnels']}")
    print(f"  block_swaps: {row['block_swaps']}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark scheduler_v2 on one payload with two iteration profiles")
    parser.add_argument("--payload", required=True, help="Path to benchmark payload JSON")
    parser.add_argument("--baseline-iterations", type=int, default=1500, help="Baseline max_iterations")
    parser.add_argument("--optimized-iterations", type=int, default=6000, help="Optimized max_iterations")
    parser.add_argument("--trials", type=int, default=2, help="Trials per profile")
    parser.add_argument("--output", help="Optional path to write JSON report")
    args = parser.parse_args()

    payload_path = Path(args.payload)
    payload = json.loads(payload_path.read_text(encoding="utf-8"))

    baseline = _run_once(payload, args.baseline_iterations, args.trials)
    optimized = _run_once(payload, args.optimized_iterations, args.trials)

    summary = {
        "payload": str(payload_path),
        "baseline": baseline,
        "optimized": optimized,
        "delta": {
            "avg_wall_time_ms": round(optimized["avg_wall_time_ms"] - baseline["avg_wall_time_ms"], 2),
            "reported_time_elapsed_ms": optimized["reported_time_elapsed_ms"] - baseline["reported_time_elapsed_ms"],
            "success_rate": round(optimized["success_rate"] - baseline["success_rate"], 4),
            "unscheduled_sections": optimized["unscheduled_sections"] - baseline["unscheduled_sections"],
            "conflict_count": optimized["conflict_count"] - baseline["conflict_count"],
            "final_cost": round(optimized["final_cost"] - baseline["final_cost"], 4),
        },
    }

    print("\n=== Scheduler Benchmark Summary ===")
    _print_profile("baseline", baseline)
    _print_profile("optimized", optimized)
    print("\n[delta optimized-baseline]")
    for key, value in summary["delta"].items():
        print(f"  {key}: {value}")

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
        print(f"\nSaved benchmark report to: {output_path}")


if __name__ == "__main__":
    main()
