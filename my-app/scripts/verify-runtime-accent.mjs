import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3001";
const TEST_COLOR = "#ff006e";

async function seed(page) {
  await page.addInitScript(([color]) => {
    const encode = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const nowSec = Math.floor(Date.now() / 1000);
    const payload = {
      aud: 'authenticated',
      exp: nowSec + 3600,
      iat: nowSec,
      sub: 'verify-admin',
      email: 'verify@admin.local',
      role: 'authenticated',
    };
    const fakeJwt = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;

    localStorage.setItem('admin-base-theme', 'light');
    localStorage.setItem('admin-light-icon-color', color);
    const now = new Date().toISOString();
    const session = {
      access_token: fakeJwt,
      refresh_token: 'verify-refresh',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: nowSec + 3600,
      user: {
        id: 'verify-admin',
        email: 'verify@admin.local',
        app_metadata: { role: 'admin' },
        user_metadata: { role: 'admin' },
        aud: 'authenticated',
      },
    };

    localStorage.setItem('admin-user', JSON.stringify({
      id: 'verify-admin',
      email: 'verify@admin.local',
      role: 'admin',
      is_admin: true,
      created_at: now,
      updated_at: now,
    }));
    localStorage.setItem('admin-session', JSON.stringify(session));
    localStorage.setItem('supabase.auth.token', JSON.stringify(session));
  }, [TEST_COLOR]);
}

async function probe(page, path, selector) {
  await seed(page);
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  const data = await page.evaluate((sel) => {
    const rgbToHex = (rgb) => {
      const m = String(rgb).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (!m) return null;
      return '#' + [m[1], m[2], m[3]].map(v => Number(v).toString(16).padStart(2, '0')).join('');
    };

    const root = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    const el = document.querySelector(sel);
    const elStyle = el ? getComputedStyle(el) : null;

    return {
      url: location.pathname,
      rootPrimary: root.getPropertyValue('--primary').trim(),
      bodyPrimary: body.getPropertyValue('--primary').trim(),
      rootRgb: root.getPropertyValue('--primary-rgb').trim(),
      bodyRgb: body.getPropertyValue('--primary-rgb').trim(),
      probeFound: !!el,
      probeBorder: elStyle ? (elStyle.borderColor || '') : '',
      probeBg: elStyle ? (elStyle.backgroundColor || '') : '',
      probeColor: elStyle ? (elStyle.color || '') : '',
      probeBorderHex: elStyle ? rgbToHex(elStyle.borderColor || '') : null,
      probeBgHex: elStyle ? rgbToHex(elStyle.backgroundColor || '') : null,
      probeColorHex: elStyle ? rgbToHex(elStyle.color || '') : null,
    };
  }, selector);

  return data;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results = [];
  results.push(await probe(page, '/LandingPages/LiveTimetable', '.liveContainer'));
  results.push(await probe(page, '/LandingPages/Rooms-Management/MapViewer', '.header'));

  await browser.close();
  console.log(JSON.stringify({ testColor: TEST_COLOR, results }, null, 2));
})();
