# Quick Start Checklist

Get your RL system running in 15 minutes!

## ✅ Checklist

### Backend Setup (5 min)

- [ ] Open `my-app/backend/main.py`
- [ ] Add these imports at the top:
  ```python
  from rl_api import rl_router, integrate_rl_with_qia
  ```
- [ ] Add this after `app = FastAPI(...)`:
  ```python
  app.include_router(rl_router)
  integrate_rl_with_qia(run_enhanced_scheduler)
  ```
- [ ] Save main.py
- [ ] Open terminal and run:
  ```bash
  cd my-app/backend
  python -m uvicorn main:app --reload --port 8000
  ```
- [ ] Wait for "Uvicorn running on http://127.0.0.1:8000"

### Frontend Setup (5 min)

- [ ] Files already exist in `my-app/app/LandingPages/RLScheduler/`
- [ ] Open new terminal and run:
  ```bash
  cd my-app
  npm run dev
  ```
- [ ] Wait for "ready - started server on..."

### Test It! (5 min)

- [ ] Open http://localhost:3000/LandingPages/RLScheduler
- [ ] Go to "📋 Rules" tab
- [ ] Add a test rule:
  - Rule ID: `test_rule`
  - Name: `Test Rule`
  - Description: `A test rule`
  - Penalty: `100`
- [ ] Click "+ Add Rule"
- [ ] ✅ Rule should appear in the list below
- [ ] Go to "🤖 Train Agent" tab
- [ ] Click "🚀 Start Training (5 episodes)"
- [ ] Watch progress bar fill (should take ~5 sec)
- [ ] Go to "📊 Statistics" tab
- [ ] See training results
- [ ] 🎉 Success!

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Frontend can't connect to backend | Backend must be running on port 8000 |
| "ModuleNotFoundError: rl_api" | Make sure rl_api.py is in backend folder |
| Dashboard looks broken (no styling) | Check CSS module import in page.tsx |
| Rules don't save | Make sure backend is still running |
| Training stuck at 0% | Check browser console for errors |

## Verify Everything Works

```bash
# Terminal 1 - Backend running?
curl http://localhost:8000/api/rl/stats
# Should return JSON with training stats

# Terminal 2 - Frontend running?
curl http://localhost:3000/LandingPages/RLScheduler
# Should return HTML page
```

## Next Actions

1. **Play with Rules**
   - Add 3-4 different rules
   - Try different penalty values
   - See which rules trigger

2. **Train Multiple Times**
   - Train once, check stats
   - Train again, see if reward improves
   - Repeat 5 times

3. **Customize Rules**
   - Edit rl_scheduler.py
   - Update check_fn functions
   - Test with real data

4. **Deploy**
   - Backend to Render
   - Frontend to Vercel
   - Test in production

## File Reference

If you need to find something:

```
Backend:
  rl_scheduler.py      ← Core RL engine
  rl_api.py            ← API endpoints
  main.py              ← ADD IMPORTS HERE
  
Frontend:
  RLScheduler/page.tsx        ← Dashboard
  RLScheduler/RLScheduler.module.css ← Styling
  
Docs:
  RL_INTEGRATION_GUIDE.md    ← Backend setup
  RL_FRONTEND_GUIDE.md       ← Frontend usage
  COMPLETE_RL_SYSTEM_SUMMARY.md ← Full overview
```

## Questions While Setting Up?

1. Check **COMPLETE_RL_SYSTEM_SUMMARY.md** for architecture
2. Check **RL_INTEGRATION_GUIDE.md** for backend details  
3. Check **RL_FRONTEND_GUIDE.md** for frontend details
4. Check inline code comments

---

**That's it! You're ready to learn! 🚀**
