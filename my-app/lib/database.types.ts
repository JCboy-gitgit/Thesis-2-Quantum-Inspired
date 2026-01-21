// ============================================================================
// SUPABASE DATABASE TYPES FOR QIA CLASSROOM SCHEDULING SYSTEM
// ============================================================================
// These TypeScript types match the database schema in qia_classroom_schema.sql
// ============================================================================

// ============================================================================
// ENUMS
// ============================================================================

export type UserRole = 'admin' | 'sub_admin' | 'faculty';
export type RoomType = 'lecture' | 'laboratory' | 'computer_lab' | 'drawing_room' | 'auditorium' | 'conference' | 'other';
export type ScheduleStatus = 'pending' | 'scheduled' | 'conflict' | 'cancelled';
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type EmploymentType = 'full-time' | 'part-time' | 'contractual';

// ============================================================================
// USER & AUTH
// ============================================================================

export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  email: string;
  full_name?: string;
  role: UserRole;
  department_id?: number;
  department?: string;
  phone?: string;
  avatar_url?: string;
  status?: UserStatus;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

// User Profiles for extended info
export interface UserProfile {
  user_id: string;
  contact_phone?: string;
  office_location?: string;
  bio?: string;
  specialization?: string;
  updated_at?: string;
}

// Faculty Profiles (from CSV imports)
export type FacultyRole = 'administrator' | 'department_head' | 'program_chair' | 'coordinator' | 'faculty' | 'staff';

export interface FacultyProfile {
  id: string;
  faculty_id: string;
  full_name: string;
  position: string;
  role: FacultyRole;
  department?: string;
  college?: string;
  email?: string;
  phone?: string;
  office_location?: string;
  employment_type?: EmploymentType | 'adjunct' | 'guest';
  is_active: boolean;
  profile_image?: string;
  bio?: string;
  specialization?: string;
  education?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// DEPARTMENT
// ============================================================================

export interface Department {
  id: number;
  department_code: string;
  department_name: string;
  college?: string;
  head_name?: string;
  head_email?: string;
  contact_phone?: string;
  office_location?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// ROOMS
// ============================================================================

export interface Room {
  id: number;
  upload_group_id?: number;
  room_code: string;
  room_name?: string;
  building: string;
  floor_number: number;
  capacity: number;
  room_type: RoomType;
  has_ac: boolean;
  has_projector: boolean;
  has_whiteboard: boolean;
  has_computers: number;
  has_lab_equipment: boolean;
  is_accessible: boolean;
  is_active: boolean;
  notes?: string;
  file_name?: string;
  created_at: string;
  updated_at: string;
}

// Insert type for creating new rooms (omit auto-generated fields)
export type RoomInsert = Omit<Room, 'id' | 'created_at' | 'updated_at'> & {
  id?: number;
  created_at?: string;
  updated_at?: string;
};

// Update type for updating rooms (all fields optional except id)
export type RoomUpdate = Partial<Omit<Room, 'id' | 'created_at' | 'updated_at'>>;

export interface RoomFile {
  upload_group_id: number;
  file_name: string;
  created_at: string;
  total_rooms: number;
  total_capacity: number;
  building_count: number;
}

export interface RoomStats {
  totalRooms: number;
  totalCapacity: number;
  lectureRooms: number;
  labRooms: number;
  computerLabs: number;
  avgCapacity: number;
  buildings: number;
}

// ============================================================================
// FACULTY
// ============================================================================

export interface Faculty {
  id: number;
  upload_group_id?: number;
  faculty_id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  email?: string;
  phone?: string;
  department_id?: number;
  department?: Department;
  position?: string;
  employment_type: EmploymentType;
  max_units: number;
  current_units: number;
  is_active: boolean;
  file_name?: string;
  created_at: string;
  updated_at: string;
}

export interface FacultyAvailability {
  id: number;
  faculty_id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  preference_level: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FacultyFile {
  upload_group_id: number;
  file_name: string;
  created_at: string;
  total_faculty: number;
  department_count: number;
}

// ============================================================================
// COURSES
// ============================================================================

export interface Course {
  id: number;
  course_code: string;
  course_name: string;
  description?: string;
  department_id?: number;
  lecture_units: number;
  lab_units: number;
  total_units: number;
  lecture_hours: number;
  lab_hours: number;
  total_hours: number;
  requires_lab: boolean;
  requires_computer_lab: boolean;
  prerequisites?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CLASS SCHEDULES (from CSV uploads)
// ============================================================================

export interface ClassSchedule {
  id: number;
  upload_group_id: number;
  course_code: string;
  course_name?: string;
  section: string;
  lec_units: number;
  lab_units: number;
  credit_units: number;
  lec_hours: number;
  lab_hours: number;
  schedule_day?: string;
  schedule_time?: string;
  start_time?: string;
  end_time?: string;
  assigned_room_id?: number;
  assigned_room?: Room;
  assigned_faculty_id?: number;
  assigned_faculty?: Faculty;
  academic_year?: string;
  semester?: string;
  department?: string;
  college?: string;
  file_name?: string;
  status: ScheduleStatus;
  created_at: string;
  updated_at: string;
}

export interface ClassScheduleFile {
  upload_group_id: number;
  file_name: string;
  college?: string;
  department?: string;
  uploaded_at: string;
  total_classes: number;
  scheduled_count: number;
  pending_count: number;
  conflict_count: number;
  total_units: number;
}

// ============================================================================
// TEACHER SCHEDULES (from CSV uploads)
// ============================================================================

export interface TeacherSchedule {
  id: number;
  upload_group_id: number;
  teacher_id: string;
  teacher_name: string;
  department?: string;
  email?: string;
  schedule_day?: string;
  schedule_time?: string;
  start_time?: string;
  end_time?: string;
  is_available: boolean;
  schedule_type: string;
  college?: string;
  file_name?: string;
  created_at: string;
  updated_at: string;
}

export interface TeacherScheduleFile {
  upload_group_id: number;
  file_name: string;
  college?: string;
  uploaded_at: string;
  total_entries: number;
  unique_teachers: number;
}

// ============================================================================
// SCHEDULE GENERATION
// ============================================================================

export interface ScheduleGeneration {
  id: number;
  generation_name: string;
  academic_year?: string;
  semester?: string;
  class_schedule_group_id: number;
  teacher_schedule_group_id?: number;
  total_classes: number;
  scheduled_count: number;
  unscheduled_count: number;
  conflict_count: number;
  execution_time_seconds?: number;
  algorithm_used: string;
  status: GenerationStatus;
  error_message?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface GenerationConfig {
  classScheduleGroupId: number;
  teacherScheduleGroupId?: number;
  generationName: string;
  academicYear: string;
  semester: string;
  prioritizeLabRooms: boolean;
  avoidConflicts: boolean;
}

export interface GenerationResult {
  success: boolean;
  message: string;
  generation_id: number;
  scheduled_count: number;
  unscheduled_count: number;
  conflict_count: number;
  execution_time: number;
  allocations: RoomAllocation[];
}

// ============================================================================
// ROOM ALLOCATIONS
// ============================================================================

export interface RoomAllocation {
  id: number;
  generation_id: number;
  class_schedule_id: number;
  room_id?: number;
  faculty_id?: number;
  course_code?: string;
  course_name?: string;
  section?: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room_code?: string;
  building?: string;
  room_capacity?: number;
  room_type?: RoomType;
  faculty_name?: string;
  status: ScheduleStatus;
  conflict_reason?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TIME SLOTS
// ============================================================================

export interface TimeSlot {
  id: number;
  slot_name?: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  slot_type: string;
  is_active: boolean;
  created_at: string;
}

// ============================================================================
// CONFLICTS
// ============================================================================

export interface ScheduleConflict {
  id: number;
  generation_id: number;
  conflict_type: 'room_overlap' | 'faculty_overlap' | 'capacity_exceeded';
  day_of_week?: string;
  time_slot?: string;
  class_schedule_id_1?: number;
  class_schedule_id_2?: number;
  room_id?: number;
  faculty_id?: number;
  is_resolved: boolean;
  resolution_notes?: string;
  resolved_at?: string;
  resolved_by?: string;
  created_at: string;
}

// ============================================================================
// FILE UPLOADS
// ============================================================================

export interface FileUpload {
  id: number;
  upload_group_id: number;
  file_type: 'rooms' | 'class_schedule' | 'teacher_schedule' | 'faculty';
  file_name: string;
  original_name?: string;
  file_size?: number;
  row_count: number;
  college?: string;
  department?: string;
  academic_year?: string;
  semester?: string;
  status: string;
  error_message?: string;
  uploaded_by?: string;
  created_at: string;
}

// ============================================================================
// SYSTEM SETTINGS
// ============================================================================

export interface SystemSetting {
  id: number;
  setting_key: string;
  setting_value?: string;
  setting_type: string;
  description?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// UI HELPER TYPES
// ============================================================================

export interface DaySchedule {
  day: string;
  slots: RoomAllocation[];
}

export interface WeeklySchedule {
  room: Room;
  schedule: DaySchedule[];
}

export interface FacultyWeeklySchedule {
  faculty: Faculty;
  schedule: DaySchedule[];
  total_hours: number;
  total_units: number;
}

export interface RoomWeeklyView {
  roomId: number;
  roomCode: string;
  building: string;
  capacity: number;
  roomType: RoomType;
  monday: RoomAllocation[];
  tuesday: RoomAllocation[];
  wednesday: RoomAllocation[];
  thursday: RoomAllocation[];
  friday: RoomAllocation[];
  saturday: RoomAllocation[];
}

// ============================================================================
// TABLE NAMES
// ============================================================================

export const TABLE_NAMES = {
  USERS: 'users',
  DEPARTMENTS: 'departments',
  ROOMS: 'rooms',
  FACULTY: 'faculty',
  FACULTY_AVAILABILITY: 'faculty_availability',
  COURSES: 'courses',
  CLASS_SCHEDULES: 'class_schedules',
  TEACHER_SCHEDULES: 'teacher_schedules',
  SCHEDULE_GENERATIONS: 'schedule_generations',
  ROOM_ALLOCATIONS: 'room_allocations',
  TIME_SLOTS: 'time_slots',
  SCHEDULE_CONFLICTS: 'schedule_conflicts',
  FILE_UPLOADS: 'file_uploads',
  SYSTEM_SETTINGS: 'system_settings',
  AUDIT_LOGS: 'audit_logs',
} as const;

// ============================================================================
// ARCHIVED ITEMS
// ============================================================================

export type ArchivedItemType = 'csv_file' | 'department' | 'faculty' | 'schedule' | 'room';

export interface ArchivedItem {
  id: string;
  item_type: ArchivedItemType;
  item_name: string;
  item_data: Record<string, unknown>;
  deleted_at?: string;
  deleted_by?: string;
  original_table: string;
  original_id: string;
  created_at: string;
}

// ============================================================================
// CAMPUSES (from CSV uploads)
// ============================================================================

export interface Campus {
  id: number;
  upload_group_id: number;
  school_name: string;
  campus: string;
  building: string;
  room: string;
  capacity: number;
  file_name?: string;
  is_first_floor: boolean;
  floor_number?: number;
  room_type: string;
  has_ac: boolean;
  has_projector: boolean;
  has_whiteboard: boolean;
  is_pwd_accessible: boolean;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// DATABASE TYPE DEFINITION FOR SUPABASE CLIENT
// ============================================================================

// Generic insert type helper - makes id and timestamps optional
type InsertType<T> = Omit<T, 'id' | 'created_at' | 'updated_at'> & {
  id?: T extends { id: number } ? number : T extends { id: string } ? string : never;
  created_at?: string;
  updated_at?: string;
};

// Generic update type helper - all fields optional
type UpdateType<T> = Partial<Omit<T, 'id'>>;

// Table type structure for proper Supabase typing
type TableDefinition<TRow, TInsert = Partial<TRow>, TUpdate = Partial<TRow>> = {
  Row: TRow;
  Insert: TInsert;
  Update: TUpdate;
};

export interface Database {
  public: {
    Tables: {
      users: TableDefinition<User>;
      user_profiles: TableDefinition<UserProfile>;
      departments: TableDefinition<Department>;
      rooms: TableDefinition<Room>;
      faculty: TableDefinition<Faculty>;
      faculty_availability: TableDefinition<FacultyAvailability>;
      faculty_profiles: TableDefinition<FacultyProfile>;
      courses: TableDefinition<Course>;
      class_schedules: TableDefinition<ClassSchedule>;
      teacher_schedules: TableDefinition<TeacherSchedule>;
      schedule_generations: TableDefinition<ScheduleGeneration>;
      room_allocations: TableDefinition<RoomAllocation>;
      time_slots: TableDefinition<TimeSlot>;
      schedule_conflicts: TableDefinition<ScheduleConflict>;
      file_uploads: TableDefinition<FileUpload>;
      system_settings: TableDefinition<SystemSetting>;
      archived_items: TableDefinition<ArchivedItem>;
      campuses: TableDefinition<Campus>;
    };
    Views: {
      room_schedule_view: { Row: RoomAllocation };
      class_schedule_summary: { Row: ClassScheduleFile };
      teacher_schedule_summary: { Row: TeacherScheduleFile };
      room_utilization_view: { Row: { room_id: number; room_code: string; building: string; capacity: number; room_type: RoomType; allocated_slots: number; total_hours_used: number } };
    };
    Enums: {
      user_role: UserRole;
      room_type: RoomType;
    };
  };
}
