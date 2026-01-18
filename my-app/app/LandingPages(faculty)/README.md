# Faculty Side Pages

This folder contains the faculty-side pages for the Qtime Scheduler system.

## Page Flow

1. **Faculty Register/Login** (`/` or `/faculty/login`)
   - Faculty can register with their details (name, email, department)
   - Approved faculty can login via `/faculty/login`

2. **Faculty Home** (`/faculty/home`)
   - Dashboard showing current/next class
   - Today's schedule overview
   - Quick actions

3. **Faculty Profile** (`/faculty/profile`)
   - Edit profile information
   - Update bio, specialization, contact info

## Notes

- Faculty must be approved by admin before they can login
- Faculty will receive email notification when approved/rejected
- All faculty pages are protected and require authentication
