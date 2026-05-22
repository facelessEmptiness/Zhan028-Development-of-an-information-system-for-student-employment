import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import { authService, type User, type RegisterInput } from '../services/authService';
import { pushService } from '../services/pushService';
import i18n from '../i18n';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterInput) => Promise<{ email: string }>;
  resetActivity: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const lastActiveRef         = useRef<number>(Date.now());
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    authService.getStoredUser().then(u => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const resetActivity = () => {
    lastActiveRef.current = Date.now();
  };

  const handleInactivityLogout = async () => {
    if (!user) return;
    const t = i18n.t.bind(i18n);
    Alert.alert(t('auth.sessionExpired'), t('auth.sessionExpiredText'));
    await authService.logout();
    setUser(null);
  };

  // Schedule inactivity check on AppState changes
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        const idle = Date.now() - lastActiveRef.current;
        if (idle >= SESSION_TIMEOUT_MS && user) {
          handleInactivityLogout();
        } else {
          resetActivity();
        }
      } else {
        // App went to background — record time
        lastActiveRef.current = Date.now();
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // In-app idle timer — reset on activity
  useEffect(() => {
    if (!user) return;
    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const idle = Date.now() - lastActiveRef.current;
        if (idle >= SESSION_TIMEOUT_MS) handleInactivityLogout();
        else schedule();
      }, SESSION_TIMEOUT_MS);
    };
    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const login = async (email: string, password: string) => {
    const data = await authService.login(email, password);
    resetActivity();
    setUser(data.user);
    pushService.registerForPushNotifications().then(token => {
      if (token) pushService.syncTokenWithServer(token);
    });
  };

  const logout = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    try { await authService.logout(); } catch {}
    setUser(null);
  };

  const register = async (data: RegisterInput) => {
    return authService.register(data);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, resetActivity }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
