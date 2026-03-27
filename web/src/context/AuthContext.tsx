import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { authApi } from '../api';
import type { User, LoginRequest, RegisterRequest, RegisterResponse, TokenResponse, AuthContextType } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const LAST_ACTIVITY_KEY = 'last_activity';
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 минут

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem(ACCESS_TOKEN_KEY));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem(REFRESH_TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAuthenticated = !!user && !!accessToken;

  const clearSession = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  const resetInactivityTimer = useCallback(() => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      clearSession();
    }, INACTIVITY_TIMEOUT_MS);
  }, [clearSession]);

  // Слушаем активность пользователя
  useEffect(() => {
    if (!isAuthenticated) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [isAuthenticated, resetInactivityTimer]);

  useEffect(() => {
    const initAuth = async () => {
      const savedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (savedAccessToken) {
        // Проверяем не истекла ли сессия по неактивности
        const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (lastActivity && Date.now() - parseInt(lastActivity) > INACTIVITY_TIMEOUT_MS) {
          clearSession();
          setIsLoading(false);
          return;
        }

        try {
          const currentUser = await authApi.getProfile(savedAccessToken);
          setUser(currentUser);
          setAccessToken(savedAccessToken);
        } catch {
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
              clearSession();
            }
          } else {
            clearSession();
          }
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, [clearSession]);

  const login = useCallback(async (data: LoginRequest) => {
    const response = await authApi.login(data);
    localStorage.setItem(ACCESS_TOKEN_KEY, response.tokens.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.tokens.refresh_token);
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    setAccessToken(response.tokens.access_token);
    setRefreshToken(response.tokens.refresh_token);
    setUser(response.user);
  }, []);

  // register теперь возвращает {message, email} — токены не выдаются до верификации
  const register = useCallback(async (data: RegisterRequest): Promise<RegisterResponse> => {
    return authApi.register(data);
  }, []);

  // Используется после успешной верификации email
  const loginWithTokens = useCallback((tokens: TokenResponse, userData: User) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    setAccessToken(tokens.access_token);
    setRefreshToken(tokens.refresh_token);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    clearSession();
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{ user, accessToken, refreshToken, isAuthenticated, isLoading, login, register, loginWithTokens, logout }}>
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
