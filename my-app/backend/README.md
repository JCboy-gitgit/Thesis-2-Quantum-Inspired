# College Room Allocation Backend

A FastAPI-powered backend service that uses **Quantum-Inspired Simulated Annealing** to optimize classroom allocation for college schedules.

## Features

- 🏫 **Room Allocation Optimization**: Automatically assigns rooms to class sections
- 🔬 **Quantum-Inspired Algorithm**: Uses simulated annealing with quantum tunneling simulation
- 👨‍🏫 **Teacher Schedule Management**: Ensures no teacher conflicts
- 📊 **Real-time Analytics**: Room utilization and scheduling statistics
- 🔗 **Supabase Integration**: Direct database connectivity

## Tech Stack

- **FastAPI** - High-performance Python web framework
- **Pydantic** - Data validation using Python type annotations
- **NumPy/SciPy** - Numerical optimization
- **Supabase** - PostgreSQL database backend
- **Uvicorn** - ASGI server

## Project Structure

```
backend/
├── main.py           # FastAPI application & endpoints
├── models.py         # Pydantic models
├── database.py       # Supabase database operations
├── scheduler.py      # Quantum-inspired scheduling algorithm
├── requirements.txt  # Python dependencies
└── README.md         # This file
```

## Installation

1. **Create a virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables:**
   Create a `.env` file in the backend folder:
   ```env
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_KEY=your_supabase_anon_key
   FRONTEND_URL=http://localhost:3000
   ```

4. **Run the server:**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

## API Endpoints

### Health Check
- `GET /` - Basic health check
- `GET /health` - Detailed health status with DB connection

### Rooms
- `GET /api/rooms` - List all rooms (with optional filters)
- `GET /api/rooms/{room_id}` - Get room details
- `GET /api/rooms/{room_id}/utilization` - Get room utilization stats

### Sections
- `GET /api/sections` - List all sections

### Teachers
- `GET /api/teachers` - List all teachers

### Time Slots
- `GET /api/time-slots` - List available time slots

### Schedule Generation
- `POST /api/schedules/generate` - Generate a new schedule using quantum-inspired algorithm
- `GET /api/schedules` - List all schedules
- `GET /api/schedules/{id}` - Get schedule details
- `DELETE /api/schedules/{id}` - Delete a schedule

### Schedule Queries
- `GET /api/schedules/{id}/by-room/{room_id}` - Get schedule for a room
- `GET /api/schedules/{id}/by-teacher/{teacher_id}` - Get teacher schedule
- `GET /api/schedules/{id}/by-section/{section_id}` - Get section schedule
- `GET /api/schedules/{id}/by-day/{day}` - Get schedule for a day
- `GET /api/schedules/{id}/conflicts` - Check for conflicts

### Analytics
- `GET /api/analytics/room-utilization` - Room utilization statistics
- `GET /api/analytics/summary` - Overall scheduling summary

## Quantum-Inspired Algorithm

The scheduling algorithm uses **Simulated Annealing** enhanced with **quantum tunneling simulation**:

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `max_iterations` | 1000 | Maximum optimization iterations |
| `initial_temperature` | 100.0 | Starting temperature (randomness) |
| `cooling_rate` | 0.995 | Temperature decay rate per iteration |
| `max_teacher_hours_per_day` | 6 | Maximum teaching hours per teacher per day |
| `prioritize_accessibility` | false | Prefer accessible rooms |

### Algorithm Features

1. **Greedy Initial Solution**: Creates an initial feasible schedule
2. **Neighbor Generation**: Makes small changes (room, day, time swaps)
3. **Metropolis Criterion**: Accepts worse solutions with decreasing probability
4. **Quantum Tunneling**: 10% chance to make larger "jumps" to escape local minima
5. **Adaptive Cooling**: Temperature gradually decreases to converge on solution

### Cost Function Components

- **Hard Constraints** (high penalty):
  - Room double-booking
  - Teacher conflicts
  - Capacity violations

- **Soft Constraints** (lower penalty):
  - Room type mismatch
  - Excessive room capacity (wasteful)
  - Teacher workload imbalance

## Example Request

```bash
curl -X POST http://localhost:8000/api/schedules/generate \
  -H "Content-Type: application/json" \
  -d '{
    "schedule_name": "1st Semester 2024-2025",
    "semester": "1st Semester",
    "academic_year": "2024-2025",
    "max_iterations": 1000,
    "initial_temperature": 100,
    "cooling_rate": 0.995
  }'
```

## Example Response

```json
{
  "success": true,
  "schedule_id": 1,
  "message": "Schedule generated successfully",
  "total_sections": 50,
  "scheduled_sections": 48,
  "unscheduled_sections": 2,
  "optimization_stats": {
    "initial_cost": 5000.0,
    "final_cost": 150.0,
    "iterations": 1000,
    "improvements": 245,
    "quantum_tunnels": 87,
    "time_elapsed_ms": 2345
  },
  "conflicts": []
}
```

## Development

### Running Tests
```bash
pytest tests/
```

### API Documentation
Once the server is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Database Schema

The backend expects these Supabase tables:

```sql
-- rooms table
CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  room_code VARCHAR(50),
  room_name VARCHAR(100),
  building VARCHAR(100),
  campus VARCHAR(100),
  capacity INTEGER,
  room_type VARCHAR(50),
  floor INTEGER DEFAULT 1,
  is_accessible BOOLEAN DEFAULT false
);

-- sections table  
CREATE TABLE sections (
  id SERIAL PRIMARY KEY,
  section_code VARCHAR(50),
  course_code VARCHAR(50),
  course_name VARCHAR(200),
  teacher_id INTEGER,
  teacher_name VARCHAR(200),
  student_count INTEGER,
  required_room_type VARCHAR(50),
  weekly_hours INTEGER,
  requires_lab BOOLEAN DEFAULT false,
  department VARCHAR(100)
);

-- time_slots table
CREATE TABLE time_slots (
  id SERIAL PRIMARY KEY,
  slot_name VARCHAR(100),
  start_time TIME,
  end_time TIME,
  duration_minutes INTEGER
);

-- schedules table
CREATE TABLE schedules (
  id SERIAL PRIMARY KEY,
  schedule_name VARCHAR(200),
  semester VARCHAR(50),
  academic_year VARCHAR(20),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- schedule_entries table
CREATE TABLE schedule_entries (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER REFERENCES schedules(id),
  section_id INTEGER,
  room_id INTEGER,
  day_of_week VARCHAR(20),
  time_slot_id INTEGER,
  teacher_id INTEGER
);
```

## License

MIT License - Use freely for educational purposes.
