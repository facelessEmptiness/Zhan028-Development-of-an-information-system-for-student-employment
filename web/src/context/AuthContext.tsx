import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi } from '../api';
import type { User, LoginRequest, RegisterRequest, AuthContextType } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem(ACCESS_TOKEN_KEY));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem(REFRESH_TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!accessToken;

  useEffect(() => {
    const initAuth = async () => {
      const savedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (savedAccessToken) {
        try {
          const currentUser = await authApi.getProfile(savedAccessToken);
          setUser(currentUser);
          setAccessToken(savedAccessToken);
        } catch {
          // Token might be expired, try to refresh
          const savedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
          if (savedRefreshToken) {
            try {
              const newTokens = await authApi.refreshToken(savedRefreshToken);
              localStorage.setItem(ACCESS_TOKEN_KEY, newTokens.access_token);
              localStorage.setItem(REFRESH_TOKEN_KEY, newTokens.refresh_token);
              setAccessToken(newTokens.access_token);
              setRefreshToken(newTokens.refresh_token);
              const currentUser = await authApi.getProfile(newTokens.access_token);
              setUser(currentUser);
            } catch {
              // Refresh failed, clear everything
              localStorage.removeItem(ACCESS_TOKEN_KEY);
              localStorage.removeItem(REFRESH_TOKEN_KEY);
              setAccessToken(null);
              setRefreshToken(null);
            }
          } else {
            localStorage.removeItem(ACCESS_TOKEN_KEY);
            setAccessToken(null);
          }
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    const response = await authApi.login(data);
    localStorage.setItem(ACCESS_TOKEN_KEY, response.tokens.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.tokens.refresh_token);
    setAccessToken(response.tokens.access_token);
    setRefreshToken(response.tokens.refresh_token);
    setUser(response.user);
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const response = await authApi.register(data);
    localStorage.setItem(ACCESS_TOKEN_KEY, response.tokens.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.tokens.refresh_token);
    setAccessToken(response.tokens.access_token);
    setRefreshToken(response.tokens.refresh_token);
    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, refreshToken, isAuthenticated, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
