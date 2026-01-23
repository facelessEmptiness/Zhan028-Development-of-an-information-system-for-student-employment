import { apiClient } from './client';
import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
  TokenResponse,
  CreateStudentProfileRequest,
  UpdateStudentProfileRequest,
  StudentProfileResponse,
} from '../types/auth';

// Refresh token request type
interface RefreshRequest {
  refresh_token: string;
}

export const authApi = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    return apiClient.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    return apiClient.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getProfile(token: string): Promise<User> {
    return apiClient.request<User>('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    return apiClient.request<TokenResponse>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken } as RefreshRequest),
    });
  },
};

// Student profile API - calls /api/students/profile
export const studentApi = {
  async createProfile(token: string, data: CreateStudentProfileRequest): Promise<StudentProfileResponse> {
    return apiClient.request<StudentProfileResponse>('/api/students/profile', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
  },

  async getProfile(token: string): Promise<StudentProfileResponse> {
    return apiClient.request<StudentProfileResponse>('/api/students/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  async updateProfile(token: string, data: UpdateStudentProfileRequest): Promise<StudentProfileResponse> {
    return apiClient.request<StudentProfileResponse>('/api/students/profile', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
  },
};
