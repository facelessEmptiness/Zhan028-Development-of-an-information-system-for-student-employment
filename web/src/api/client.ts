// API client configuration
// In development, Vite proxy handles /api requests, so we use empty string
// In production, use the configured API URL
const API_URL = import.meta.env.VITE_API_URL || '';
const API_GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || '';

// Error response from backend
interface ApiErrorResponse {
  error: string;
  message: string;
  details?: Record<string, string>;
}

export class ApiError extends Error {
  statusCode: number;
  error: string;
  details?: Record<string, string>;

  constructor(
    statusCode: number,
    error: string,
    message: string,
    details?: Record<string, string>
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.error = error;
    this.details = details;
  }
}

export const apiClient = {
  baseURL: API_URL,
  gatewayURL: API_GATEWAY_URL,

  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      // Try to parse error response from backend
      try {
        const errorData: ApiErrorResponse = await response.json();
        throw new ApiError(
          response.status,
          errorData.error || 'Error',
          errorData.message || response.statusText,
          errorData.details
        );
      } catch (e) {
        if (e instanceof ApiError) throw e;
        throw new ApiError(response.status, 'Error', response.statusText);
      }
    }

    return response.json();
  },
};
