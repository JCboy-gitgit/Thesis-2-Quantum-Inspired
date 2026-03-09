import { chromium } from 'playwright'
import path from 'node:path'

const baseUrl = 'http://localhost:3000'
const outputDir = path.resolve('public', 'landing')

const adminEmail = process.env.SCREENSHOT_ADMIN_EMAIL
const adminPassword = process.env.SCREENSHOT_ADMIN_PASSWORD
const facultyEmail = process.env.SCREENSHOT_FACULTY_EMAIL
const facultyPassword = process.env.SCREENSHOT_FACULTY_PASSWORD

if (!adminEmail || !adminPassword || !facultyEmail || !facultyPassword) {
  throw new Error('Missing screenshot credentials in environment variables.')
}

async function login(page, email, password) {
  await page.goto(`${baseUrl}/?auth=1&tab=login`, { waitUntil: 'domcontentloaded' })

  await page.locator('input[type="email"]').first().fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  await page.locator('input[type="password"]').first().press('Enter')
}

async function captureAdmin(context) {
  const page = await context.newPage()
  await login(page, adminEmail, adminPassword)

  await page.waitForURL('**/LandingPages/Home', { timeout: 30000 })
  await page.screenshot({ path: path.join(outputDir, 'admin-home.png'), fullPage: true })

  await page.goto(`${baseUrl}/LandingPages/RoomSchedule/ViewSchedule`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: path.join(outputDir, 'admin-view-schedule.png'), fullPage: true })

  await page.goto(`${baseUrl}/LandingPages/LiveTimetable`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: path.join(outputDir, 'admin-live-timetable.png'), fullPage: true })
}

async function captureFaculty(context) {
  const page = await context.newPage()
  await login(page, facultyEmail, facultyPassword)

  await page.waitForURL('**/faculty/home', { timeout: 30000 })
  await page.screenshot({ path: path.join(outputDir, 'faculty-home.png'), fullPage: true })

  await page.goto(`${baseUrl}/faculty/view`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: path.join(outputDir, 'faculty-view.png'), fullPage: true })
}

async function main() {
  const browser = await chromium.launch({ headless: true })

  try {
    const adminContext = await browser.newContext({ viewport: { width: 1600, height: 900 } })
    await captureAdmin(adminContext)
    await adminContext.close()

    const facultyContext = await browser.newContext({ viewport: { width: 1600, height: 900 } })
    await captureFaculty(facultyContext)
    await facultyContext.close()

    console.log('Screenshots captured successfully in public/landing')
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error('Screenshot capture failed:', error)
  process.exit(1)
})
