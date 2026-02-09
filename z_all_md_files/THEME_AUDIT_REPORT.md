# Comprehensive Theme Audit Report
## Admin LandingPages Directory
### Generated from full file-by-file analysis of 21 TSX files + 20 CSS/style files

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Critical Issues](#2-critical-issues)
3. [File-by-File: TSX Components](#3-file-by-file-tsx-components)
4. [File-by-File: CSS/Style Files](#4-file-by-file-cssstyle-files)
5. [Hardcoded Color Inventory](#5-hardcoded-color-inventory)
6. [Duplicated Color Patterns](#6-duplicated-color-patterns)
7. [Theme Selector Inconsistencies](#7-theme-selector-inconsistencies)
8. [Recommendations](#8-recommendations)

---

## 1. Executive Summary

| Metric | Count |
|--------|-------|
| Total TSX files audited | 21 |
| Total CSS files audited | 20 |
| Files with hardcoded colors in TSX | **16 / 21** |
| CSS files with hardcoded colors | **19 / 20** |
| Files with OLD dark green as default | **3** (CRITICAL) |
| Duplicated color util functions | **4 files** with same `getRoleColor`/`getRoleInfo` |
| Inconsistent green palettes | **2** (standard vs Tailwind emerald) |
| CSS files using `:global()` wrapper | 5 |
| CSS files using bare `[data-theme]` | 6 |
| CSS files with NO theme support | **1** (Alerts) |
| Total unique hardcoded hex colors found | **100+** |

### Theme Architecture
- **Three themes**: green (nature-light), dark (blue accent), light (clean green)
- **Switching mechanism**: `[data-theme="green"|"dark"|"light"]` on `<html>` element
- **CSS variables**: Defined in `globals.css`, consumed via `var(--name, fallback)` pattern
- **Context**: `useTheme()` from `ThemeContext`

---

## 2. Critical Issues

### 🔴 CRITICAL: Old Dark Green Theme as Default (3 files)

#### `Alerts/styles.module.css`
- **Severity**: CRITICAL
- **Problem**: Uses hardcoded old dark green (`#00331a`) as the ONLY theme. Has ZERO theme switching support.
- **Colors**: `var(--background, #00331a)`, `#e2fef2`, `rgba(2, 53, 60, 0.7)`, `linear-gradient(135deg, #2EAF7D 0%, #3FD0C9 100%)`
- **Impact**: This page looks completely wrong on any theme other than the old dark green.

#### `Profile/styles.module.css`
- **Severity**: HIGH
- **Problem**: Uses old dark green as CSS variable fallbacks.
- **Colors**: `rgba(0, 88, 38, 0.95)` card bg, `rgba(0, 166, 81, 0.3)` borders, `#a8e6c0` text, `#005826` primary-dark
- **Impact**: Falls back to dark green if CSS variables aren't defined.

#### `ProfileChangeRequests/styles.module.css`
- **Severity**: HIGH
- **Problem**: Dark navy theme as DEFAULT, not matching any standard theme.
- **Colors**: `var(--dark-bg, linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0f142d 100%))`, `#00d4ff`/`#00a3cc` accent
- **Impact**: Default appearance is a custom dark theme not aligned with the three official themes.

### 🟠 HIGH: Inconsistent Green Palettes

| File Group | Green Palette Used |
|------------|--------------------|
| Most files | `#2EAF7D`, `#449342`, `#3FD0C9`, `#02353C`, `#C1F6ED` |
| MapViewer  | `#10b981`, `#34d399` (Tailwind emerald-500/300) |
| Home       | `#00A651`, `#2EAF7D`, `#22c55e` (mixed sources) |
| GenerateSchedule | `#16a34a` (Tailwind green-600) |

### 🟠 HIGH: Duplicated Color Utility Functions (4+ files)

The same role/status color logic is copy-pasted across:
- `FacultyColleges/page.tsx` → `getRoleInfo()`, `getEmploymentBadge()`
- `FacultyLists/page.tsx` → `getRoleColor()`, `getEmploymentBadge()`
- `FacultyProfiles/page.tsx` → `getRoleInfo()`, `getEmploymentBadge()`, `getOnlineStatus()`
- `RoomsManagement/page.tsx` → `getRoomStatusInfo()`
- `RoomLists&Details/page.tsx` → `getRoomStatusInfo()` (identical)

---

## 3. File-by-File: TSX Components

### ✅ Clean Files (no/minimal hardcoded colors)

| File | Lines | Status |
|------|-------|--------|
| `Alerts/page.tsx` | 180 | ✅ Clean — uses CSS modules + data-severity |
| `FacultyApproval/page.tsx` | 280 | ✅ Clean — uses `data-page="admin"` |
| `ProfileChangeRequests/page.tsx` | 280 | ✅ Clean — CSS modules only |
| `ClassSectionAssigning/page.tsx` | 2343 | ✅ Mostly clean — uses CSS vars in inline styles |
| `Search-FilterRooms/page.tsx` | 636 | ✅ Clean — CSS modules |
| `FacultyDepartments/page.tsx` | 1007 | ✅ Minimal — only `marginTop: '100px'` inline |

### ⚠️ Files with Hardcoded Colors in TSX

#### `CoursesManagement/page.tsx` (2472 lines)
- **`FOLDER_COLORS` array** (line ~110): 8 gradient sets
  - `#276749`→`#38a169`, `#667eea`→`#764ba2`, `#0d9488`→`#14b8a6`, `#c2410c`→`#ea580c`, `#be185d`→`#ec4899`, `#4338ca`→`#6366f1`, `#0891b2`→`#22d3ee`
  - First entry uses `var(--primary-gradient)` (GOOD)
- **Inline styles** (lines 500+): Uses CSS vars with fallbacks like `var(--text-secondary, #718096)`, `var(--text-dark, #1a202c)`, `var(--primary-medium, #38a169)` — ACCEPTABLE pattern
- **Hardcoded**: `#c53030` delete warning (L1305), `#8b5cf6` lab icon (L2372), `#718096` loading text (L2459)

#### `FacultyColleges/page.tsx` (2738 lines)
- **`getRoleInfo()`** (line ~102): `#f59e0b` admin, `#8b5cf6` dept_head, `#ec4899` program_chair, `#06b6d4` coordinator, `#64748b` staff, `#22c55e` faculty
- **`getEmploymentBadge()`** (line ~119): Same color set + rgba variants
- Uses these in inline `style={{ backgroundColor: ... }}` throughout render

#### `FacultyLists/page.tsx` (1558 lines)
- **`getRoleColor()`** (line ~115): Same colors as FacultyColleges
- **`getEmploymentBadge()`** (line ~140): Duplicate of FacultyColleges
- Inline: `#ef4444` delete confirmation (L1510)

#### `FacultyProfiles/page.tsx` (1075 lines)
- **`getRoleInfo()`** (line ~145): Full version with icon, label, color, bgColor — all hardcoded
- **`getEmploymentBadge()`** (line ~199): Same pattern
- **`getOnlineStatus()`** (line ~215): `#22c55e` online, `#f59e0b` away, `#64748b` offline
- Used extensively in render section for profile cards, avatars, badges (lines 628-1014)

#### `Home/page.tsx` (735 lines)
- **`quickNavItems`** array: `#2EAF7D`, `#449342`, `#3FD0C9`, `#02353C` — old green theme palette hardcoded
- Uses plain CSS import `./styles.css` (not module)

#### `Profile/page.tsx` (507 lines)
- Inline styles use CSS vars (GOOD): `var(--input-border)`, `var(--input-text)`, `var(--input-bg)`
- Loading div: `var(--text-primary)` inline style

#### `MapViewer/page.tsx` (3297 lines)
- **`ROOM_TYPE_COLORS`** (line ~114): 12+ room types, each with hardcoded fill/stroke:
  - lecture: `#dcfce7`/`#22c55e`, laboratory: `#dbeafe`/`#3b82f6`, computer_lab: `#f3e8ff`/`#a855f7`, conference: `#fef3c7`/`#f59e0b`, auditorium: `#ffe4e6`/`#f43f5e`, gym: `#ffedd5`/`#f97316`, library: `#e0e7ff`/`#6366f1`, office: `#f1f5f9`/`#64748b`, storage: `#fafaf9`/`#a8a29e`, cafeteria: `#fce7f3`/`#ec4899`, default: `#f3f4f6`/`#d1d5db`
- **Canvas background**: `#ffffff`/`#1a1f3a` toggled via `useTheme()` (L~420)
- **Shape colors**: `#6366f1`, `#10b981`, `#374151`, `#d1d5db`, `#f59e0b`, `#1f2937`
- Canvas color picker buttons (L2891-2896): `#ffffff`, `#f0fdf4`, `#f8fafc`, `#fef3c7`, `#e0e7ff`, `#fce7f3`
- MapViewer element fallback color: `#3b82f6` (L2942)
- Delete button: `#ef4444` (L3140)

#### `RoomLists&Details/page.tsx` (1496 lines)
- **`getRoomStatusInfo()`** (line ~53): `#059669`/`#d1fae5` usable, `#dc2626`/`#fee2e2` not_usable, `#d97706`/`#fef3c7` maintenance
- **Stat cards** (lines 985-1000): `#22c55e`, `#059669`, `#d1fae5`, `#ef4444`, `#dc2626`, `#fee2e2` hardcoded in inline styles
- Room count: `#888` (L1049)
- Delete warning: `#ef4444` (L1443)

#### `RoomsManagement/page.tsx` (1712 lines)
- **`FOLDER_COLORS`** (line ~98): 6 gradient sets (Green, Blue, Purple, Orange, Pink, Teal)
- **`getRoomStatusInfo()`** (line ~119): Identical to RoomLists&Details
- **Inline styles** (lines 1000+): `#6366f1` indigo badges, `#10b981` green amenities, `#3b82f6` info icon, `rgba(99, 102, 241, 0.15)` indigo bg, `rgba(16, 185, 129, 0.2)` green bg, `rgba(59, 130, 246, 0.1)` blue info box

#### `ViewSchedule/page.tsx` (2609 lines)
- **PDF export** (L1165): `setFillColor(22, 163, 74)` = `#16a34a`
- **`courseColors` array** (L1573-1578): `#E8F5E9`, `#E0F2F1`, `#FFF3E0`, `#FCE4EC`, `#F3E5F5`, `#E3F2FD` — pastel schedule backgrounds
- **`COURSE_COLORS`** (L2317-2319): 16 dark colors for schedule blocks: `#1976d2`, `#388e3c`, `#f57c00`, `#7b1fa2`, `#00796b`, `#c2185b`, `#5d4037`, `#455a64`, `#d32f2f`, `#303f9f`, `#0097a7`, `#689f38`, `#ffa000`, `#512da8`, `#e64a19`, `#00838f`
- Schedule block text: `#fff` (L2394), shadow: `rgba(0,0,0,0.3)`, label bg: `rgba(0,0,0,0.15)`
- Print background: `#ffffff` (L1536)
- Duplicate pastel palette at L2450-2452

#### `GenerateSchedule/page.tsx` (4514 lines)
- **Unscheduled reason colors** (L2251-2258): `#ef4444`, `#8b5cf6`, `#f59e0b`, `#ec4899`, `#3b82f6`, `#10b981`, `#6366f1`, `#6b7280` — hardcoded reason category badges
- **Inline grays**: `#666` (L2277, 2310, 2316), `#dc2626` error (L2314)
- **Schedule block text**: `#fff` (L2635), label bg: `rgba(0,0,0,0.15)` (L2659)
- **University icon**: `#6366f1` (L2742)
- **Checkbox accent**: `#16a34a` (L2787, 3109, 3179, 3363)
- **Select-all button bg**: `#16a34a` (L3116, 3371)
- **College label**: `#6366f1` (L3131)
- **Excluded text**: `#9ca3af` (L3181)
- **Warning icons**: `#f57c00` (L3680-3681), success: `#10b981` (L3740-3741)

#### `TeachingLoadAssignment/page.tsx` (1729 lines)
- **Inline styles use CSS vars** (GOOD): `var(--text-dark, #1a202c)`, `var(--text-medium, #718096)`, `var(--text-light, #a0aec0)`, `var(--bg-gray-50, #f7fafc)`, `var(--bg-gray-100, #edf2f7)`, `var(--border-color, #e2e8f0)`
- **Hardcoded**: `#ef4444` delete button (L1220), `white` bg (L1194)

#### `UploadCSV/page.tsx` (1139 lines)
- **Info boxes** (L830-1100): Heavy use of hardcoded inline colors for help text:
  - Info: `#2563eb` icon, `#1e40af` strong text
  - Success: `#059669` icon, `#065f46` strong text
  - Warning: `#d97706` icon, `#92400e` strong text
  - Accent: `#10b981` for column headers
  - Uses `var(--info-bg, #dbeafe)`, `var(--success-bg, #d1fae5)`, `var(--warning-bg, #fef3c7)` with fallbacks (ACCEPTABLE)
- **Upload button**: `linear-gradient(135deg, #7c3aed, #a855f7)` (L1107)

#### `Add-EditRooms/page.tsx` (888 lines)
- Inline: `background: 'none', border: 'none'` — mostly layout
- Uses `data-page="admin"`

#### `ScheduleDetailsModal.tsx` (959 lines)
- First 500 lines: no hardcoded colors (uses CSS modules)
- Render section uses CSS class names only

---

## 4. File-by-File: CSS/Style Files

### Rating System
- 🟢 = Good CSS var usage, theme-aware
- 🟡 = Mixed — some hardcoded, some CSS vars
- 🔴 = Heavily hardcoded / broken theme support

---

### 🔴 `Alerts/styles.module.css` (~170 lines, COMPLETE)
**NO THEME SUPPORT — Old dark green hardcoded as only theme**
| Color | Usage |
|-------|-------|
| `#00331a` | Page background fallback `var(--background, #00331a)` |
| `#e2fef2` | Text color |
| `rgba(2, 53, 60, 0.7)` | Card/input backgrounds |
| `rgba(61, 208, 201, 0.3)` | Borders |
| `linear-gradient(135deg, #2EAF7D 0%, #3FD0C9 100%)` | Primary buttons/icons |
| `rgba(239, 68, 68, 0.5)` | Error state |
| `rgba(245, 158, 11, 0.5)` | Warning state |

---

### 🟡 `ClassSchedules.module.css` (1552 lines)
**Well-structured with `:global([data-theme="green"])` overrides**
- Green overrides (lines 1-280): `#C1F6ED`, `#02353C`, `#449342`, `#2EAF7D`, `#3FD0C9`
- Base styles use CSS vars with fallbacks: `var(--bg-white, #ffffff)`, `var(--primary-gradient, ...)`
- **Hardcoded stat card borders**: `#3182ce` total, `#38a169` scheduled, `#805ad5` rooms, `#dd6b20` teachers, `#319795` sections, `#e53e3e` conflicts

---

### 🟡 `FacultyColleges/styles.module.css` (2042 lines)
**Green theme overrides at top, base uses CSS vars**
- **Hardcoded blue gradient** for college/file cards: `linear-gradient(135deg, #00d4ff 0%, #00b4d8 50%, #0096c7 100%)`
- Status colors: `rgba(140, 250, 180, 0.2)` active, `rgba(239, 68, 68, 0.2)` inactive

---

### 🟡 `TeachingLoadAssignment/styles.module.css` (560 lines)
**Mix of hardcoded grays and CSS vars**
| Hardcoded | Usage |
|-----------|-------|
| `#1f2937` | Dark text |
| `#6b7280` | Medium text |
| `#9ca3af` | Light text |
| `#e5e7eb` | Borders |
| `#f9fafb` | Light bg |
| `white` | Backgrounds |
| `#ef4444` | Danger button |

---

### 🟢 `FacultyApproval/styles.module.css` (657 lines)
**Good structure — `:global([data-theme="green"])` overrides + CSS vars base**
- **Hardcoded badge colors** (semantic, acceptable):
  - `#fbbf24` pending, `#10b981` approved, `#ef4444` rejected, `#9ca3af` unconfirmed
- Toast: `#10b981` success, `#ef4444` error

---

### 🟢 `FacultyDepartments/styles.module.css` (1332 lines)
**Uses `[data-theme="green"]` (without `:global`)**
- Extensive green overrides
- Base uses CSS vars properly
- Hardcoded: `#ffffff` in stat icons

---

### 🟡 `FacultyLists/FacultyLists.module.css` (1488 lines)
**Uses `[data-theme="green"]` — base has some hardcoded**
- `rgba(0, 166, 81, 0.12)` stat icon background
- `#00A651` stat icon color

---

### 🟢 `FacultyProfiles/styles.module.css` (1327 lines)
**Uses `[data-theme="green"]` — extensive overrides, base uses CSS vars**

---

### 🔴 `ProfileChangeRequests/styles.module.css` (619 lines)
**Dark navy as DEFAULT theme**
| Color | Usage |
|-------|-------|
| `#0a0e27`, `#1a1f3a`, `#0f142d` | Page background gradient |
| `#00d4ff` / `#00a3cc` | Default accent color (blue) |
| `#fbbf24` | Pending badge |
| `#10b981` | Approved badge |
| `#ef4444` | Rejected badge |
- Has green + light theme overrides, but default is custom dark that doesn't match any standard theme.

---

### 🟡 `Home/styles.css` (1351 lines) — PLAIN CSS, NOT MODULE
**Comprehensive theme support but many hardcoded base colors**
- Has COMPLETE green/light/dark theme blocks
| Hardcoded | Usage |
|-----------|-------|
| `#00A651` | Stat values, icon colors, calendar today |
| `#2EAF7D` | Online badges/dots |
| `#22c55e` | Online indicator |
| `#02353C` | Sections icon color |
| `!important` on `.stat-icon` classes | Forces specific colors |
- Dark theme uses `#38bdf8`, `#0ea5e9` blue palette
- **Risk**: Plain CSS (not module) — may leak styles globally

---

### 🔴 `Profile/styles.module.css` (630 lines)
**Old dark green as CSS var fallbacks**
| Color | Usage |
|-------|-------|
| `rgba(0, 88, 38, 0.95)` | Card background fallback |
| `rgba(0, 166, 81, 0.3)` | Border fallback |
| `#a8e6c0` | Text color fallback |
| `#005826` | Primary dark fallback |

---

### 🟡 `Add-EditRooms/styles.module.css` (1025 lines)
**Good CSS var usage overall**
- Room type badge colors hardcoded: `#16a34a` lecture, `#9333ea` lab, `#2563eb` computer lab, `#d97706` auditorium
- Feature icon colors: `#3b82f6`, `#a855f7`, `#6366f1`, `#22c55e`, `#f59e0b`
- Success/error: `#16a34a`/`#dc2626`

---

### 🟡 `MapViewer/styles.module.css` (4365 lines) — LARGEST AFTER GenerateSchedule
**Extensive `[data-theme="green"]` but uses DIFFERENT green palette**
- Green overrides use: `#10b981`, `#34d399` (Tailwind emerald — NOT #2EAF7D/#449342)
- Slate gray palette: `#1e293b`, `#334155`, `#475569`, `#64748b`, `#94a3b8`
- Star rating: `#f59e0b`

---

### 🟡 `RoomLists&Details/styles.module.css` (1488 lines)
**Good CSS var usage overall**
| Hardcoded | Usage |
|-----------|-------|
| `#00A651` | Stat icons, campus icons |
| `#22c55e` / `#ef4444` / `#f59e0b` | Room status card borders |
| `linear-gradient(135deg, #22c55e 0%, #16a34a 100%)` | Add room button |

---

### 🟢 `Search-FilterRooms/styles.module.css` (1223 lines)
**Excellent CSS var usage throughout**
- Only hardcoded: room type badge colors (same as Add-EditRooms): `#16a34a`, `#9333ea`, `#2563eb`, `#d97706`

---

### 🟡 `GenerateSchedule/GenerateSchedule.module.css` (7082 lines) — LARGEST FILE
**Extensive `[data-theme="green"]` overrides**
- SVG leaf background pattern: hardcoded `#16a34a`, `#2EAF7D`
- Required badge: `#dc2626`
- Massive file — many theme-specific overrides but some base colors hardcoded

---

### 🟡 `ViewSchedule/ViewSchedule.module.css` (2439 lines)
**Extensive `:global([data-theme="green"])` overrides**
- Archive button gradient: `linear-gradient(135deg, #f59e0b 0%, #d97706 100%)`, hover `#b45309`

---

### 🟡 `ScheduleDetailsModal.module.css` (1052 lines)
**Extensive green theme overrides, base uses CSS vars**
| Hardcoded | Usage |
|-----------|-------|
| `#00A651` | Stat icon |
| `#fef2f2` / `#fee2e2` | Close button bg |
| `#86efac` / `#93c5fd` | Success/password stat card borders |
| `#059669` / `#3b82f6` | Stat card icon colors |

---

### 🟡 `RoomsManagement/styles.module.css` (1978 lines)
**Hardcoded gradients for folder cards**
| Element | Gradient |
|---------|----------|
| `.fileCard` | `#16a34a` → `#22c55e` → `#4ade80` |
| `.campusCard` | `#8b5cf6` → `#7c3aed` → `#6d28d9` |
| `.buildingCard` | `#f59e0b` → `#d97706` → `#b45309` |
- Room status borders: `#22c55e` / `#ef4444` / `#f59e0b`
- Stat icons: `#00A651`
- Amenity: `#d1fae5` / `#059669`

---

### 🟢 `UploadCSV/styles/bQtime.module.css` (~250 lines, COMPLETE)
**Excellent CSS var usage — BEST EXAMPLE in codebase**
- Uses: `var(--primary)`, `var(--bg-white)`, `var(--text-dark)`, `var(--border-color)` etc.
- Only hardcoded: success `#065f46`/`#ecfdf5`/`#10b981` and error `#b91c1c`/`#fff1f2`/`#ef4444` message colors (semantic, acceptable)

---

## 5. Hardcoded Color Inventory

### Old Dark Green Theme Colors (should be eliminated)
| Color | Found In |
|-------|----------|
| `#00331a` | Alerts/styles.module.css |
| `#004d26` | — |
| `#005826` | Profile/styles.module.css |
| `rgba(0, 88, 38, 0.95)` | Profile/styles.module.css |
| `rgba(0, 166, 81, 0.3)` | Profile/styles.module.css |
| `#a8e6c0` | Profile/styles.module.css |
| `rgba(2, 53, 60, 0.7)` | Alerts/styles.module.css |
| `rgba(61, 208, 201, 0.3)` | Alerts/styles.module.css |
| `#e2fef2` | Alerts/styles.module.css |

### Brand Green (inconsistent palette)
| Color | Source | Used In |
|-------|--------|---------|
| `#00A651` | Legacy brand | Home, FacultyLists, RoomLists, RoomsMgmt, ScheduleDetails CSS |
| `#2EAF7D` | Green theme | Home, Alerts, GenerateSchedule CSS |
| `#449342` | Green theme | Home page.tsx |
| `#3FD0C9` | Green theme | Home page.tsx, Alerts CSS |
| `#02353C` | Green theme | Home CSS |
| `#C1F6ED` | Green theme | ClassSchedules CSS |
| `#10b981` | Tailwind emerald-500 | MapViewer, UploadCSV, GenerateSchedule, FacultyApproval, RoomsMgmt |
| `#34d399` | Tailwind emerald-300 | MapViewer CSS |
| `#16a34a` | Tailwind green-600 | GenerateSchedule, Add-EditRooms, Search-FilterRooms, RoomsMgmt CSS |
| `#22c55e` | Tailwind green-500 | Home, RoomLists, RoomsMgmt, FacultyProfiles |
| `#059669` | Tailwind emerald-600 | RoomLists, UploadCSV, ScheduleDetails, RoomsMgmt |
| `#38a169` | Chakra green-500 | CoursesManagement, ClassSchedules CSS |

### Role/Status Colors (duplicated across files)
| Role | Color | Files |
|------|-------|-------|
| Admin/Warning | `#f59e0b` | FacultyColleges, FacultyLists, FacultyProfiles, FacultyApproval, GenerateSchedule |
| Dept Head | `#8b5cf6` | FacultyColleges, FacultyLists, FacultyProfiles, GenerateSchedule |
| Program Chair | `#ec4899` | FacultyColleges, FacultyLists, FacultyProfiles, GenerateSchedule |
| Coordinator | `#06b6d4` | FacultyColleges, FacultyLists, FacultyProfiles |
| Staff | `#64748b` | FacultyColleges, FacultyLists, FacultyProfiles |
| Faculty/Success | `#22c55e` | FacultyProfiles + multiple CSS files |
| Error/Danger | `#ef4444` | FacultyApproval, TeachingLoad, FacultyLists, RoomLists, MapViewer |
| Red-dark | `#dc2626` | RoomLists, GenerateSchedule, Add-EditRooms |

### Room Type Badge Colors (duplicated)
| Type | Color | Files |
|------|-------|-------|
| Lecture | `#16a34a` | Add-EditRooms, Search-FilterRooms CSS |
| Laboratory | `#9333ea` | Add-EditRooms, Search-FilterRooms CSS |
| Computer Lab | `#2563eb` | Add-EditRooms, Search-FilterRooms CSS |
| Auditorium | `#d97706` | Add-EditRooms, Search-FilterRooms CSS |

### Room Status Colors (duplicated)
| Status | Color/BgColor | Files |
|--------|---------------|-------|
| Usable | `#059669` / `#d1fae5` | RoomsManagement, RoomLists&Details (TSX + CSS) |
| Not Usable | `#dc2626` / `#fee2e2` | RoomsManagement, RoomLists&Details |
| Maintenance | `#d97706` / `#fef3c7` | RoomsManagement, RoomLists&Details |

### Schedule Block Colors
| Context | Colors | File |
|---------|--------|------|
| Course blocks | 16 material design colors | ViewSchedule/page.tsx |
| Pastel backgrounds | 6 pastel colors (duplicated at L1573 & L2450) | ViewSchedule/page.tsx |
| Unscheduled reasons | 8 category colors | GenerateSchedule/page.tsx |

### Info/Help Box Colors (UploadCSV)
| Semantic | Icon | Strong Text |
|----------|------|-------------|
| Info | `#2563eb` | `#1e40af` |
| Success | `#059669` | `#065f46` |
| Warning | `#d97706` | `#92400e` |

---

## 6. Duplicated Color Patterns

### Pattern 1: `getRoleInfo()` / `getRoleColor()` / `getEmploymentBadge()`
Defined independently in **4 files** with the same colors:
- `FacultyColleges/page.tsx` (L102, L119)
- `FacultyLists/page.tsx` (L115, L140)
- `FacultyProfiles/page.tsx` (L145, L199, L215)
- These return objects like `{ color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' }`

**Recommendation**: Extract to a shared `utils/roleColors.ts` utility.

### Pattern 2: `getRoomStatusInfo()`
Identical function in **2 files**:
- `RoomsManagement/page.tsx` (L119)
- `RoomLists&Details/page.tsx` (L53)

**Recommendation**: Extract to shared `utils/roomUtils.ts`.

### Pattern 3: `FOLDER_COLORS`
Similar but not identical arrays in:
- `CoursesManagement/page.tsx` (8 entries, includes `var(--primary-gradient)`)
- `RoomsManagement/page.tsx` (6 entries, all hardcoded)

### Pattern 4: Room Type Badge Colors
Identical CSS classes in:
- `Add-EditRooms/styles.module.css`
- `Search-FilterRooms/styles.module.css`

---

## 7. Theme Selector Inconsistencies

### Using `:global([data-theme="green"])`
1. `ClassSchedules.module.css`
2. `FacultyApproval/styles.module.css`
3. `ProfileChangeRequests/styles.module.css`
4. `ViewSchedule/ViewSchedule.module.css`
5. `ScheduleDetailsModal.module.css`

### Using bare `[data-theme="green"]` (without `:global`)
1. `FacultyDepartments/styles.module.css`
2. `FacultyLists/FacultyLists.module.css`
3. `FacultyProfiles/styles.module.css`
4. `GenerateSchedule/GenerateSchedule.module.css`
5. `MapViewer/styles.module.css`
6. `RoomsManagement/styles.module.css`

### Using plain CSS selectors (no module)
1. `Home/styles.css`

### No theme switching at all
1. `Alerts/styles.module.css` ❌
2. `TeachingLoadAssignment/styles.module.css` (uses CSS vars but no theme blocks)
3. `UploadCSV/styles/bQtime.module.css` (uses CSS vars but no theme blocks)

**Note**: In CSS Modules, bare `[data-theme="green"]` may not work correctly since the parent `<html>` element is outside the module scope. The `:global()` wrapper is the correct approach for CSS Modules.

---

## 8. Recommendations

### Priority 1: Fix Critical Theme Breaks
1. **Alerts/styles.module.css** — Rewrite with CSS vars + add `[data-theme]` overrides for all three themes
2. **Profile/styles.module.css** — Replace dark green fallback values with neutral/light fallbacks
3. **ProfileChangeRequests/styles.module.css** — Change default from dark navy to match the standard base theme

### Priority 2: Centralize Duplicated Color Logic
4. Create `app/LandingPages/utils/colorUtils.ts`:
   - Export `getRoleInfo()`, `getRoleColor()`, `getEmploymentBadge()`, `getOnlineStatus()`
   - Export `getRoomStatusInfo()`
   - Export `FOLDER_COLORS`, `ROOM_TYPE_COLORS`
5. Update all 6+ consumer files to import from shared utility

### Priority 3: Standardize Green Palette
6. Pick ONE green palette and use it everywhere:
   - **Option A**: Keep `#2EAF7D`/`#449342`/`#3FD0C9` (current theme vars)
   - **Option B**: Migrate to Tailwind emerald: `#10b981`/`#059669`/`#34d399`
7. Update MapViewer to use the same green palette as all other files

### Priority 4: Fix Theme Selectors in CSS Modules
8. All CSS Module files using bare `[data-theme="green"]` should be updated to `:global([data-theme="green"])` for correctness:
   - FacultyDepartments, FacultyLists, FacultyProfiles, GenerateSchedule, MapViewer, RoomsManagement

### Priority 5: Convert Hardcoded Colors to CSS Variables
9. Add semantic CSS vars to `globals.css`:
   ```css
   --color-success: #059669;
   --color-error: #dc2626;
   --color-warning: #d97706;
   --color-info: #2563eb;
   --color-success-bg: #d1fae5;
   --color-error-bg: #fee2e2;
   --color-warning-bg: #fef3c7;
   --color-info-bg: #dbeafe;
   ```
10. Replace hardcoded status/semantic colors throughout all CSS files

### Priority 6: Address Remaining Issues
11. Convert `Home/styles.css` to CSS Modules to prevent global style leaks
12. Remove `!important` from Home stat icon colors
13. Deduplicate ViewSchedule's pastel palette (defined twice at L1573 and L2450)
14. Consider making `ROOM_TYPE_COLORS` in MapViewer and room type badge colors in CSS share a single source of truth

---

## Appendix: Files by Severity

### 🔴 Needs Immediate Attention (3)
- `Alerts/styles.module.css` — No theme support
- `Profile/styles.module.css` — Old dark green fallbacks
- `ProfileChangeRequests/styles.module.css` — Wrong default theme

### 🟠 Needs Cleanup (12)
- `Home/styles.css` — Plain CSS with many hardcoded colors
- `FacultyColleges/page.tsx` — Duplicated getRoleInfo
- `FacultyLists/page.tsx` — Duplicated getRoleColor
- `FacultyProfiles/page.tsx` — Duplicated getRoleInfo + getOnlineStatus
- `RoomsManagement/page.tsx` — Duplicated getRoomStatusInfo + FOLDER_COLORS
- `RoomLists&Details/page.tsx` — Duplicated getRoomStatusInfo
- `MapViewer/page.tsx + styles` — Wrong green palette
- `GenerateSchedule/page.tsx` — Many inline hardcoded colors
- `ViewSchedule/page.tsx` — Duplicated palette + many hardcoded
- `UploadCSV/page.tsx` — Hardcoded help text colors
- `TeachingLoadAssignment/styles.module.css` — Hardcoded grays

### 🟢 Good / Minor Issues (6)
- `FacultyApproval/styles.module.css`
- `FacultyDepartments/styles.module.css`
- `FacultyProfiles/styles.module.css`
- `Search-FilterRooms/styles.module.css`
- `UploadCSV/styles/bQtime.module.css` ← **BEST EXAMPLE**
- `ClassSchedules.module.css`

---

*Report generated from comprehensive audit of all 41 files in the LandingPages directory.*
