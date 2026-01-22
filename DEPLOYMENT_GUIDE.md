# 🚀 Deployment Guide - BulSU Quantum-Inspired Scheduling System

## Overview

This guide covers deploying:
1. **Frontend (Next.js)** → Vercel
2. **Backend (FastAPI)** → Render

---

## 📋 Prerequisites

Before deploying, ensure you have:
- [ ] GitHub account with repository access
- [ ] Supabase project created (https://supabase.com)
- [ ] Vercel account (https://vercel.com)
- [ ] Render account (https://render.com)

---

## 🗄️ Step 1: Supabase Setup

### 1.1 Create Tables
Run the SQL schema files in this order:
```
1. database/supabase_schema.sql
2. database/floor_plans_schema.sql
3. database/qia_classroom_schema.sql
4. database/faculty_approval_migration.sql
```

### 1.2 Get API Keys
From Supabase Dashboard → Settings → API:
- **Project URL**: `https://xxxxx.supabase.co`
- **Anon Key**: `eyJhbGc...` (public)
- **Service Role Key**: `eyJhbGc...` (secret - for backend only)

---

## 🎨 Step 2: Deploy Frontend to Vercel

### 2.1 Connect Repository
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Set the **Root Directory** to: `my-app`

### 2.2 Configure Environment Variables
Add these variables in Vercel project settings:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` |
| `NEXT_PUBLIC_API_URL` | `https://qia-scheduler-api.onrender.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | `your-service-role-key` |

### 2.3 Deploy
1. Click **"Deploy"**
2. Wait for build to complete (~2-3 minutes)
3. Note your domain: `https://your-project.vercel.app`

---

## ⚙️ Step 3: Deploy Backend to Render

### 3.1 Create Web Service
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `qia-scheduler-api`
   - **Root Directory**: `my-app/backend`
   - **Runtime**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 3.2 Configure Environment Variables

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `your-service-role-key` |
| `FRONTEND_URL` | `https://your-project.vercel.app` |
| `PYTHON_VERSION` | `3.11` |

### 3.3 Deploy
1. Click **"Create Web Service"**
2. Wait for deployment (~3-5 minutes)
3. Note your API URL: `https://qia-scheduler-api.onrender.com`

---

## 🔗 Step 4: Connect Frontend to Backend

After both are deployed:

1. **Update Vercel environment variable:**
   - `NEXT_PUBLIC_API_URL` = Your Render URL

2. **Redeploy Vercel** (Deployments → Latest → Redeploy)

---

## ✅ Verification Checklist

### Backend Health Check
```bash
curl https://qia-scheduler-api.onrender.com/health
```
Expected: `{"status":"healthy",...}`

### Frontend Test
1. Open your Vercel URL
2. Try logging in
3. Navigate to each section

---

## 🐛 Troubleshooting

### "Cannot connect to backend"
- Ensure Render service is running
- Check `NEXT_PUBLIC_API_URL` is correct
- Verify CORS is configured (check `main.py`)

### "Supabase error"
- Verify all environment variables are set
- Check Supabase RLS policies allow access
- Ensure tables are created

### "Build failed on Vercel"
- Check Node.js version compatibility
- Review build logs for missing dependencies
- Try clearing cache and redeploying

### "Build failed on Render"
- Ensure `requirements.txt` is in backend folder
- Check Python version (3.11 recommended)
- Review build logs for import errors

---

## 📊 Performance Tips

1. **Render Cold Starts**: Free tier sleeps after 15 min of inactivity
   - Consider upgrading to Starter plan for production
   - Or use a uptime service to ping every 14 minutes

2. **Vercel Edge**: Uses serverless, may have cold starts
   - API routes auto-scale
   - Consider Edge runtime for faster responses

3. **Supabase**: 
   - Enable Row Level Security for production
   - Set up database indexes for frequently queried columns

---

## 🔐 Security Checklist

- [ ] Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend
- [ ] Enable Supabase RLS policies
- [ ] Use HTTPS for all endpoints
- [ ] Validate all user inputs
- [ ] Set proper CORS origins

---

## 📞 Support

If you encounter issues:
1. Check the browser console for errors
2. Review Vercel/Render deployment logs
3. Check Supabase logs for database errors
4. Open an issue on GitHub with error details

---

Last updated: 2025
