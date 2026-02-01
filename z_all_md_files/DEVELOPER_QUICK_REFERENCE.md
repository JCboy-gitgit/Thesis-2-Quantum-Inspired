# 🔧 Developer Quick Reference - Quantum-Inspired Scheduling

**For:** Developers implementing remaining phases (8-10)  
**Last Updated:** January 27, 2026

---

## 🎯 Current State of the System

### What's Working ✅
- Online Days configuration (quantum tunneling enabled)
- Room search, capacity filter, type filter
- Course/Section preview with auto-update
- Embedded teacher file upload (inline, no redirect)
- Automatic conflict detection (always on)
- Time configuration with clear campus hour labeling
- Backend API properly passes online_days parameter

### What's Next ⏳
- Phase 8: Theme Support (Light/Dark/Green)
- Phase 9: Heatmap Visualization
- Phase 10: Pin Feature for classes

---

## 📂 Important Files & Functions

### Main Page Component
**File:** `GenerateSchedule/page.tsx`

#### Key State Variables:
```typescript
// Data management
const [classes, setClasses] = useState<ClassSchedule[]>([])
const [rooms, setRooms] = useState<CampusRoom[]>([])

// Configuration
const [config, setConfig] = useState<ScheduleConfig>({
  onlineDays: [],  // ['Monday', 'Wednesday', ...]
  // ... other config
})

// UI States
const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1)
const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
```

#### Key Functions:
```typescript
// Load data
loadCampusData(groupId: number)
loadClassData(college, semester, academicYear)

// Filter & search
getSearchFilteredRooms(building: string)
getFilteredRooms()
getUniqueRoomTypes()

// Handle events
handleGenerateSchedule()
handleSelectClassGroup(groupId)
handleTeacherFileChange(e)

// Utilities
generateTimeSlots(settings: TimeSettings)
```

### Backend API
**File:** `/api/schedule/qia-backend/route.ts`

#### Request/Response Flow:
```
Frontend GenerateSchedule →
  POST /api/schedule/qia-backend →
    convertClassesToSections()
    convertRoomsToBackend()
    → Python Backend (scheduler_v2.py) →
      Process schedule →
        Return results →
  Frontend displays results
```

#### Key Conversion Functions:
```typescript
convertClassesToSections(classes) // Map to backend format
convertRoomsToBackend(rooms)      // Remove PWD fields
convertBackendResultToFrontend()  // Map results back
```

---

## 🎨 CSS/Styling System

### Location
All styling uses CSS modules: `*.module.css`

### Main Style File
`GenerateSchedule.module.css` - Contains all styles for the page

### Key Classes:
```css
.scheduleLayout { }           /* Main container */
.stepProgress { }            /* Progress indicator */
.formCard { }                /* Configuration sections */
.dataSourceCard { }          /* Data selection cards */
.previewSection { }          /* Data preview tables */
.filterSection { }           /* Room filter section */
.resultCard { }              /* Results display */
```

### For Theme Support (Phase 8):
Convert to CSS variables:
```css
:root {
  --color-primary: #3b82f6;     /* Light theme blue */
  --color-background: #ffffff;
  --color-text: #1f2937;
  /* ... more variables */
}

/* Dark theme */
[data-theme="dark"] {
  --color-primary: #60a5fa;
  --color-background: #1f2937;
  --color-text: #f3f4f6;
}

/* Green theme (BulSU) */
[data-theme="green"] {
  --color-primary: #16a34a;
  --color-accent: #d4af37;
  --color-background: #f8faf8;
}
```

---

## 📡 API Response Format

### What Python Backend Returns:
```json
{
  "success": true,
  "schedule_id": 123,
  "message": "Schedule generated successfully",
  "total_sections": 100,
  "scheduled_sections": 95,
  "unscheduled_sections": 5,
  "optimization_stats": {
    "initial_cost": 1250.50,
    "final_cost": 145.30,
    "iterations": 5000,
    "improvements": 342,
    "quantum_tunnels": 28,
    "time_elapsed_ms": 4523
  },
  "schedule_entries": [
    {
      "section_id": 1,
      "course_code": "CS101",
      "section_code": "1A",
      "day_of_week": "Monday",
      "start_time": "09:00",
      "end_time": "10:30",
      "room_id": 45,
      "room_code": "GLE-101",
      "capacity": 50,
      "year_level": 1
    },
    // ... more entries
  ],
  "unscheduled_list": [
    {
      "section_code": "2B",
      "course_code": "MATH202",
      "needed_slots": 3,
      "assigned_slots": 0,
      "reason": "No available lab rooms in preferred time"
    }
  ],
  "conflicts": []
}
```

---

## 🔄 Data Flow Diagram

```
USER INTERFACE (React)
├── Step 1: Data Selection
│   ├── Campus selection
│   ├── Class selection → loads ClassSchedule[]
│   ├── Show course preview
│   └── Optional: Teacher file upload
├── Step 2: Review & Filter
│   ├── Show room list
│   ├── Search/Filter rooms
│   └── Show class preview
└── Step 3: Configure
    ├── Set schedule name
    ├── Select online days
    ├── Set time bounds
    └── Generate → API call

API BRIDGE (/api/schedule/qia-backend)
├── Convert data formats
├── Validate request
├── Send to Python backend
├── Convert results back
└── Return to frontend

PYTHON BACKEND (scheduler_v2.py)
├── Parse schedule data
├── Apply constraints
│   ├── Online day rule
│   ├── Room capacity
│   ├── No conflicts
│   └── Time boundaries
├── Run QIA algorithm
│   ├── Initialize state
│   ├── Quantum tunneling moves
│   ├── Cooling schedule
│   └── Evaluate cost
└── Return schedule entries & stats

RESULTS DISPLAY
├── Show success/warning
├── Display statistics
├── Show unscheduled items
├── Display timetable preview
└── Offer export options
```

---

## 🎓 Phase 8: Theme Support Implementation Guide

### Step 1: Create Theme Context
```typescript
// Create: context/ThemeContext.tsx
type Theme = 'light' | 'dark' | 'green'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {}
})
```

### Step 2: Define CSS Variables
```css
/* GenerateSchedule.module.css */
:root {
  --primary: #3b82f6;
  --background: #ffffff;
  --border: #e5e7eb;
  --text: #1f2937;
}

[data-theme="dark"] {
  --primary: #60a5fa;
  --background: #1f2937;
  --border: #374151;
  --text: #f3f4f6;
}

[data-theme="green"] {
  --primary: #16a34a;
  --accent: #d4af37;
  --background: #fafbfa;
  --text: #1f2937;
}

/* Use in styles */
.formCard {
  background-color: var(--background);
  border: 1px solid var(--border);
  color: var(--text);
}
```

### Step 3: Add Theme Toggle
```tsx
// In MenuBar.tsx
<select value={theme} onChange={(e) => setTheme(e.target.value)}>
  <option value="light">☀️ Light</option>
  <option value="dark">🌙 Dark</option>
  <option value="green">🌿 Green (BulSU)</option>
</select>
```

### Step 4: Persist Theme
```typescript
// Store in localStorage
useEffect(() => {
  localStorage.setItem('theme', theme)
  document.documentElement.setAttribute('data-theme', theme)
}, [theme])
```

---

## 🗺️ Phase 9: Heatmap Visualization

### Data Needed:
```typescript
interface ConflictPoint {
  day: string        // 'Monday'
  timeSlot: string   // '09:00-10:30'
  conflictCount: number
  conflictTypes: string[]  // ['teacher', 'room', 'section']
}

// Map in results:
const conflictMatrix: ConflictPoint[] = results.conflicts.map(...)
```

### Rendering:
```tsx
// Create grid: 7 days × 14 time slots
const days = ['Monday', ..., 'Sunday']
const times = ['07:00', '08:00', ..., '20:00']

{days.map(day =>
  {times.map(time => {
    const conflict = conflictMatrix.find(...)
    const intensity = conflict?.conflictCount || 0
    const color = getHeatmapColor(intensity)
    return <div style={{backgroundColor: color}} />
  })}
)}
```

### Color Scale:
```javascript
function getHeatmapColor(count) {
  if (count === 0) return '#dcfce7'      // Green
  if (count <= 1) return '#bfdbfe'       // Light blue
  if (count <= 2) return '#fef3c7'       // Yellow
  if (count <= 3) return '#fed7aa'       // Orange
  return '#fecaca'                       // Red
}
```

---

## 📌 Phase 10: Pin Feature

### Implementation Overview:

**State Management:**
```typescript
const [pinnedClasses, setPinnedClasses] = useState<number[]>([])

// Toggle pin
const handleTogglePin = (classId: number) => {
  setPinnedClasses(prev =>
    prev.includes(classId)
      ? prev.filter(id => id !== classId)
      : [...prev, classId]
  )
}
```

**Send to Backend:**
```typescript
const scheduleData = {
  // ... existing fields
  pinned_classes: pinnedClasses,  // Add to payload
  config: {
    // ... existing config
    pinned_classes: pinnedClasses
  }
}
```

**Backend Constraint:**
```python
# In scheduler_v2.py
if section_id in config['pinned_classes']:
    # Do not move this class - frozen placement
    constraint_level = 'HARD'
    energy_penalty_if_moved = INFINITY
```

---

## 🧪 Testing Commands

### Run Next.js Dev Server:
```bash
cd my-app
npm run dev
# Navigate to http://localhost:3000
```

### Test Schedule Generation:
```bash
# 1. Select campus → class group
# 2. Verify course preview appears
# 3. Click "Continue to Review Data"
# 4. Apply room filters
# 5. Click "Continue to Configuration"
# 6. Select online days (e.g., Wednesday)
# 7. Click "Generate Room Allocation Schedule"
# 8. Check results
```

### Verify Backend Receives Data:
```javascript
// In browser DevTools Console
fetch('/api/schedule/qia-backend', {
  method: 'POST',
  body: JSON.stringify(scheduleData)
}).then(r => r.json()).then(console.log)
```

---

## 🐛 Common Debug Points

### If Online Days Not Working:
1. Check `config.onlineDays` is populated
2. Verify API payload includes `online_days`
3. Verify Python backend processes `online_days` parameter
4. Check results don't assign rooms to online days

### If Room Filter Not Working:
1. Verify `roomSearchQuery` state is updating
2. Check `getSearchFilteredRooms()` logic
3. Verify all buildings are being processed
4. Test with small dataset first

### If Course Preview Not Showing:
1. Check `classes` state after loading
2. Verify class group is selected
3. Check component is conditional on `selectedClassGroup && classes.length > 0`
4. Verify CSS is not hiding the element

### If Teacher Upload Not Working:
1. Check `handleTeacherFileChange()` updates `teacherUploadFile`
2. Verify form visibility state (`showTeacherUploadForm`)
3. Check file input accepts `.csv, .xlsx`
4. Verify feedback messages appear

---

## 📚 Key References

### Documentation Files:
- `IMPLEMENTATION_PROGRESS.md` - Detailed progress tracking
- `IMPLEMENTATION_SUMMARY.md` - Overview of all changes
- `DEVELOPER_GUIDE.md` - This file
- `BulSU_Scheduling_Rules.txt` - Business rules

### Database Tables Used:
- `campuses` - Room inventory
- `class_schedules` - Classes to schedule
- `teacher_schedules` - Optional teacher data (deprecated)
- `schedules` - Generated schedule results

### Python Files:
- `scheduler_v2.py` - Main QIA algorithm
- `models_v2.py` - Data models
- `main.py` - API endpoints

---

**Questions? Check the IMPLEMENTATION_PROGRESS.md file for detailed technical notes.**
