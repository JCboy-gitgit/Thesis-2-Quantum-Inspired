export const TEST_CONFIG = {
  // Frontend URL
  BASE_URL: process.env.TEST_BASE_URL || "http://localhost:3000",

  // Python backend URL
  BACKEND_URL: process.env.TEST_BACKEND_URL || "http://localhost:8000",

  // Admin credentials
  ADMIN_EMAIL: process.env.TEST_ADMIN_EMAIL || "",
  ADMIN_PASSWORD: process.env.TEST_ADMIN_PASSWORD || "",

  // Faculty credentials
  FACULTY_EMAIL: process.env.TEST_FACULTY_EMAIL || "",
  FACULTY_PASSWORD: process.env.TEST_FACULTY_PASSWORD || "",

  // Stress test tuning
  STRESS_CONCURRENCY_LEVELS: [10, 50, 100] as const,
  STRESS_REQUESTS_PER_LEVEL: 50,
  REQUEST_TIMEOUT_MS: 30_000,
};
