/**
 * Standalone stress test script - runs without Playwright browser.
 * Usage:
 *   npx tsx tests/stress/run-stress.ts
 *
 * Environment variables:
 *   TEST_BASE_URL      - Next.js frontend URL (default: http://localhost:3000)
 *   TEST_BACKEND_URL   - Python backend URL (default: http://localhost:8000)
 */

import { TEST_CONFIG } from "../config/env";
import {
  NEXTJS_GET_ENDPOINTS,
  BACKEND_GET_ENDPOINTS,
} from "../config/constants";
import {
  RequestResult,
  StressMetrics,
  computeMetrics,
  printMetricsTable,
} from "../helpers/metrics";

async function fireRequests(
  baseUrl: string,
  endpoint: string,
  concurrency: number,
  totalRequests: number
): Promise<RequestResult[]> {
  const results: RequestResult[] = [];
  const url = `${baseUrl}${endpoint}`;

  for (let batch = 0; batch < totalRequests; batch += concurrency) {
    const batchSize = Math.min(concurrency, totalRequests - batch);
    const promises = Array.from({ length: batchSize }, async () => {
      const start = performance.now();
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { "Cache-Control": "no-cache" },
          signal: AbortSignal.timeout(TEST_CONFIG.REQUEST_TIMEOUT_MS),
        });
        return {
          url,
          method: "GET",
          statusCode: res.status,
          responseTimeMs: Math.round(performance.now() - start),
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          url,
          method: "GET",
          statusCode: 0,
          responseTimeMs: Math.round(performance.now() - start),
          error: message,
        };
      }
    });
    results.push(...(await Promise.all(promises)));
  }
  return results;
}

async function main() {
  const allMetrics: StressMetrics[] = [];

  console.log("=".repeat(60));
  console.log("  QIA Room Allocation - Standalone Stress Test");
  console.log("=".repeat(60));
  console.log(`  Frontend:    ${TEST_CONFIG.BASE_URL}`);
  console.log(`  Backend:     ${TEST_CONFIG.BACKEND_URL}`);
  console.log(
    `  Concurrency: ${TEST_CONFIG.STRESS_CONCURRENCY_LEVELS.join(", ")}`
  );
  console.log(
    `  Requests/level: ${TEST_CONFIG.STRESS_REQUESTS_PER_LEVEL}`
  );
  console.log("");

  // Phase 1: Next.js API routes
  console.log("--- Phase 1: Next.js API Routes ---");
  for (const endpoint of NEXTJS_GET_ENDPOINTS) {
    for (const concurrency of TEST_CONFIG.STRESS_CONCURRENCY_LEVELS) {
      process.stdout.write(
        `  Testing ${endpoint} @ ${concurrency} concurrent... `
      );
      const results = await fireRequests(
        TEST_CONFIG.BASE_URL,
        endpoint,
        concurrency,
        TEST_CONFIG.STRESS_REQUESTS_PER_LEVEL
      );
      const metrics = computeMetrics(
        results,
        `[NEXT] ${endpoint}`,
        concurrency
      );
      allMetrics.push(metrics);
      console.log(
        `avg=${metrics.responseTime.avg}ms p95=${metrics.responseTime.p95}ms err=${metrics.errorRate}`
      );
    }
  }

  // Phase 2: Python backend
  console.log("\n--- Phase 2: Python Backend ---");
  for (const endpoint of BACKEND_GET_ENDPOINTS) {
    for (const concurrency of TEST_CONFIG.STRESS_CONCURRENCY_LEVELS) {
      process.stdout.write(
        `  Testing ${endpoint} @ ${concurrency} concurrent... `
      );
      const results = await fireRequests(
        TEST_CONFIG.BACKEND_URL,
        endpoint,
        concurrency,
        TEST_CONFIG.STRESS_REQUESTS_PER_LEVEL
      );
      const metrics = computeMetrics(
        results,
        `[PYTHON] ${endpoint}`,
        concurrency
      );
      allMetrics.push(metrics);
      console.log(
        `avg=${metrics.responseTime.avg}ms p95=${metrics.responseTime.p95}ms err=${metrics.errorRate}`
      );
    }
  }

  // Final report
  printMetricsTable(allMetrics);

  // Summary
  const totalTests = allMetrics.length;
  const passedTests = allMetrics.filter(
    (m) => parseFloat(m.errorRate) < 50
  ).length;
  const failedTests = totalTests - passedTests;

  console.log(
    `  Summary: ${passedTests}/${totalTests} passed, ${failedTests} failed (>50% error rate)`
  );

  const hasHighErrors = allMetrics.some(
    (m) => parseFloat(m.errorRate) > 50
  );
  process.exit(hasHighErrors ? 1 : 0);
}

main().catch((err) => {
  console.error("Stress test failed:", err);
  process.exit(1);
});
