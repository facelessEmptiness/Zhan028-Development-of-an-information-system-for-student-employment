import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context';
import { notificationService, type Notification } from '../services/notificationService';
import Icon from './Icon';
import FlagIcon from './FlagIcon';
import type { IconName } from './icons';
import type { FlagIconName } from './icons';

/* ─── Role meta ─────────────────────────────────────────────── */
const ROLE_PILL: Record<string, string> = {
  student:    'bg-blue-100 text-blue-700',
  employer:   'bg-green-100 text-green-700',
  university: 'bg-purple-100 text-purple-700',
  admin:      'bg-red-100 text-red-700',
};

const ROLE_AVATAR_GRAD: Record<string, string> = {
  student:    'linear-gradient(135deg,#3B82F6,#6366F1)',
  employer:   'linear-gradient(135deg,#EF2D30,#B91C1C)',
  university: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
  admin:      'linear-gradient(135deg,#EF4444,#B91C1C)',
};

function getProfilePath(role?: string) {
  if (role === 'student')    return '/profile';
  if (role === 'employer')   return '/employer-dashboard';
  if (role === 'university') return '/analytics';
  if (role === 'admin')      return '/admin';
  return '/';
}

function getNavLinks(t: (k: string) => string, role?: string) {
  const links = [{ to: '/jobs', label: t('nav.jobs') }];
  if (role === 'student')    links.push({ to: '/profile',            label: t('nav.myProfile')  });
  else if (role === 'employer')  links.push({ to: '/employer-dashboard', label: t('nav.dashboard') });
  else if (role === 'university') links.push({ to: '/analytics',    label: t('nav.analytics')  });
  else if (role === 'admin') {
    links.push({ to: '/admin', label: 'Администрирование' });
  }
  return links;
}

/* ─── Logo ──────────────────────────────────────────────────── */
function Logo() {
  return (
    <div style={{ width: 32, height: 32, flexShrink: 0 }}>
      <svg viewBox="0 0 32 32" width={32} height={32}>
        <rect width="32" height="32" rx="8" fill="#2563EB" />
        <path d="M10 13c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2v1h3v10H7V14h3v-1zm2 0v1h8v-1h-8z" fill="white" />
        <circle cx="16" cy="19" r="1.5" fill="#2563EB" />
      </svg>
    </div>
  );
}

/* ─── MatchRing for notifications preview ───────────────────── */
export default function Header() {
  const { t, i18n }                    = useTranslation();
  const { isAuthenticated, user, logout } = useAuth();
  const navigate                       = useNavigate();
  const location                       = useLocation();
  const [dropdownOpen,     setDropdownOpen]     = useState(false);
  const [notifOpen,        setNotifOpen]        = useState(false);
  const [notifications,    setNotifications]    = useState<Notification[]>([]);
  const [unreadCount,      setUnreadCount]      = useState(0);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [mobileMenuOpen,   setMobileMenuOpen]   = useState(false);

  const ROLE_LABELS: Record<string, string> = {
    student:    t('role.student'),
    employer:   t('role.employer'),
    university: t('role.university'),
    admin:      t('role.admin'),
  };

  const dropdownRef     = useRef<HTMLDivElement>(null);
  const notifRef        = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    const [nr, cr] = await Promise.allSettled([
      notificationService.list(),
      notificationService.unreadCount(),
    ]);
    if (nr.status === 'fulfilled') setNotifications(nr.value);
    if (cr.status === 'fulfilled') setUnreadCount(cr.value);
  }, [isAuthenticated]);

  // SSE real-time notifications
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications();

    let aborted = false;
    const ctrl = new AbortController();

    const connectSSE = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      try {
        const res = await fetch('/api/notifications/stream', {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error('SSE failed');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            try {
              const evt = JSON.parse(line.slice(5).trim());
              if (evt && evt.id) {
                setNotifications(prev => [evt, ...prev.filter(n => n.id !== evt.id)]);
                if (!evt.is_read) setUnreadCount(c => c + 1);
              }
            } catch { /* non-JSON ping */ }
          }
        }
      } catch {
        // SSE failed — fall back to polling every 30s
        if (!aborted) {
          const id = setTimeout(connectSSE, 30_000);
          return () => clearTimeout(id);
        }
      }
    };

    connectSSE();
    // Fallback polling every 60s in case SSE misses events
    const poll = setInterval(fetchNotifications, 60_000);
    return () => {
      aborted = true;
      ctrl.abort();
      clearInterval(poll);
    };
  }, [isAuthenticated, fetchNotifications]);

  const handleMarkAllRead = async () => {
    await notificationService.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleMarkRead = async (id: string) => {
    await notificationService.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current     && !dropdownRef.current.contains(e.target as Node))     setDropdownOpen(false);
      if (notifRef.current        && !notifRef.current.contains(e.target as Node))        setNotifOpen(false);
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) setLangDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setDropdownOpen(false);
    setNotifOpen(false);
    setLangDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout        = () => { logout(); navigate('/login'); };
  const handleLanguageChange = (lang: string) => { i18n.changeLanguage(lang); setLangDropdownOpen(false); };

  const avatarLetter = user?.email?.[0]?.toUpperCase() ?? '?';
  const navLinks     = getNavLinks(t, user?.role);
  const avatarGrad   = ROLE_AVATAR_GRAD[user?.role ?? 'student'] ?? ROLE_AVATAR_GRAD.student;
  const pillClass    = ROLE_PILL[user?.role ?? 'student'] ?? ROLE_PILL.student;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <Logo />
            <span className="text-xl font-bold text-gray-900">CareerBond</span>
          </Link>

          {/* Desktop nav */}
          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(({ to, label }) => {
                const active = location.pathname === to || location.pathname.startsWith(to + '/');
                return (
                  <Link key={to} to={to}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'text-blue-700 bg-blue-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}>
                    {label}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right side */}
          <div className="flex items-center gap-1.5 sm:gap-2">

            {/* Language */}
            <div className="relative" ref={langDropdownRef}>
              <button onClick={() => setLangDropdownOpen(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200">
                <svg className="hidden sm:block w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                <span className="uppercase font-semibold text-xs sm:text-sm text-gray-900">
                  {i18n.language === 'kz' ? 'KZ' : i18n.language === 'en' ? 'EN' : 'RU'}
                </span>
                <svg className={`w-3 h-3 transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {langDropdownOpen && (
                <div className="absolute right-0 top-[calc(100%+4px)] min-w-[148px] bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-[9999]">
                  {([
                    { code: 'ru', flag: 'ru' as FlagIconName, label: 'Русский' },
                    { code: 'en', flag: null,                 label: 'English' },
                    { code: 'kz', flag: 'kz' as FlagIconName, label: 'Қазақша' },
                  ] as const).map(({ code, flag, label }) => (
                    <button key={code} onClick={() => handleLanguageChange(code)}
                      className={`flex items-center gap-2 w-full text-left px-4 py-2 text-sm transition-colors hover:bg-gray-50 ${
                        i18n.language === code ? 'text-blue-600 font-semibold bg-blue-50' : 'text-gray-700'
                      }`}>
                      {flag ? <FlagIcon name={flag} size={18} /> : <span className="w-[18px] text-center text-xs font-bold">EN</span>}
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isAuthenticated ? (
              <>
                {/* Notifications bell */}
                <div className="relative" ref={notifRef}>
                  <button onClick={() => setNotifOpen(v => !v)}
                    className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div className="fixed left-2 right-2 top-[68px] sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[min(calc(100vw-1rem),360px)] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-[9999] animate-scale-in">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{t('nav.notifications')}</p>
                          {unreadCount > 0 && <p className="text-xs text-gray-500">{unreadCount} непрочитанных</p>}
                        </div>
                        {unreadCount > 0 && (
                          <button onClick={handleMarkAllRead} className="text-xs font-medium text-blue-600 hover:underline">
                            {t('nav.markAllRead')}
                          </button>
                        )}
                      </div>

                      <div className="divide-y divide-gray-50 max-h-[calc(50dvh-80px)] sm:max-h-[380px] overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3"><Icon name="bell" size={24} /></div>
                            <p className="text-sm text-gray-500">{t('nav.noNotifications')}</p>
                          </div>
                        ) : notifications.map(n => (
                          <NotifItem key={n.id} notification={n} onMarkRead={handleMarkRead}
                            userRole={user?.role} navigate={navigate} />
                        ))}
                      </div>

                      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-center">
                        <button className="text-xs font-medium text-blue-600 hover:underline">
                          Показать все уведомления
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* User dropdown — desktop */}
                <div className="relative hidden md:block" ref={dropdownRef}>
                  <button onClick={() => setDropdownOpen(v => !v)}
                    className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ background: avatarGrad }}>
                      {avatarLetter}
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium text-gray-900 leading-tight max-w-[140px] truncate">
                        {user?.email}
                      </p>
                      <span className={`inline-block text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${pillClass}`}>
                        {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
                      </span>
                    </div>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1 overflow-hidden z-[9999]">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-xs text-gray-400 mb-0.5">{t('nav.loggedInAs')}</p>
                        <p className="text-sm font-semibold text-gray-800 truncate">{user?.email}</p>
                        <span className={`inline-block mt-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${pillClass}`}>
                          {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
                        </span>
                      </div>
                      <div className="py-1">
                        <Link to={getProfilePath(user?.role)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {t('nav.myProfile')}
                        </Link>
                        <Link to="/jobs"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {t('nav.jobs')}
                        </Link>
                      </div>
                      <div className="border-t border-gray-100 py-1">
                        <button onClick={handleLogout}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          {t('nav.logout')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Hamburger — mobile */}
                <button onClick={() => setMobileMenuOpen(v => !v)}
                  className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
                  {mobileMenuOpen
                    ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                  }
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link to="/login"
                  className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                  {t('nav.login')}
                </Link>
                <Link to="/register"
                  className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white rounded-lg transition-colors shadow-sm whitespace-nowrap"
                  style={{ background: '#2563EB' }}>
                  {t('nav.register')}
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && isAuthenticated && (
          <div className="md:hidden border-t border-gray-100 pb-3 pt-2">
            <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ background: avatarGrad }}>
                {avatarLetter}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
                <span className={`inline-block text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${pillClass}`}>
                  {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
                </span>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-2 space-y-0.5">
              {navLinks.map(({ to, label }) => {
                const active = location.pathname === to || location.pathname.startsWith(to + '/');
                return (
                  <Link key={to} to={to} onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                    }`}>
                    {label}
                  </Link>
                );
              })}
              <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {t('nav.logout')}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

/* ─── Notification helpers ──────────────────────────────────── */
const TYPE_CFG: Record<string, { icon: IconName; bg: string; fg: string }> = {
  application_submitted: { icon: 'document',      bg: '#FFFBEB', fg: '#92400E' },
  application_status:    { icon: 'briefcase',     bg: '#EFF6FF', fg: '#1D4ED8' },
  interview_scheduled:   { icon: 'calendar',      bg: '#F0FDF4', fg: '#15803D' },
  document_verified:     { icon: 'check-circle',  bg: '#ECFDF5', fg: '#047857' },
  document_rejected:     { icon: 'x-circle',      bg: '#FEF2F2', fg: '#B91C1C' },
  chat_message:          { icon: 'chat',          bg: '#F5F3FF', fg: '#7C3AED' },
};

function useNotifTexts(notification: Notification, userRole?: string) {
  const { t } = useTranslation();
  const { type, related_id } = notification;
  switch (type) {
    case 'application_submitted':
      return { title: t('notifications.application_submitted.title'), body: t('notifications.application_submitted.body') };
    case 'application_status': {
      const status = related_id?.split('|')[1] ?? '';
      const sub = ['interview','shortlisted','offered','rejected'].includes(status) ? status : 'interview';
      return { title: t(`notifications.application_status.${sub}.title`), body: t(`notifications.application_status.${sub}.body`) };
    }
    case 'interview_scheduled': {
      const parts = notification.body?.split('|') ?? [];
      const date = parts[0] ?? '';
      const location = parts[1] ?? '';
      const notes = parts[2] ?? '';
      let body = t('notifications.interview_scheduled.date') + ' ' + date;
      if (location) body += ', ' + t('notifications.interview_scheduled.location') + ' ' + location;
      if (notes) body += '. ' + t('notifications.interview_scheduled.notes') + ' ' + notes;
      return { title: t('notifications.interview_scheduled.title'), body };
    }
    case 'chat_message':
      return { title: t('notifications.chat_message.title'), body: userRole === 'employer' ? t('notifications.chat_message.bodyForEmployer') : t('notifications.chat_message.bodyForStudent') };
    case 'document_verified':
      return { title: t('notifications.document_verified.title'), body: t('notifications.document_verified.body') };
    case 'document_rejected':
      return { title: t('notifications.document_rejected.title'), body: t('notifications.document_rejected.body') };
    default:
      return { title: notification.title, body: notification.body };
  }
}

function useRelativeTime(iso: string) {
  const { t } = useTranslation();
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60_000);
  if (min < 1)  return t('notifications.time.justNow');
  if (min < 60) return t('notifications.time.minutesAgo', { min });
  const h = Math.floor(min / 60);
  if (h < 24)   return t('notifications.time.hoursAgo', { h });
  const d = Math.floor(h / 24);
  if (d === 1)  return t('notifications.time.yesterday');
  return t('notifications.time.daysAgo', { d });
}

function NotifItem({ notification, onMarkRead, userRole, navigate }: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  userRole?: string;
  navigate: (path: string) => void;
}) {
  const cfg     = TYPE_CFG[notification.type] ?? { icon: 'bell' as IconName, bg: '#F3F4F6', fg: '#374151' };
  const { title, body } = useNotifTexts(notification, userRole);
  const timeAgo = useRelativeTime(notification.created_at);

  const handleClick = () => {
    if (!notification.is_read) onMarkRead(notification.id);
    if (notification.type === 'chat_message') {
      const parts = notification.related_id?.split(':') ?? [];
      const appId = parts[0], vacancyId = parts[1];
      if (userRole === 'employer' && appId && vacancyId) navigate(`/employer-dashboard?openChat=${appId}&vacancyId=${vacancyId}`);
      else if (appId) navigate(`/profile?openChat=${appId}`);
      else navigate(userRole === 'employer' ? '/employer-dashboard' : '/profile');
    }
  };

  return (
    <div onClick={handleClick}
      className={`relative flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${!notification.is_read ? 'bg-blue-50/40 dot-unread' : ''}`}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ background: cfg.bg, color: cfg.fg }}>
        <Icon name={cfg.icon} size={17} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-snug ${!notification.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
            {title}
          </p>
          {!notification.is_read && (
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
          )}
        </div>
        {body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-snug">{body}</p>}
        <p className="text-[11px] text-gray-400 mt-1">{timeAgo}</p>
      </div>
    </div>
  );
}
