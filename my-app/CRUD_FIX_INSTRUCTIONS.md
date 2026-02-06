# 🔧 CRUD Operations Fix - Implementation Guide

## 🚨 YOUR ISSUE: "UI says success but database doesn't change"

This happens because **Row Level Security (RLS)** is blocking your operations. When RLS blocks a mutation, Supabase returns `{ data: null, error: null }` - no error, but 0 rows affected. Your UI shows "success" but nothing changed.

### ⚡ IMMEDIATE FIX (Pick ONE):

**Option A: Disable RLS (Quickest - for development)**
1. Go to [Supabase SQL Editor](https://supabase.com/dashboard)
2. Copy and paste the content from `database/QUICK_FIX_RLS.sql`
3. Click "Run"

**Option B: Use Service Role Key (Recommended for production)**
1. Go to Supabase Dashboard → Settings → API
2. Copy the `service_role` key (secret, not anon key)
3. Add to `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
4. Restart your dev server: `npm run dev`

---

## 🚨 CRITICAL: RLS (Row Level Security) Setup

### For Development (Quick Fix):
Run this in Supabase SQL Editor:
```sql
-- database/QUICK_FIX_RLS.sql
```

### For Production (Secure):
Run this in Supabase SQL Editor:
```sql
-- database/SECURE_RLS_POLICIES.sql
```

This gives:
- ✅ **Admin (admin123@ms.bulsu.edu.ph)**: FULL access to everything
- ✅ **Faculty accounts**: Limited access to their own data
- ✅ **Service role**: Full access for backend operations

### If Locked Out:
```sql
-- database/EMERGENCY_ROLLBACK.sql
```

---

## ✅ What Was Fixed

### 1. **Supabase Client Architecture** (NEW)
Created proper Next.js 15+ SSR-compatible Supabase clients:
- `lib/supabase/server.ts` - Server-side client with RLS support
- `lib/supabase/client.ts` - Browser client for "use client" components

### 2. **Updated API Routes**
Fixed these routes to use `createAdminClient()`:
- ✅ `/api/alerts/route.ts`
- ✅ `/api/alerts/[id]/route.ts`
- ✅ `/api/attendance/route.ts`
- ✅ `/api/faculty-registration/route.ts`
- ✅ `/api/profile-change-requests/route.ts`
- ✅ `/api/password-reset/route.ts`

### 3. **Package Dependencies**
Added `@supabase/ssr` to package.json for SSR support.

---

## 🚀 Required Actions (DO THESE NOW)

### Step 1: Install Dependencies
```bash
cd my-app
npm install
```

This will install `@supabase/ssr@^0.5.2`.

### Step 2: Restart Development Server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

### Step 3: Update Remaining API Routes
The following routes still need manual updates:

#### Priority 1 (Admin CRUD):
- `app/api/auth/register/route.ts`
- `app/api/auth/verify/route.ts`
- `app/api/faculty-default-schedule/route.ts`
- `app/api/admin/confirm-email/route.ts`

#### Priority 2 (Other features):
- `app/api/presence/route.ts`
- `app/api/faculty-registration/debug/route.ts`
- `app/api/schedule/qia-generate/route.ts`

**Pattern to Apply:**

**OLD** (❌ Remove):
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST() {
  // Uses supabaseAdmin
}
```

**NEW** (✅ Use):
```typescript
import { createAdminClient } from '@/lib/supabase/server'

export async function POST() {
  const supabaseAdmin = createAdminClient()
  // Now uses local supabaseAdmin instance
}
```

---

## 🛡️ RLS (Row Level Security) Configuration

The "UNRESTRICTED" badges in your screenshot indicate missing RLS policies. You need to set these up in Supabase Dashboard.

### Critical Tables Needing RLS:
1. `class_schedules`
2. `campuses`
3. `class_schedules_summary`
4. `departments`
5. `faculty`
6. `faculty_attendance`
7. `faculty_profiles`
8. `generated_schedules`
9. `room_allocations`
10. `system_alerts`
11. `teaching_loads`

### Example RLS Policy (for `class_schedules`):

```sql
-- Allow admins full access
CREATE POLICY "Admins can do everything"
ON public.class_schedules
FOR ALL
USING (
  auth.jwt() ->> 'role' = 'admin' 
  OR 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Allow faculty to read their own schedules
CREATE POLICY "Faculty can view their schedules"
ON public.class_schedules
FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM public.faculty_profiles 
    WHERE faculty_id = class_schedules.assigned_faculty_id
  )
);
```

Apply similar policies to all tables based on your access requirements.

---

## 🧪 Testing Checklist

After implementing fixes, test these operations:

### Admin Panel Tests:
- [ ] Create new class schedule
- [ ] Update existing schedule
- [ ] Delete schedule
- [ ] Approve faculty registration
- [ ] Reject faculty registration
- [ ] Create system alert
- [ ] Delete system alert

### Faculty Panel Tests:
- [ ] View own schedules
- [ ] Update profile
- [ ] Submit profile change request
- [ ] Mark attendance

---

## 🔍 Debugging Tips

### If CRUD still fails:

1. **Check Environment Variables**:
   ```bash
   echo $SUPABASE_SERVICE_ROLE_KEY
   ```

2. **Check Browser Console**:
   - Look for 403 (Forbidden) or 401 (Unauthorized) errors
   - Check Network tab for failed API calls

3. **Check Server Logs**:
   - Terminal running `npm run dev`
   - Look for "Auth error" or "RLS policy" messages

4. **Verify Supabase Keys**:
   - Go to: https://supabase.com/dashboard/project/kvumxksxecdpfbryjnsi/settings/api
   - Confirm anon key and service role key match `.env.local`

---

## 📝 Migration from Old to New Pattern

### Component Updates Needed:

**Server Components** (no "use client"):
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function MyComponent() {
  const supabase = await createClient()
  const { data } = await supabase.from('table').select()
  // ... rest
}
```

**Client Components** ("use client"):
```typescript
'use client'
import { createClient } from '@/lib/supabase/client'

export default function MyComponent() {
  const supabase = createClient()
  // ... rest
}
```

---

## 📚 Resources

- [Supabase SSR Guide](https://supabase.com/docs/guides/auth/server-side-rendering)
- [Next.js 15 Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)

---

## ⚠️ Security Reminders

1. **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` client-side
2. **ALWAYS** use `NEXT_PUBLIC_` prefix only for anon key
3. **ENABLE** RLS on all tables before production
4. **IMPLEMENT** proper RLS policies for each role (admin/faculty)

---

## 🆘 Need Help?

If issues persist after following this guide:
1. Check Supabase logs: https://supabase.com/dashboard/project/kvumxksxecdpfbryjnsi/logs
2. Verify all API routes use `createAdminClient()`
3. Ensure RLS policies are configured
4. Check browser console &amp; server logs for specific errors
