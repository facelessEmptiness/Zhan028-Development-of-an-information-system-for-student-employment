import { apiClient } from './client';
import type {
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  AuthResponse,
  User,
  TokenResponse,
  VerifyEmailRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
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

  async register(data: RegisterRequest): Promise<RegisterResponse> {
    return apiClient.request<RegisterResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async verifyEmail(data: VerifyEmailRequest): Promise<AuthResponse> {
    return apiClient.request<AuthResponse>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async resendVerification(email: string): Promise<{ message: string }> {
    return apiClient.request<{ message: string }>('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async forgotPassword(data: ForgotPasswordRequest): Promise<{ message: string }> {
    return apiClient.request<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async resetPassword(data: ResetPasswordRequest): Promise<{ message: string }> {
    return apiClient.request<{ message: string }>('/api/auth/reset-password', {
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
