# QIA Room Allocation - Stress Test Suite

## Prerequisites

1. **Playwright browser installed:**
   ```bash
   npx playwright install chromium
   ```

2. **Environment variables** (set before running tests):

   | Variable | Required For | Description |
   |----------|-------------|-------------|
   | `TEST_BASE_URL` | All tests | Next.js URL (default: `http://localhost:3000`) |
   | `TEST_BACKEND_URL` | Stress tests | Python backend URL (default: `http://localhost:8000`) |
   | `TEST_ADMIN_EMAIL` | Admin E2E tests | Admin account email |
   | `TEST_ADMIN_PASSWORD` | Admin E2E tests | Admin account password |
   | `TEST_FACULTY_EMAIL` | Faculty E2E tests | Faculty account email |
   | `TEST_FACULTY_PASSWORD` | Faculty E2E tests | Faculty account password |

---

## Running Tests

All commands run from the `my-app/` directory.

### Run Everything
```bash
TEST_ADMIN_EMAIL=admin@school.edu TEST_ADMIN_PASSWORD=secret123 TEST_FACULTY_EMAIL=faculty@school.edu TEST_FACULTY_PASSWORD=faculty123 npm run test:all
```

### E2E Tests Only

**Login page** (no credentials needed):
```bash
npm run test:e2e:login
```

**Admin pages** (19 pages):
```bash
TEST_ADMIN_EMAIL=admin@school.edu TEST_ADMIN_PASSWORD=secret123 npm run test:e2e:admin
```

**Faculty pages** (10 pages):
```bash
TEST_FACULTY_EMAIL=faculty@school.edu TEST_FACULTY_PASSWORD=faculty123 npm run test:e2e:faculty
```

**All E2E tests:**
```bash
TEST_ADMIN_EMAIL=admin@school.edu TEST_ADMIN_PASSWORD=secret123 TEST_FACULTY_EMAIL=faculty@school.edu TEST_FACULTY_PASSWORD=faculty123 npm run test:e2e
```

### API Stress Tests Only

**Via Playwright** (with HTML report):
```bash
npm run test:stress
```

**Standalone script** (no browser, console output only):
```bash
npm run test:stress:standalone
```

### Against Production

```bash
TEST_BASE_URL=https://qia-room-allocation.vercel.app TEST_BACKEND_URL=https://thesis-2-quantum-inspired.onrender.com TEST_ADMIN_EMAIL=admin@school.edu TEST_ADMIN_PASSWORD=secret123 TEST_FACULTY_EMAIL=faculty@school.edu TEST_FACULTY_PASSWORD=faculty123 npm run test:all
```

---

## Viewing Results

**HTML report** (opens in browser after a test run):
```bash
npm run test:report
```

**Stress test console output** looks like this:
```
==============================================================================================================
  STRESS TEST RESULTS
==============================================================================================================
  Endpoint                                  Conc  Total  OK    Fail  Err%     Avg(ms)   P95(ms)   P99(ms)   Max(ms)
  ----------------------------------------------------------------------------------------------------------
  [NEXT] /api/colleges                      10    50     50    0     0.00%    142       287       312       350
  [NEXT] /api/colleges                      50    50     48    2     4.00%    523       1204      1350      1502
  [PYTHON] /health                          10    50     50    0     0.00%    45        89        102       115
==============================================================================================================
```

---

## What's Tested

| Test File | Tests | What It Covers |
|-----------|-------|----------------|
| `e2e/login.spec.ts` | 5 | Login form render, validation, wrong credentials, signup tab, password toggle |
| `e2e/admin-pages.spec.ts` | 19 | Every admin page loads correctly after login |
| `e2e/faculty-pages.spec.ts` | 10 | Every faculty page loads correctly after login |
| `stress/api-stress.spec.ts` | 90+ | All API endpoints hit with 10/50/100 concurrent requests |
| `stress/run-stress.ts` | -- | Standalone script, same API stress without Playwright |

**Total: ~122 test cases**

### API Endpoints Tested (Stress)

**Next.js API (19 endpoints):**
`/api/colleges`, `/api/departments`, `/api/rooms-list`, `/api/faculty-list`, `/api/alerts`, `/api/presence`, `/api/room-features`, `/api/floor-plans`, `/api/live-timetable`, `/api/schedule-lock`, `/api/schedule-requests`, `/api/profile-change-requests`, `/api/faculty-absences`, `/api/faculty-default-schedule`, `/api/faculty-registration`, `/api/room-allocation`, `/api/room-allocation/rooms`, `/api/room-allocation/sections`, `/api/room-allocation/analytics`

**Python Backend (10 endpoints):**
`/`, `/health`, `/api/rooms`, `/api/sections`, `/api/teachers`, `/api/time-slots`, `/api/schedules`, `/api/generated-schedules`, `/api/analytics/room-utilization`, `/api/analytics/summary`

---

## File Structure

```
tests/
├── config/
│   ├── env.ts              # Environment config (URLs, credentials, tuning)
│   └── constants.ts        # All page paths and API endpoint lists
├── helpers/
│   ├── auth.ts             # loginAsAdmin() and loginAsFaculty() helpers
│   └── metrics.ts          # Latency stats calculator and table printer
├── e2e/
│   ├── login.spec.ts       # Login page E2E tests
│   ├── admin-pages.spec.ts # Admin dashboard E2E tests
│   └── faculty-pages.spec.ts # Faculty portal E2E tests
├── stress/
│   ├── api-stress.spec.ts  # API stress tests (Playwright runner)
│   └── run-stress.ts       # Standalone API stress script
└── HOW-TO-RUN.md           # This file
```

## Tuning

Edit `tests/config/env.ts` to adjust:
- `STRESS_CONCURRENCY_LEVELS` — default `[10, 50, 100]`
- `STRESS_REQUESTS_PER_LEVEL` — default `50` requests per concurrency level
- `REQUEST_TIMEOUT_MS` — default `30000` (30 seconds)
