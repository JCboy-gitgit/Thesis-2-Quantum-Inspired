# 🚀 Quick Start Guide - Testing the New QIA Schedule Generation

## Prerequisites
- ✅ Python 3.8+ installed
- ✅ Node.js 18+ installed
- ✅ Backend dependencies installed
- ✅ Frontend dependencies installed

---

## Step 1: Start the Python Backend

Open a terminal and run:

```bash
cd my-app/backend
python -m uvicorn main:app --reload
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Keep this terminal running!**

---

## Step 2: Start the Next.js Frontend

Open a **new terminal** and run:

```bash
cd my-app
npm run dev
```

You should see:
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
```

---

## Step 3: Navigate to Generate Schedule Page

1. Open browser: `http://localhost:3000`
2. Login to your application
3. Navigate to: **Room Schedule → Generate Schedule**

---

## Step 4: Configure Your Schedule

### 4.1 Select Data Sources (Step 1)
- ✅ Click on **Campus / Building / Rooms** section
- ✅ Select a campus CSV data group
- ✅ Click on **Class Schedules** section
- ✅ Select a class schedule CSV data group
- ✅ (Optional) Select teacher data
- ✅ Click **Continue to Review Data**

### 4.2 Review Your Data (Step 2)
- 📊 Check room counts and capacity
- 📚 Verify class counts
- ✅ Click **Continue to Configuration**

### 4.3 Configure Schedule (Step 3)

#### Basic Information
```
Schedule Name: 2025-2026 1st Semester Room Allocation
Semester: 1st Semester
Academic Year: 2025-2026
```

#### Time Configuration ⏰ (NEW!)
```
Start Time: 07:00 AM
End Time: 08:00 PM (20:00)
Slot Duration: 1 hour (60 minutes)
☑ Include Saturday
☐ Include Sunday
```

**You'll see a preview showing:**
```
Generated Time Slots Preview:
07:00 - 08:00  08:00 - 09:00  09:00 - 10:00  10:00 - 11:00  11:00 - 12:00
+8 more slots

Total: 13 time slots per day
```

#### Advanced Settings (Optional)
- Max Iterations: 10000
- Initial Temperature: 200
- Cooling Rate: 0.999
- Quantum Tunneling Probability: 0.15

---

## Step 5: Generate Schedule

1. ✅ Click **Generate Schedule** button
2. ⏳ Wait for processing (10-60 seconds depending on data size)
3. 👀 Watch the browser console for progress

---

## Step 6: Verify Success

### Frontend Console (Browser Dev Tools - F12)
You should see:
```javascript
[GenerateSchedule] Sending to Python backend: 
  rooms: 28
  classes: 45
  teachers: 15
  timeSlots: 13
  activeDays: (6) ['Monday', 'Tuesday', ..., 'Saturday']

📡 Sending request to Python backend: http://localhost:8000
📨 Backend response status: 200
✅ Backend processing successful!
   Schedule ID: 123
   Scheduled: 42 / 45
   Unscheduled: 3
```

### Backend Console (Python Terminal)
You should see:
```
============================================================
🚀 SCHEDULE GENERATION STARTED
============================================================
📋 Schedule Name: 2025-2026 1st Semester Room Allocation
📅 Semester: 1st Semester | Year: 2025-2026
📦 Using data provided directly from frontend
⏰ Using 13 custom time slots from frontend
📚 Sections to schedule: 45
🏢 Available rooms: 28
⏰ Time slots: 13
📅 Active days: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday
✅ Schedule record created with ID: 123
🎯 Running Quantum-Inspired Annealing Algorithm...
   Max Iterations: 10000
   Initial Temperature: 200
   Cooling Rate: 0.999
✅ Scheduling complete!
   Success: True
   Scheduled: 42/45
   Unscheduled: 3
💾 Saved 126 schedule entries to database
============================================================
🎉 SCHEDULE GENERATION COMPLETED
============================================================
```

### Results Page
- ✅ Green success banner
- 📊 Statistics cards showing totals
- 🗓️ Weekly timetable with allocations
- 📋 List of all room allocations

---

## 🐛 Common Issues & Solutions

### Issue 1: "Cannot connect to backend"
**Error Message:**
```
Cannot connect to Python backend at http://localhost:8000
```

**Solutions:**
1. Check Python backend is running:
   ```bash
   cd my-app/backend
   python -m uvicorn main:app --reload
   ```
2. Verify port 8000 is not in use:
   ```bash
   # Windows
   netstat -ano | findstr :8000
   
   # Mac/Linux
   lsof -i :8000
   ```
3. Check environment variable:
   Create/update `my-app/.env.local`:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

### Issue 2: Backend Errors (500)
**Check Python console for error details**

Common causes:
- Missing database tables
- Invalid data format
- Python dependencies not installed

**Fix:**
```bash
cd my-app/backend
pip install -r requirements.txt
```

### Issue 3: No Time Slots Generated
**Cause:** Invalid time range

**Fix:** Ensure:
- Start time < End time
- Format: "07:00" not "7:00 AM"
- Slot duration: 30-120 minutes

### Issue 4: High Unscheduled Count
**Causes:**
- Not enough rooms
- Room capacity too small
- Time slots insufficient

**Solutions:**
- Add more rooms to CSV
- Increase time range (start earlier/end later)
- Increase max iterations
- Check room capacities match class sizes

---

## 📊 Understanding Results

### Optimization Stats
```
Initial Cost: 1250.5
Final Cost: 234.8
Iterations: 10000
Improvements: 847
Quantum Tunnels: 23
Time: 12543 ms
```

**What this means:**
- **Lower Final Cost = Better Solution**
- **More Improvements = Algorithm found better arrangements**
- **Quantum Tunnels = Times algorithm escaped local optimum**

### Scheduled vs Unscheduled
```
Total Classes: 45
Scheduled: 42
Unscheduled: 3
```

**Aim for:**
- ✅ 95%+ scheduled (42/45 = 93% is good)
- ⚠️ <90% scheduled may indicate issues

---

## 🎯 Test Scenarios

### Scenario 1: Normal Schedule
```
Time: 07:00 - 20:00 (13 hours)
Slots: 1 hour each (13 slots)
Days: Mon-Fri (5 days)
Classes: 45
Expected: 95%+ scheduled
```

### Scenario 2: Extended Hours
```
Time: 06:00 - 22:00 (16 hours)
Slots: 1 hour each (16 slots)
Days: Mon-Sat (6 days)
Classes: 45
Expected: 100% scheduled
```

### Scenario 3: Short Duration Slots
```
Time: 08:00 - 17:00 (9 hours)
Slots: 30 minutes each (18 slots)
Days: Mon-Fri (5 days)
Classes: 45
Expected: 95%+ scheduled with flexibility
```

---

## 🔍 Debugging Checklist

If something doesn't work:

- [ ] Python backend is running (port 8000)
- [ ] Next.js frontend is running (port 3000)
- [ ] Environment variable `NEXT_PUBLIC_API_URL` is set
- [ ] CSV data is uploaded (campus and classes)
- [ ] Time configuration is valid (start < end)
- [ ] Browser console shows no errors
- [ ] Python console shows no errors
- [ ] Database connection is working

---

## 📝 Testing Checklist

Mark completed items:

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can select campus CSV data
- [ ] Can select class CSV data
- [ ] Can configure time settings (7 AM - 8 PM)
- [ ] Time slot preview appears correctly
- [ ] Generate schedule button works
- [ ] Browser console shows backend connection
- [ ] Python console shows processing
- [ ] Results page displays success
- [ ] Statistics are reasonable (>90% scheduled)
- [ ] Timetable shows allocations
- [ ] Can view schedule details

---

## ✅ Success Indicators

You'll know everything is working when:

1. ✅ No red errors in browser console
2. ✅ Python backend logs show "SCHEDULE GENERATION COMPLETED"
3. ✅ Results page shows green success banner
4. ✅ Scheduled classes ≥ 90% of total
5. ✅ Timetable displays room allocations
6. ✅ Database has new schedule record

---

## 🆘 Need Help?

**Check these files for details:**
1. `ISSUES_AND_SOLUTIONS.md` - Original problem analysis
2. `IMPLEMENTATION_SUMMARY.md` - Complete implementation details
3. `README.md` - Backend documentation

**Console Logs:**
- Frontend: Browser DevTools → Console (F12)
- Backend: Python terminal where uvicorn is running

**Database:**
Check Supabase for:
- `generated_schedules` table
- `room_allocations` table

---

**Good luck with your testing! 🚀**
