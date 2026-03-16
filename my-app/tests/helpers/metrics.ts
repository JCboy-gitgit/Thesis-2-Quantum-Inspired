export interface RequestResult {
  url: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  error?: string;
}

export interface StressMetrics {
  endpoint: string;
  concurrency: number;
  totalRequests: number;
  successCount: number;
  failCount: number;
  errorRate: string;
  responseTime: {
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
  };
  statusCodes: Record<number, number>;
}

export function computeMetrics(
  results: RequestResult[],
  endpoint: string,
  concurrency: number
): StressMetrics {
  const times = results.map((r) => r.responseTimeMs).sort((a, b) => a - b);
  const successes = results.filter(
    (r) => r.statusCode >= 200 && r.statusCode < 400
  );
  const failures = results.filter((r) => r.statusCode >= 400 || r.error);

  const statusCodes: Record<number, number> = {};
  for (const r of results) {
    statusCodes[r.statusCode] = (statusCodes[r.statusCode] || 0) + 1;
  }

  return {
    endpoint,
    concurrency,
    totalRequests: results.length,
    successCount: successes.length,
    failCount: failures.length,
    errorRate: `${((failures.length / results.length) * 100).toFixed(2)}%`,
    responseTime: {
      min: times[0] || 0,
      max: times[times.length - 1] || 0,
      avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      p95: times[Math.floor(times.length * 0.95)] || 0,
      p99: times[Math.floor(times.length * 0.99)] || 0,
    },
    statusCodes,
  };
}

export function printMetricsTable(metrics: StressMetrics[]): void {
  console.log("\n" + "=".repeat(110));
  console.log("  STRESS TEST RESULTS");
  console.log("=".repeat(110));
  console.log(
    "  " +
      "Endpoint".padEnd(42) +
      "Conc".padEnd(6) +
      "Total".padEnd(7) +
      "OK".padEnd(6) +
      "Fail".padEnd(6) +
      "Err%".padEnd(9) +
      "Avg(ms)".padEnd(10) +
      "P95(ms)".padEnd(10) +
      "P99(ms)".padEnd(10) +
      "Max(ms)"
  );
  console.log("  " + "-".repeat(106));

  for (const m of metrics) {
    console.log(
      "  " +
        m.endpoint.substring(0, 40).padEnd(42) +
        String(m.concurrency).padEnd(6) +
        String(m.totalRequests).padEnd(7) +
        String(m.successCount).padEnd(6) +
        String(m.failCount).padEnd(6) +
        m.errorRate.padEnd(9) +
        String(m.responseTime.avg).padEnd(10) +
        String(m.responseTime.p95).padEnd(10) +
        String(m.responseTime.p99).padEnd(10) +
        String(m.responseTime.max)
    );
  }
  console.log("=".repeat(110) + "\n");
}
