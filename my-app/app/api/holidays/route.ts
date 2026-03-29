import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  generatePhilippineHolidayRowsForRange,
  type GeneratedHolidayRow,
} from '@/lib/defaultHolidays'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type HolidayRow = {
  id: number
  holiday_name: string
  holiday_date: string
  description: string | null
  holiday_type: string | null
  is_active: boolean
}

const buildFallbackRows = (): HolidayRow[] => {
  const currentYear = new Date().getUTCFullYear()
  const generated = generatePhilippineHolidayRowsForRange(currentYear - 1, currentYear + 25)

  return generated.map((row, index) => ({
      id: index + 1,
      holiday_name: row.holiday_name,
      holiday_date: row.holiday_date,
      description: row.description,
      holiday_type: row.holiday_type,
      is_active: row.is_active,
    }))
}

const buildHolidayMap = (rows: HolidayRow[]) => {
  return rows.reduce<Record<string, string>>((acc, row) => {
    if (row.holiday_date && row.holiday_name) {
      acc[row.holiday_date] = row.holiday_name
    }
    return acc
  }, {})
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams
    const includeInactive = searchParams.get('includeInactive') === '1'
    const currentYear = new Date().getUTCFullYear()

    const parsedFromYear = Number(searchParams.get('fromYear'))
    const parsedToYear = Number(searchParams.get('toYear'))
    const rawFromYear = Number.isFinite(parsedFromYear) ? parsedFromYear : currentYear - 1
    const rawToYear = Number.isFinite(parsedToYear) ? parsedToYear : currentYear + 25

    const fromYear = Math.max(1970, Math.min(rawFromYear, rawToYear, 2100))
    const toYear = Math.min(2100, Math.max(rawFromYear, rawToYear, fromYear + 1))

    // Guard excessively wide ranges to avoid expensive payloads.
    const safeToYear = Math.min(toYear, fromYear + 50)

    const generatedRows = generatePhilippineHolidayRowsForRange(fromYear, safeToYear)
    const generatedMap = generatedRows.reduce<Record<string, string>>((acc, row: GeneratedHolidayRow) => {
      acc[row.holiday_date] = row.holiday_name
      return acc
    }, {})

    const supabaseAdmin = createAdminClient()

    let query = supabaseAdmin
      .from('academic_holidays')
      .select('id, holiday_name, holiday_date, description, holiday_type, is_active')
      .order('holiday_date', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      // If migration is missing, keep app functional with fallback static data.
      if (String(error.message || '').toLowerCase().includes('academic_holidays')) {
        const rows = buildFallbackRows()
        return NextResponse.json({
          holidays: rows,
          holidayMap: buildHolidayMap(rows),
          source: 'fallback',
          fromYear,
          toYear: safeToYear,
        })
      }
      throw error
    }

    const rows = (data || []) as HolidayRow[]
    const activeRows = rows.filter((row) => row.is_active)
    const mergedHolidayMap = {
      ...generatedMap,
      ...buildHolidayMap(activeRows),
    }

    return NextResponse.json({
      holidays: rows,
      holidayMap: mergedHolidayMap,
      source: 'database',
      fromYear,
      toYear: safeToYear,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch holidays' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const holidayName = String(body?.holiday_name || '').trim()
    const holidayDate = String(body?.holiday_date || '').trim()
    const description = body?.description ? String(body.description) : null
    const holidayType = body?.holiday_type ? String(body.holiday_type) : 'regular'

    if (!holidayName || !holidayDate) {
      return NextResponse.json({ error: 'holiday_name and holiday_date are required' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin
      .from('academic_holidays')
      .insert({
        holiday_name: holidayName,
        holiday_date: holidayDate,
        description,
        holiday_type: holidayType,
        is_active: true,
      })
      .select('id, holiday_name, holiday_date, description, holiday_type, is_active')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, holiday: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create holiday' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const id = Number(body?.id)

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Valid holiday id is required' }, { status: 400 })
    }

    const updates: Record<string, any> = {}
    if (body.holiday_name !== undefined) updates.holiday_name = String(body.holiday_name || '').trim()
    if (body.holiday_date !== undefined) updates.holiday_date = String(body.holiday_date || '').trim()
    if (body.description !== undefined) updates.description = body.description ? String(body.description) : null
    if (body.holiday_type !== undefined) updates.holiday_type = body.holiday_type ? String(body.holiday_type) : 'regular'
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active)

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin
      .from('academic_holidays')
      .update(updates)
      .eq('id', id)
      .select('id, holiday_name, holiday_date, description, holiday_type, is_active')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, holiday: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update holiday' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const id = Number(body?.id)

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Valid holiday id is required' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin
      .from('academic_holidays')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to delete holiday' }, { status: 500 })
  }
}
