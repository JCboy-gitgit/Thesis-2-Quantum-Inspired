export type HolidayMap = Record<string, string>

export type GeneratedHolidayRow = {
  holiday_name: string
  holiday_date: string
  description: string | null
  holiday_type: string
  is_active: boolean
}

const pad2 = (value: number) => String(value).padStart(2, '0')

const toIsoDate = (date: Date): string => {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

const utcDate = (year: number, month: number, day: number): Date => {
  return new Date(Date.UTC(year, month - 1, day))
}

const addUtcDays = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

// Meeus/Jones/Butcher Gregorian computus algorithm.
const getEasterSundayUtc = (year: number): Date => {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return utcDate(year, month, day)
}

const getLastMondayOfAugustUtc = (year: number): Date => {
  const lastDay = utcDate(year, 8, 31)
  const dayOfWeek = lastDay.getUTCDay() // 0=Sunday ... 1=Monday
  const offset = dayOfWeek >= 1 ? dayOfWeek - 1 : 6
  return addUtcDays(lastDay, -offset)
}

const buildRow = (date: Date, name: string, holidayType = 'recurring', description: string | null = null): GeneratedHolidayRow => ({
  holiday_name: name,
  holiday_date: toIsoDate(date),
  description,
  holiday_type: holidayType,
  is_active: true,
})

// Long-run, automatically generated baseline holidays.
// Admin-managed holidays from the database can override/extend this set.
export const generatePhilippineHolidayRowsForYear = (year: number): GeneratedHolidayRow[] => {
  const easterSunday = getEasterSundayUtc(year)

  const rows: GeneratedHolidayRow[] = [
    buildRow(utcDate(year, 1, 1), 'New Year\'s Day'),
    buildRow(utcDate(year, 2, 25), 'EDSA People Power Revolution'),
    buildRow(addUtcDays(easterSunday, -3), 'Maundy Thursday', 'computed'),
    buildRow(addUtcDays(easterSunday, -2), 'Good Friday', 'computed'),
    buildRow(addUtcDays(easterSunday, -1), 'Black Saturday', 'computed'),
    buildRow(utcDate(year, 4, 9), 'Araw ng Kagitingan'),
    buildRow(utcDate(year, 5, 1), 'Labor Day'),
    buildRow(utcDate(year, 6, 12), 'Independence Day'),
    buildRow(utcDate(year, 8, 21), 'Ninoy Aquino Day'),
    buildRow(getLastMondayOfAugustUtc(year), 'National Heroes Day', 'computed'),
    buildRow(utcDate(year, 11, 1), 'All Saints\' Day'),
    buildRow(utcDate(year, 11, 2), 'All Souls\' Day'),
    buildRow(utcDate(year, 11, 30), 'Bonifacio Day'),
    buildRow(utcDate(year, 12, 8), 'Feast of Immaculate Conception'),
    buildRow(utcDate(year, 12, 24), 'Christmas Eve'),
    buildRow(utcDate(year, 12, 25), 'Christmas Day'),
    buildRow(utcDate(year, 12, 30), 'Rizal Day'),
    buildRow(utcDate(year, 12, 31), 'New Year\'s Eve'),
  ]

  return rows.sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))
}

export const generatePhilippineHolidayRowsForRange = (fromYear: number, toYear: number): GeneratedHolidayRow[] => {
  const start = Math.min(fromYear, toYear)
  const end = Math.max(fromYear, toYear)
  const rows: GeneratedHolidayRow[] = []

  for (let year = start; year <= end; year += 1) {
    rows.push(...generatePhilippineHolidayRowsForYear(year))
  }

  return rows
}

export const generatePhilippineHolidaysRange = (fromYear: number, toYear: number): HolidayMap => {
  return generatePhilippineHolidayRowsForRange(fromYear, toYear).reduce<HolidayMap>((acc, row) => {
    acc[row.holiday_date] = row.holiday_name
    return acc
  }, {})
}

// Backward-compatible export used by existing pages/components.
export const defaultPhilippineHolidays: HolidayMap = generatePhilippineHolidaysRange(2024, 2026)
