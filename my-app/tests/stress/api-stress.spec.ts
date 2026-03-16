import { test, expect } from "@playwright/test";
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

// ── Next.js API Stress Tests ──────────────────────────────────────────────────

test.describe("Next.js API Stress Tests", () => {
  test.setTimeout(120_000);
  const allMetrics: StressMetrics[] = [];

  for (const endpoint of NEXTJS_GET_ENDPOINTS) {
    for (const concurrency of TEST_CONFIG.STRESS_CONCURRENCY_LEVELS) {
      test(`[NEXT] ${endpoint} @ ${concurrency} concurrent`, async () => {
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

        // p95 should be under 15s, error rate under 50%
        expect(metrics.responseTime.p95).toBeLessThan(15_000);
        expect(parseFloat(metrics.errorRate)).toBeLessThan(50);
      });
    }
  }

  test.afterAll(() => {
    if (allMetrics.length > 0) {
      console.log("\n--- Next.js API Results ---");
      printMetricsTable(allMetrics);
    }
  });
});

// ── Python Backend Stress Tests ───────────────────────────────────────────────

test.describe("Python Backend Stress Tests", () => {
  test.setTimeout(120_000);
  const allMetrics: StressMetrics[] = [];

  for (const endpoint of BACKEND_GET_ENDPOINTS) {
    for (const concurrency of TEST_CONFIG.STRESS_CONCURRENCY_LEVELS) {
      test(`[PYTHON] ${endpoint} @ ${concurrency} concurrent`, async () => {
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

        expect(metrics.responseTime.p95).toBeLessThan(15_000);
        expect(parseFloat(metrics.errorRate)).toBeLessThan(50);
      });
    }
  }

  // Special test: POST /api/schedules/generate with empty data (expects 400/422)
  test("[PYTHON] POST /api/schedules/generate under load (5 concurrent)", async () => {
    const url = `${TEST_CONFIG.BACKEND_URL}/api/schedules/generate`;
    const payload = {
      schedule_name: "stress-test",
      semester: "1st Semester",
      academic_year: "2025-2026",
      sections_data: [],
      rooms_data: [],
      max_iterations: 10,
    };

    const results: RequestResult[] = [];
    const promises = Array.from({ length: 5 }, async () => {
      const start = performance.now();
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(TEST_CONFIG.REQUEST_TIMEOUT_MS),
        });
        return {
          url,
          method: "POST",
          statusCode: res.status,
          responseTimeMs: Math.round(performance.now() - start),
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          url,
          method: "POST",
          statusCode: 0,
          responseTimeMs: Math.round(performance.now() - start),
          error: message,
        };
      }
    });

    results.push(...(await Promise.all(promises)));
    const metrics = computeMetrics(
      results,
      "[PYTHON] POST /api/schedules/generate",
      5
    );
    allMetrics.push(metrics);

    // Server should respond (not crash) -- we expect 400/422 for empty data
    expect(results.every((r) => r.statusCode !== 0)).toBe(true);
  });

  test.afterAll(() => {
    if (allMetrics.length > 0) {
      console.log("\n--- Python Backend Results ---");
      printMetricsTable(allMetrics);
    }
  });
});
