export type UserRole = 'student' | 'employer' | 'university' | 'admin';

// User model matching backend response
export interface User {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Backend only accepts email, password, role
export interface RegisterRequest {
  email: string;
  password: string;
  role: UserRole;
}

// Token response from backend
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// Auth response matching backend
export interface AuthResponse {
  user: User;
  tokens: TokenResponse;
}

// Student profile types matching backend DTOs (snake_case)
export interface CreateStudentProfileRequest {
  first_name: string;
  last_name: string;
  iin: string;
  university_id?: string;
}

export interface UpdateStudentProfileRequest {
  first_name?: string;
  last_name?: string;
  university_id?: string;
}

export interface StudentProfileResponse {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  iin: string;
  university_id?: string;
  created_at: string;
  updated_at: string;
}

// Employer profile types (backend not implemented yet)
export interface EmployerProfile {
  bin: string;
  companyName: string;
  companyEmail: string;
  contactPhone: string;
}

// University profile types (backend not implemented yet)
export interface UniversityProfile {
  universityName: string;
  universityEmail: string;
  contactPhone: string;
}

export interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
}
