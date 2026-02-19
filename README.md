# 🎓 QIA Room Allocation System
### *Optimizing College Room Assignments using Quantum-Inspired Annealing*

[![Frontend: Next.js](https://img.shields.io/badge/Frontend-Next.js-000000?style=for-the-badge&logo=nextdotjs)](https://qia-room-allocation.vercel.app)
[![Backend: Python](https://img.shields.io/badge/Backend-Python-3776AB?style=for-the-badge&logo=python)](https://thesis-2-quantum-inspired.onrender.com/)
[![Database: Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Deployment: Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=for-the-badge&logo=vercel)](https://qia-room-allocation.vercel.app)
[![Deployment: Render](https://img.shields.io/badge/Deployed-Render-46E3B7?style=for-the-badge&logo=render)](https://thesis-2-quantum-inspired.onrender.com/)

---

## 📝 Project Overview
This project is a **College-based Thesis** developed by **Group 6**. We aim to solve the complex challenge of academic room allocation by applying **Quantum-Inspired Annealing (QIA)**. The system efficiently assigns classrooms based on schedules, student capacity, and specific equipment needs, ensuring minimal conflicts and maximum resource utility.

### 🔗 Project Links
- **Live Demo (Frontend):** [qia-room-allocation.vercel.app](https://qia-room-allocation.vercel.app)
- **API Endpoint (Backend):** [thesis-2-quantum-inspired.onrender.com](https://thesis-2-quantum-inspired.onrender.com/)

---

## 🏗️ System Architecture

The application follows a modern decoupled architecture:
1.  **Frontend (Next.js):** Provides a sleek, responsive interface for admins and students.
2.  **Backend (Python/FastAPI or Flask):** Houses the QIA algorithm, handling heavy computational tasks and optimization logic.
3.  **Database (Supabase):** Stores room data, user roles, and the final optimized schedules.

---

## ✨ Key Features

- **QIA Optimization:** Uses simulated quantum effects (like tunneling) to find optimal room assignments faster than traditional brute-force methods.
- **Automated Scheduling:** Reduces manual workload for school registrars and department heads.
- **Conflict Detection:** Real-time validation to ensure no two classes are assigned to the same room at the same time.
- **User Management:** Secure login and role-based access via Supabase Auth.

---

## 🛠️ Tech Stack & Tools

| Layer | Technology | Deployment |
| :--- | :--- | :--- |
| **Frontend** | Next.js, Tailwind CSS | Vercel |
| **Backend** | Python (Optimization Logic) | Render |
| **Database** | Supabase (PostgreSQL) | Supabase Cloud |
| **Version Control** | Git & GitHub | - |

---

## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone [https://github.com/your-username/your-repo-name.git](https://github.com/your-username/your-repo-name.git)
```

### 2. Set Up Frontend
``` bash
cd frontend
npm install
npm run dev
```

### 3. Set Up Backend
``` bash
cd backend
pip install -r requirements.txt
python app.py
```

### 3. Environment Variables
Create a .env file in the frontend directory:

``` Code snippet
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```




---

Group 6 Members
Member Watashiii - Lead Developer / Algorithm Specialist

Member Nicko Dalugdugan - Frontend Engineer / UI Design

Member John Clarence Nicolas - Database Administrator / QA

Member Fiona Ventura - Technical Writer / Documentation

Member Ray Franz - Researcher / Information
