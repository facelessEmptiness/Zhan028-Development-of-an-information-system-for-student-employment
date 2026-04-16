import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context';
import { notificationService, type Notification } from '../services/notificationService';

const ROLE_COLORS: Record<string, string> = {
  student: 'bg-blue-100 text-blue-700',
  employer: 'bg-green-100 text-green-700',
  university: 'bg-purple-100 text-purple-700',
  admin: 'bg-red-100 text-red-700',
};

const ROLE_AVATAR_COLORS: Record<string, string> = {
  student: 'from-blue-500 to-blue-600',
  employer: 'from-green-500 to-green-600',
  university: 'from-purple-500 to-purple-600',
  admin: 'from-red-500 to-red-600',
};

function getProfilePath(role?: string) {
  if (role === 'student') return '/profile';
  if (role === 'employer') return '/employer-dashboard';
  if (role === 'university' || role === 'admin') return '/analytics';
  return '/';
}

function getNavLinks(t: any, role?: string) {
  const links = [{ to: '/jobs', label: t('nav.jobs') }];
  if (role === 'student') {
    links.push({ to: '/profile', label: t('nav.myProfile') });
  } else if (role === 'employer') {
    links.push({ to: '/employer-dashboard', label: t('nav.dashboard') });
  } else if (role === 'university' || role === 'admin') {
    links.push({ to: '/analytics', label: t('nav.analytics') });
  }
  return links;
}

export default function Header() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  const ROLE_LABELS: Record<string, string> = {
    student: t('role.student'),
    employer: t('role.employer'),
    university: t('role.university'),
    admin: t('role.admin'),
  };
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications when authenticated
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    const [notifsResult, countResult] = await Promise.allSettled([
      notificationService.list(),
      notificationService.unreadCount(),
    ]);
    if (notifsResult.status === 'fulfilled') setNotifications(notifsResult.value);
    if (countResult.status === 'fulfilled') setUnreadCount(countResult.value);
  }, [isAuthenticated]);

  useEffect(() => {
    fetchNotifications();
    // Poll every 15 seconds
    const interval = setInterval(fetchNotifications, 15_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

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

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on route change
  useEffect(() => {
    setDropdownOpen(false);
    setNotifOpen(false);
    setLangDropdownOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    setLangDropdownOpen(false);
  };

  const avatarLetter = user?.email?.[0]?.toUpperCase() ?? '?';
  const navLinks = getNavLinks(t, user?.role);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">CareerBond</span>
          </Link>

          {/* Nav links — authenticated only */}
          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(({ to, label }) => {
                const active = location.pathname === to || location.pathname.startsWith(to + '/');
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Language selector */}
            <div className="relative" ref={langDropdownRef}>
              <button
                onClick={() => setLangDropdownOpen(v => !v)}
                style={{ color: '#374151' }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                <span className="uppercase font-semibold" style={{ color: '#111827' }}>
                  {i18n.language === 'kz' ? 'KZ' : i18n.language === 'en' ? 'EN' : 'RU'}
                </span>
                <svg className={`w-3.5 h-3.5 transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {langDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 4px)',
                    minWidth: '140px',
                    background: '#ffffff',
                    borderRadius: '8px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    border: '1px solid #e5e7eb',
                    zIndex: 9999,
                    padding: '4px 0',
                  }}
                >
                  {[
                    { code: 'ru', label: '🇷🇺 Русский' },
                    { code: 'en', label: 'EN English' },
                    { code: 'kz', label: '🇰🇿 Қазақша' },
                  ].map(({ code, label }) => (
                    <button
                      key={code}
                      onClick={() => handleLanguageChange(code)}
                      style={{
                        display: 'block',
                        width: 'calc(100% - 8px)',
                        textAlign: 'left',
                        padding: '8px 14px',
                        fontSize: '14px',
                        color: i18n.language === code ? '#2563eb' : '#111827',
                        fontWeight: i18n.language === code ? 600 : 400,
                        background: i18n.language === code ? '#eff6ff' : 'transparent',
                        cursor: 'pointer',
                        border: 'none',
                        borderRadius: '4px',
                        margin: '0 4px',
                      }}
                      onMouseEnter={e => { if (i18n.language !== code) (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb'; }}
                      onMouseLeave={e => { if (i18n.language !== code) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    >
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
                  <button
                    onClick={() => setNotifOpen(v => !v)}
                    className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    aria-label={t('nav.notifications')}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {/* Badge */}
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <span className="font-semibold text-gray-800 text-sm">{t('nav.notifications')}</span>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {t('nav.markAllRead')}
                          </button>
                        )}
                      </div>
                      <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center text-sm text-gray-400">
                            {t('nav.noNotifications')}
                          </div>
                        ) : (
                          notifications.map(n => (
                            <NotifItem
                              key={n.id}
                              notification={n}
                              onMarkRead={handleMarkRead}
                              userRole={user?.role}
                              navigate={navigate}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(v => !v)}
                    className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${ROLE_AVATAR_COLORS[user?.role ?? 'student']} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                      {avatarLetter}
                    </div>
                    {/* Info */}
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium text-gray-900 leading-tight max-w-[140px] truncate">
                        {user?.email}
                      </p>
                      <span className={`inline-block text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${ROLE_COLORS[user?.role ?? 'student']}`}>
                        {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
                      </span>
                    </div>
                    {/* Chevron */}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1 overflow-hidden">
                      {/* Header */}
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-xs text-gray-400 mb-0.5">{t('nav.loggedInAs')}</p>
                        <p className="text-sm font-semibold text-gray-800 truncate">{user?.email}</p>
                        <span className={`inline-block mt-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${ROLE_COLORS[user?.role ?? 'student']}`}>
                          {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
                        </span>
                      </div>

                      {/* Links */}
                      <Link
                        to={getProfilePath(user?.role)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {t('nav.myProfile')}
                      </Link>
                      <Link
                        to="/jobs"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {t('nav.jobs')}
                      </Link>

                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          {t('nav.logout')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                >
                  {t('nav.register')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

const TYPE_ICONS: Record<string, string> = {
  application_submitted: '✅',
  application_status:    '💼',
  document_verified:     '📄',
  document_rejected:     '❌',
  chat_message:          '💬',
};

function useNotifTexts(notification: Notification, userRole?: string) {
  const { t } = useTranslation();
  const { type, related_id } = notification;

  switch (type) {
    case 'application_submitted':
      return {
        title: t('notifications.application_submitted.title'),
        body: t('notifications.application_submitted.body'),
      };
    case 'application_status': {
      // related_id format: "applicationId|status"
      const status = related_id?.split('|')[1] ?? '';
      const sub = ['interview', 'shortlisted', 'offered', 'rejected'].includes(status)
        ? status
        : 'interview';
      return {
        title: t(`notifications.application_status.${sub}.title`),
        body: t(`notifications.application_status.${sub}.body`),
      };
    }
    case 'chat_message':
      return {
        title: t('notifications.chat_message.title'),
        body: userRole === 'employer'
          ? t('notifications.chat_message.bodyForEmployer')
          : t('notifications.chat_message.bodyForStudent'),
      };
    case 'document_verified':
      return {
        title: t('notifications.document_verified.title'),
        body: t('notifications.document_verified.body'),
      };
    case 'document_rejected':
      return {
        title: t('notifications.document_rejected.title'),
        body: t('notifications.document_rejected.body'),
      };
    default:
      return { title: notification.title, body: notification.body };
  }
}

function useRelativeTime(iso: string) {
  const { t } = useTranslation();
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return t('notifications.time.justNow');
  if (min < 60) return t('notifications.time.minutesAgo', { min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('notifications.time.hoursAgo', { h });
  const d = Math.floor(h / 24);
  if (d === 1) return t('notifications.time.yesterday');
  return t('notifications.time.daysAgo', { d });
}

function NotifItem({
  notification,
  onMarkRead,
  userRole,
  navigate,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  userRole?: string;
  navigate: (path: string) => void;
}) {
  const icon = TYPE_ICONS[notification.type] ?? '🔔';
  const { title, body } = useNotifTexts(notification, userRole);
  const timeAgo = useRelativeTime(notification.created_at);

  const handleClick = () => {
    if (!notification.is_read) onMarkRead(notification.id);
    if (notification.type === 'chat_message') {
      const parts = notification.related_id?.split(':') ?? [];
      const appId = parts[0];
      const vacancyId = parts[1];
      if (userRole === 'employer' && appId && vacancyId) {
        navigate(`/employer-dashboard?openChat=${appId}&vacancyId=${vacancyId}`);
      } else if (appId) {
        navigate(`/profile?openChat=${appId}`);
      } else {
        navigate(userRole === 'employer' ? '/employer-dashboard' : '/profile');
      }
    }
  };

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${!notification.is_read ? 'bg-blue-50/40' : ''}`}
      onClick={handleClick}
    >
      <span className="text-lg shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 leading-snug">{title}</p>
        {body && (
          <p className="text-xs text-gray-500 mt-0.5 leading-snug">{body}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">{timeAgo}</p>
      </div>
      {!notification.is_read && (
        <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />
      )}
    </div>
  );
}
