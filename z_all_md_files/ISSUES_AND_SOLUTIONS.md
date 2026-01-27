# Issues Found and Solutions for QIA Schedule Generation

## Problems Identified

### 1. **NOT Using Backend QIA Algorithm**
**Current Behavior:**
- The Generate Schedule page (`/LandingPages/RoomSchedule/GenerateSchedule/page.tsx`) calls `/api/schedule/qia-generate`
- This API route (`/app/api/schedule/qia-generate/route.ts`) runs a **simple JavaScript algorithm** directly in the Next.js API
- The proper **Python-based Quantum-Inspired Annealing Algorithm** in `backend/scheduler.py` is **NOT being used**

**Why This is Wrong:**
- The JavaScript version is a simplified mock algorithm
- The real QIA algorithm with simulated annealing, quantum tunneling, and constraint optimization is in the Python backend
- You're missing the sophisticated optimization features

---

### 2. **No Time Slot Configuration**
**Current Behavior:**
- No UI to set start time (e.g., 7:00 AM) and end time (e.g., 8:00 PM)
- No time slot duration settings (e.g., 1-hour blocks)
- Classes are scheduled based on CSV data's `schedule_time` field only

**What's Missing:**
- Time range selector (7 AM - 8 PM)
- Time slot duration (30 min, 1 hour, 1.5 hours)
- Days of week selection (Monday-Friday vs including Saturday)

---

### 3. **Not Weekly Timetable Format**
**Current Behavior:**
- Displays schedules as a list of allocations
- Shows basic timetable view but not properly structured weekly

**What's Needed:**
- Proper weekly timetable grid (Monday-Sunday columns)
- Time slots as rows (7:00 AM, 8:00 AM, 9:00 AM, etc.)
- Clear visualization of scheduled classes per day/time

---

## Solutions

### Solution 1: Connect to Python Backend QIA Algorithm

**Files to Modify:**
1. `my-app/app/LandingPages/RoomSchedule/GenerateSchedule/page.tsx`
2. Create new API route: `my-app/app/api/schedule/qia-backend/route.ts`
3. Ensure `backend/main.py` has the schedule endpoint

**Changes:**
```typescript
// In page.tsx, change API call from:
const response = await fetch('/api/schedule/qia-generate', { ... })

// To:
const response = await fetch('/api/schedule/qia-backend', { ... })
```

**New API Route Structure:**
```typescript
// app/api/schedule/qia-backend/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json()
  
  // Forward to Python FastAPI backend
  const response = await fetch(`${BACKEND_URL}/api/schedule/generate-qia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rooms: body.rooms,
      sections: body.classes, // Map classes to sections format
      teachers: body.teachers,
      config: {
        max_iterations: body.config.max_iterations,
        initial_temperature: body.config.initial_temperature,
        cooling_rate: body.config.cooling_rate,
        quantum_tunneling_probability: body.config.quantum_tunneling_probability,
        // ... other config
      }
    })
  })
  
  return NextResponse.json(await response.json())
}
```

---

### Solution 2: Add Time Configuration UI

**Add to GenerateSchedule page:**

```typescript
interface TimeSettings {
  startTime: string // "07:00"
  endTime: string   // "20:00"
  slotDuration: number // 60 minutes
  includeSaturday: boolean
  includeSunday: boolean
}

const [timeSettings, setTimeSettings] = useState<TimeSettings>({
  startTime: '07:00',
  endTime: '20:00',
  slotDuration: 60,
  includeSaturday: true,
  includeSunday: false
})
```

**UI Component:**
```tsx
<div className={styles.timeSettingsCard}>
  <h3>⏰ Time Configuration</h3>
  
  <div className={styles.timeInputs}>
    <label>
      Start Time:
      <input 
        type="time" 
        value={timeSettings.startTime}
        onChange={(e) => setTimeSettings({...timeSettings, startTime: e.target.value})}
      />
    </label>
    
    <label>
      End Time:
      <input 
        type="time" 
        value={timeSettings.endTime}
        onChange={(e) => setTimeSettings({...timeSettings, endTime: e.target.value})}
      />
    </label>
    
    <label>
      Slot Duration (minutes):
      <select 
        value={timeSettings.slotDuration}
        onChange={(e) => setTimeSettings({...timeSettings, slotDuration: Number(e.target.value)})}
      >
        <option value={30}>30 minutes</option>
        <option value={60}>1 hour</option>
        <option value={90}>1.5 hours</option>
        <option value={120}>2 hours</option>
      </select>
    </label>
  </div>
  
  <div className={styles.dayCheckboxes}>
    <label>
      <input 
        type="checkbox" 
        checked={timeSettings.includeSaturday}
        onChange={(e) => setTimeSettings({...timeSettings, includeSaturday: e.target.checked})}
      />
      Include Saturday
    </label>
    
    <label>
      <input 
        type="checkbox" 
        checked={timeSettings.includeSunday}
        onChange={(e) => setTimeSettings({...timeSettings, includeSunday: e.target.checked})}
      />
      Include Sunday
    </label>
  </div>
</div>
```

---

### Solution 3: Generate Time Slots and Send to Backend

**Generate time slots from settings:**

```typescript
function generateTimeSlots(settings: TimeSettings): TimeSlot[] {
  const slots: TimeSlot[] = []
  const [startHour, startMin] = settings.startTime.split(':').map(Number)
  const [endHour, endMin] = settings.endTime.split(':').map(Number)
  
  let currentTime = startHour * 60 + startMin // Convert to minutes
  const endTimeMinutes = endHour * 60 + endMin
  let slotId = 1
  
  while (currentTime < endTimeMinutes) {
    const hour = Math.floor(currentTime / 60)
    const min = currentTime % 60
    const nextTime = currentTime + settings.slotDuration
    const nextHour = Math.floor(nextTime / 60)
    const nextMin = nextTime % 60
    
    slots.push({
      id: slotId++,
      slot_name: `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')} - ${nextHour.toString().padStart(2, '0')}:${nextMin.toString().padStart(2, '0')}`,
      start_time: `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`,
      end_time: `${nextHour.toString().padStart(2, '0')}:${nextMin.toString().padStart(2, '0')}`,
      duration_minutes: settings.slotDuration
    })
    
    currentTime = nextTime
  }
  
  return slots
}

// When generating schedule:
const handleGenerateSchedule = async () => {
  const timeSlots = generateTimeSlots(timeSettings)
  const activeDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  if (timeSettings.includeSaturday) activeDays.push('Saturday')
  if (timeSettings.includeSunday) activeDays.push('Sunday')
  
  const scheduleData = {
    // ... existing data
    time_slots: timeSlots,
    active_days: activeDays,
    time_settings: timeSettings
  }
  
  const response = await fetch('/api/schedule/qia-backend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scheduleData)
  })
}
```

---

### Solution 4: Display as Weekly Timetable

**Timetable Component:**

```tsx
function WeeklyTimetable({ allocations, timeSlots, activeDays }) {
  // Group allocations by day and time
  const timetableData = useMemo(() => {
    const data: Record<string, Record<string, RoomAllocation[]>> = {}
    
    timeSlots.forEach(slot => {
      activeDays.forEach(day => {
        if (!data[slot.start_time]) data[slot.start_time] = {}
        data[slot.start_time][day] = allocations.filter(
          a => a.schedule_day === day && a.schedule_time === slot.start_time
        )
      })
    })
    
    return data
  }, [allocations, timeSlots, activeDays])
  
  return (
    <div className={styles.timetableContainer}>
      <table className={styles.weeklyTimetable}>
        <thead>
          <tr>
            <th>Time</th>
            {activeDays.map(day => (
              <th key={day}>{day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map(slot => (
            <tr key={slot.id}>
              <td className={styles.timeCell}>
                <div>{slot.start_time}</div>
                <div className={styles.timeSlotEnd}>{slot.end_time}</div>
              </td>
              {activeDays.map(day => {
                const classes = timetableData[slot.start_time]?.[day] || []
                return (
                  <td key={day} className={styles.scheduleCell}>
                    {classes.map((cls, idx) => (
                      <div key={idx} className={styles.classBlock}>
                        <strong>{cls.course_code}</strong>
                        <div>{cls.section}</div>
                        <div>{cls.room}</div>
                      </div>
                    ))}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

## Backend Python Integration

**Ensure `backend/main.py` has the endpoint:**

```python
from fastapi import FastAPI, HTTPException
from scheduler import QuantumInspiredScheduler

app = FastAPI()

@app.post("/api/schedule/generate-qia")
async def generate_qia_schedule(data: dict):
    try:
        # Parse input
        rooms = [Room(**r) for r in data['rooms']]
        sections = [Section(**s) for s in data['sections']]
        time_slots = [TimeSlot(**t) for t in data['time_slots']]
        
        # Create scheduler
        scheduler = QuantumInspiredScheduler(
            sections=sections,
            rooms=rooms,
            time_slots=time_slots
        )
        
        # Run optimization
        result = scheduler.optimize(
            max_iterations=data['config']['max_iterations'],
            initial_temp=data['config']['initial_temperature'],
            cooling_rate=data['config']['cooling_rate'],
            quantum_prob=data['config']['quantum_tunneling_probability']
        )
        
        return {
            "success": True,
            "allocations": result.allocations,
            "stats": result.stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## Summary of Changes Needed

1. ✅ **Create new API route** that forwards to Python backend
2. ✅ **Add time configuration UI** (start/end time, slot duration, days)
3. ✅ **Generate time slots** from user settings
4. ✅ **Send complete data** to Python backend including time slots
5. ✅ **Update backend endpoint** to accept time slot data
6. ✅ **Display results as weekly timetable** with proper grid layout

## Priority Order

1. **HIGH**: Connect to Python backend (Solution 1)
2. **HIGH**: Add time configuration (Solution 2)
3. **MEDIUM**: Generate and send time slots (Solution 3)
4. **MEDIUM**: Weekly timetable display (Solution 4)
