# 2D Map Viewer - Quick Start Guide

## 🎯 What's New

You now have a **completely functional 2D map viewer** with:
- ✅ **Multiple published floor plans** support
- ✅ **Clickable rooms** with full details
- ✅ **Room images** gallery display
- ✅ **Room schedules** with full timetable
- ✅ **Real-time availability** status

---

## 📋 Admin Side: Publishing Floor Plans

### Quick Steps:

**1. Open Map Viewer**
   - Go to: Admin Dashboard > Rooms-Management > Map Viewer

**2. Select Building & Floor**
   - Choose building from dropdown
   - Select floor number

**3. Create or Edit Floor Plan**
   - Drag rooms onto canvas
   - Add any annotations needed

**4. Save Floor Plan**
   - Click **"Save Floor Plan"** button
   - **NEW Dialog appears:**
     ```
     Floor Plan Name: [Enter name]
     Link to Schedule: [Select optional schedule]
     
     ☐ Set as default floor plan (faculty will see this first)
     ☐ Publish floor plan (make visible to faculty)  ← NEW!
     
     [Cancel] [Save Floor Plan]
     ```

**5. Publishing:**
   - **Check ✅ "Publish floor plan"** to make it visible to faculty
   - **Check ✅ "Set as default"** to make it the initial view (only ONE can be default)
   - **Note:** You can now have multiple published plans visible to faculty!

### Status Indicators:
- **⭐ Default** = Default view + Visible to faculty
- **👁 Published** = Visible to faculty only
- **📝 Draft** = Admin-only, hidden from faculty

---

## 👥 Faculty Side: Viewing Floor Plans

### Quick Steps:

**1. Access Campus Map**
   - Go to: Faculty Dashboard > Campus Floor Plan

**2. View Floor Plan**
   - **Building Navigator** on left
   - Select building → Select floor → Plan displays
   - Multiple published plans available!

**3. Click Any Room**
   - **Detailed Modal Opens** with three tabs:
     - **📋 Details Tab** → Room info (building, code, capacity, type, status)
     - **📅 Schedule Tab** → All classes in the room & times
     - **📷 Images Tab** → Photo gallery of the room

**4. View Room Details**
   
   **Details Tab:**
   ```
   Building: Engineering Building
   Room Code: ENG-101
   Capacity: 50
   Floor: 2
   Type: Classroom
   Status: 🟢 Available Now
   
   Currently in Use:
   Course: CS101 - Introduction to Programming
   Section: A
   Time: 10:00 AM - 11:30 AM
   Teacher: Dr. John Smith
   ```

   **Schedule Tab:**
   ```
   10:00 AM - 11:30 AM | CS101 - A | Mon-Wed-Fri | Dr. John Smith
   01:00 PM - 02:30 PM | MATH101 - B | Mon-Wed-Fri | Prof. Jane Doe
   03:00 PM - 04:30 PM | PHYS101 - C | Tuesday-Thursday | Dr. Mike Johnson
   ```

   **Images Tab:**
   ```
   [Large Image Display]
   ← Prev | 1/3 | Next →
   [Thumbnail Gallery ■ ■ ■]
   ```

### Key Features:
- 🟢 **Live Availability** - Real-time indicator (Available/In Use/Unknown)
- 🎓 **Full Schedule** - See all classes across the week
- 📸 **Photo Gallery** - Browse room images with navigation
- 🔄 **Smooth Animations** - Professional UI transitions

---

## 🖼️ Room Images

### Admin: Uploading Images
1. Go to Rooms-Management
2. Select a room
3. Upload photos (already functional)
4. Images automatically appear in faculty side

### Faculty: Viewing Images
1. Click any room on map
2. Go to **Images Tab** in modal
3. View full-size image with caption
4. Use ← → buttons to navigate
5. Click thumbnails for quick access

---

## 📊 Room Availability Status

### Status Types:
| Status | Indicator | Meaning |
|--------|-----------|---------|
| Available | 🟢 | No class scheduled now |
| In Use | 🔴 | Class currently happening |
| Unknown | ⚪ | No schedule linked |

### How It Works:
- Compares current time with schedule
- Updates automatically (checks every minute)
- Shows which teacher & class is using room

---

## 🎨 UI/UX Features

### Modal Features:
- ✅ **Smooth animations** (fade-in, slide-up)
- ✅ **Dark theme** with college-specific colors
- ✅ **Responsive design** (mobile-friendly)
- ✅ **Tab navigation** (easy switching)
- ✅ **Color-coded badges** (status at a glance)
- ✅ **Image carousel** (professional gallery)

### Accessibility:
- ✅ Keyboard navigation support
- ✅ Screen reader friendly
- ✅ High contrast text
- ✅ Touch-friendly on mobile

---

## 🔧 Troubleshooting

### "No Floor Plans Available"
→ Admin needs to create and **publish** floor plans first

### "Room doesn't show details when clicked"
→ Room element must be linked to actual room record in database

### "No images showing"
→ Admin needs to upload images in Rooms-Management first

### "Schedule shows wrong times"
→ Check that schedule is linked in floor plan settings

### "Availability shows 'Unknown'"
→ No schedule linked to floor plan, or schedule needs to be selected

---

## 📱 Mobile Experience

The viewer is fully responsive:
- ✅ Modal adapts to screen size
- ✅ Touch-friendly navigation
- ✅ Image gallery optimized for mobile
- ✅ Tabs stack nicely on small screens
- ✅ One-column layout on phones

---

## 🚀 Performance

- ⚡ **Fast loading** - Optimized queries
- 🖼️ **Lazy image loading** - Images load only when tab is opened  
- 📊 **Real-time updates** - Schedule refreshes automatically
- 🔄 **Efficient caching** - No redundant data fetching

---

## 💡 Tips & Tricks

**For Admins:**
- Publish the most important floor plan as "Default"
- Publish 2-3 alternative plans for faculty reference
- Link floor plans to current semester schedules
- Add building photos in Images tab

**For Faculty:**
- Check schedule tab to see ALL room classes (not just current)
- Use image gallery to familiarize with room layout
- Live availability helps find empty rooms quickly
- Check real-time status before going to room

---

## ✅ Complete Feature List

- [x] Multiple published floor plans
- [x] Clickable room elements
- [x] Room details modal
- [x] Room image gallery
- [x] Full room schedule/timetable
- [x] Real-time availability status
- [x] Building navigator
- [x] Floor selector
- [x] Tab navigation
- [x] Image carousel
- [x] Mobile responsive
- [x] Dark theme support
- [x] Smooth animations
- [x] College theme support
- [x] Live schedule refresh

---

## 📞 Support

**Something not working?**

1. Check browser console (F12) for errors
2. Verify room images exist in Supabase
3. Verify schedule is linked to floor plan
4. Try refreshing the page (Ctrl+R)
5. Check database connection in Supabase console

---

**Version:** 2.0 - Complete Rewrite
**Date:** February 10, 2026
**Status:** ✅ Production Ready
