import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiClient';
import { toast } from 'sonner';

interface AnalyticsSummary {
  students: { total: number; by_specialization: { specialization: string; count: number }[] };
  vacancies: { total: number; demanded_skills: { name: string; count: number }[]; by_job_type: { name: string; count: number }[]; by_location: { name: string; count: number }[] };
  applications: { total: number; offered_count: number; by_status: { status: string; count: number }[] };
}

interface University {
  id: string;
  name: string;
  city: string;
  country: string;
  website: string;
}

interface Vacancy {
  id: string;
  title: string;
  company_name: string;
  location: string;
  job_type: string;
  status: string;
  created_at: string;
}

interface UserRecord {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  is_email_verified: boolean;
  created_at: string;
  university_id?: string;
}

interface ComplianceRecord {
  id: string;
  student_id: string;
  university_id: string | null;
  state: string;
  grant_years: number;
  graduation_date: string | null;
  deadline: string | null;
}

type Tab = 'overview' | 'universities' | 'vacancies' | 'skills' | 'users' | 'activity' | 'compliance';

const STAT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'];

const ROLE_LABELS: Record<string, string> = {
  student: 'Студент',
  employer: 'Работодатель',
  university: 'Университет',
  admin: 'Администратор',
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  student:    { bg: '#EFF6FF', text: '#1D4ED8' },
  employer:   { bg: '#ECFDF5', text: '#047857' },
  university: { bg: '#F5F3FF', text: '#6D28D9' },
  admin:      { bg: '#FEF2F2', text: '#B91C1C' },
};

const STATE_CFG: Record<string, { label: string; bg: string; text: string }> = {
  NotYetDue:     { label: 'Срок не наступил', bg: '#F3F4F6', text: '#4B5563' },
  InProgress:    { label: 'В процессе',       bg: '#EFF6FF', text: '#1D4ED8' },
  AtRisk:        { label: 'Под угрозой',       bg: '#FFFBEB', text: '#B45309' },
  NonCompliant:  { label: 'Нарушение',         bg: '#FEF2F2', text: '#B91C1C' },
  Compliant:     { label: 'Выполнено',          bg: '#ECFDF5', text: '#047857' },
  Exempt:        { label: 'Освобождён',         bg: '#F5F3FF', text: '#6D28D9' },
};

const ALL_ROLES = ['student', 'employer', 'university'] as const;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'вчера';
  return `${d} дн назад`;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [universities, setUniversities] = useState<University[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [complianceRecs, setComplianceRecs] = useState<ComplianceRecord[]>([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vacancySearch, setVacancySearch] = useState('');
  const [vacancyType, setVacancyType] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/analytics/summary').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/universities').then(r => r.ok ? r.json() : null).catch(() => null),
      apiFetch('/api/vacancies?page=1&page_size=200').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([s, u, v]) => {
      if (s) setSummary(s);
      if (u) setUniversities(u.universities ?? []);
      if (v) setVacancies(v.vacancies ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const fetchUsers = useCallback((role: string) => {
    setUsersLoading(true);
    const url = role ? `/api/auth/admin/users?role=${role}` : '/api/auth/admin/users';
    apiFetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setUsers(data.users ?? []); })
      .catch(() => toast.error('Не удалось загрузить пользователей'))
      .finally(() => setUsersLoading(false));
  }, []);

  const fetchCompliance = useCallback(() => {
    setComplianceLoading(true);
    apiFetch('/api/compliance/admin/all')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setComplianceRecs(data.records ?? []); })
      .catch(() => toast.error('Не удалось загрузить данные отработки'))
      .finally(() => setComplianceLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'users' || tab === 'activity') fetchUsers(userRoleFilter);
  }, [tab, userRoleFilter, fetchUsers]);

  useEffect(() => {
    if (tab === 'compliance') fetchCompliance();
  }, [tab, fetchCompliance]);

  // ── Role change ──────────────────────────────────────────────
  const handleRoleChange = async (id: string, newRole: string) => {
    setSavingId(id);
    try {
      const res = await apiFetch(`/api/auth/admin/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        const updated: UserRecord = await res.json();
        setUsers(prev => prev.map(u => u.id === id ? { ...u, role: updated.role } : u));
        toast.success('Роль изменена');
      } else {
        toast.error('Не удалось изменить роль');
      }
    } finally {
      setSavingId(null);
    }
  };

  // ── Toggle active ────────────────────────────────────────────
  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setSavingId(id);
    try {
      const res = await apiFetch(`/api/auth/admin/users/${id}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !currentActive } : u));
        toast.success(currentActive ? 'Пользователь заблокирован' : 'Пользователь разблокирован');
      } else {
        toast.error('Не удалось изменить статус');
      }
    } finally {
      setSavingId(null);
    }
  };

  // ── Compliance grouping ──────────────────────────────────────
  const complianceByUni = universities.map(uni => {
    const recs = complianceRecs.filter(r => r.university_id === uni.id);
    const counts: Record<string, number> = {};
    for (const r of recs) counts[r.state] = (counts[r.state] ?? 0) + 1;
    return { uni, recs, counts, total: recs.length };
  }).filter(row => row.total > 0);

  const complianceNoUni = complianceRecs.filter(r => !r.university_id);

  // ── Stats ────────────────────────────────────────────────────
  const employmentRate = summary
    ? (summary.students.total > 0 ? Math.round((summary.applications.offered_count / summary.students.total) * 100) : 0)
    : 0;

  const statsCards = summary ? [
    { label: 'Студентов в системе', value: summary.students.total, icon: '👩‍🎓', color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Активных вакансий', value: summary.vacancies.total, icon: '💼', color: '#10B981', bg: '#ECFDF5' },
    { label: 'Всего заявок', value: summary.applications.total, icon: '📋', color: '#F59E0B', bg: '#FFFBEB' },
    { label: 'Получили оффер', value: summary.applications.offered_count, icon: '✅', color: '#8B5CF6', bg: '#F5F3FF' },
    { label: 'Университетов', value: universities.length, icon: '🏛️', color: '#EF4444', bg: '#FEF2F2' },
    { label: 'Трудоустройство', value: `${employmentRate}%`, icon: '📈', color: '#06B6D4', bg: '#ECFEFF' },
  ] : [];

  const filteredVacancies = vacancies.filter(v => {
    const q = vacancySearch.toLowerCase();
    const matchSearch = !q || v.title.toLowerCase().includes(q) || (v.company_name ?? '').toLowerCase().includes(q);
    const matchType = !vacancyType || v.job_type === vacancyType;
    return matchSearch && matchType;
  });

  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase();
    return !q || u.email.toLowerCase().includes(q);
  });

  const jobTypes = [...new Set(vacancies.map(v => v.job_type).filter(Boolean))];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview',    label: 'Обзор' },
    { key: 'users',       label: 'Пользователи' },
    { key: 'compliance',  label: 'Отработка гранта' },
    { key: 'activity',   label: 'Активность' },
    { key: 'universities', label: `Университеты (${universities.length})` },
    { key: 'vacancies',  label: `Вакансии (${vacancies.length})` },
    { key: 'skills',     label: 'Навыки' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Загрузка системных данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: 'linear-gradient(135deg,#EF4444,#B91C1C)' }}>
              🛡️
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Панель администратора</h1>
              <p className="text-sm text-gray-500">Системный мониторинг CareerBond</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
            Администратор
          </span>
        </div>

        {/* Stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {statsCards.map(card => (
              <div key={card.label} className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{ background: card.bg }}>{card.icon}</div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500 leading-tight">{card.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl flex-wrap">
          {tabs.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {tab === 'overview' && summary && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Статусы заявок</h2>
              <div className="space-y-3">
                {summary.applications.by_status.map((s, i) => {
                  const total = summary.applications.total || 1;
                  const pct = Math.round((s.count / total) * 100);
                  const STATUS_LABELS: Record<string, string> = {
                    applied: 'Подано', interview: 'Интервью', shortlisted: 'Отобрано',
                    offered: 'Оффер', rejected: 'Отказ',
                  };
                  return (
                    <div key={s.status}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{STATUS_LABELS[s.status] ?? s.status}</span>
                        <span className="font-semibold text-gray-900">{s.count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: STAT_COLORS[i % STAT_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
                {summary.applications.by_status.length === 0 && <p className="text-gray-400 text-sm">Нет данных</p>}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Вакансии по типу занятости</h2>
              <div className="space-y-3">
                {summary.vacancies.by_job_type.map((jt, i) => {
                  const total = summary.vacancies.total || 1;
                  const pct = Math.round((jt.count / total) * 100);
                  return (
                    <div key={jt.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{jt.name}</span>
                        <span className="font-semibold text-gray-900">{jt.count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: STAT_COLORS[i % STAT_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Студенты по специальностям</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {[...summary.students.by_specialization].sort((a, b) => b.count - a.count).map((sp, i) => {
                  const max = summary.students.by_specialization[0]?.count || 1;
                  return (
                    <div key={sp.specialization} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-gray-700 truncate">{sp.specialization || 'Не указано'}</span>
                          <span className="font-semibold text-gray-900 ml-2 shrink-0">{sp.count}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${(sp.count / max) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Вакансии по городам</h2>
              <div className="space-y-3">
                {summary.vacancies.by_location.slice(0, 8).map((loc, i) => {
                  const max = summary.vacancies.by_location[0]?.count || 1;
                  return (
                    <div key={loc.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{loc.name}</span>
                        <span className="font-semibold text-gray-900">{loc.count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{ width: `${(loc.count / max) * 100}%`, background: STAT_COLORS[i % STAT_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Users ── */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <input type="text" placeholder="Поиск по email..."
                value={userSearch} onChange={e => setUserSearch(e.target.value)}
                className="flex-1 min-w-48 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              <select value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">Все роли</option>
                <option value="student">Студенты</option>
                <option value="employer">Работодатели</option>
                <option value="university">Университеты</option>
                <option value="admin">Администраторы</option>
              </select>
              {(userSearch || userRoleFilter) && (
                <button onClick={() => { setUserSearch(''); setUserRoleFilter(''); }}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl">
                  Сбросить
                </button>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Пользователи ({filteredUsers.length})</h2>
                {usersLoading && <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />}
              </div>
              {filteredUsers.length === 0 && !usersLoading ? (
                <div className="px-6 py-12 text-center text-gray-400">Нет пользователей</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Email', 'Роль', 'Статус', 'Email подтверждён', 'Регистрация', 'Действия'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredUsers.map(u => {
                        const isSaving = savingId === u.id;
                        return (
                          <tr key={u.id} className={`transition-colors ${!u.is_active ? 'bg-red-50/40' : 'hover:bg-gray-50'}`}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[220px] truncate">
                              {!u.is_active && <span className="mr-1.5 text-red-400">🔒</span>}
                              {u.email}
                            </td>
                            {/* Role dropdown */}
                            <td className="px-4 py-3">
                              <select
                                value={u.role}
                                disabled={isSaving}
                                onChange={e => handleRoleChange(u.id, e.target.value)}
                                className="text-xs font-semibold px-2 py-1 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 cursor-pointer"
                                style={{
                                  background: ROLE_COLORS[u.role]?.bg ?? '#F3F4F6',
                                  color: ROLE_COLORS[u.role]?.text ?? '#374151',
                                }}
                              >
                                {ALL_ROLES.map(r => (
                                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {u.is_active ? 'Активен' : 'Заблокирован'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                u.is_email_verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {u.is_email_verified ? 'Да' : 'Нет'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400">
                              {new Date(u.created_at).toLocaleDateString('ru-RU')}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleToggleActive(u.id, u.is_active)}
                                disabled={isSaving}
                                className={`text-xs font-medium hover:underline disabled:opacity-50 ${
                                  u.is_active ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'
                                }`}
                              >
                                {isSaving ? '...' : u.is_active ? 'Заблокировать' : 'Разблокировать'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Compliance monitoring ── */}
        {tab === 'compliance' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Мониторинг отработки гранта</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Сводка по всем университетам · {complianceRecs.length} записей</p>
                </div>
                <div className="flex items-center gap-3">
                  {complianceLoading && <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />}
                  <button onClick={fetchCompliance}
                    className="text-xs text-blue-600 hover:underline font-medium">
                    Обновить
                  </button>
                </div>
              </div>

              {/* State legend */}
              <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-2">
                {Object.entries(STATE_CFG).map(([key, cfg]) => (
                  <span key={key} className="text-xs font-medium px-2 py-1 rounded-full"
                    style={{ background: cfg.bg, color: cfg.text }}>
                    {cfg.label}
                  </span>
                ))}
              </div>

              {complianceRecs.length === 0 && !complianceLoading ? (
                <div className="px-6 py-12 text-center text-gray-400">Нет данных об отработке</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Университет</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Срок не наступил</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">В процессе</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Под угрозой</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Нарушение</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Выполнено</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Освобождён</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Всего</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {complianceByUni.map(({ uni, counts, total }) => (
                        <tr key={uni.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{uni.name}</p>
                            <p className="text-xs text-gray-400">{[uni.city, uni.country].filter(Boolean).join(', ')}</p>
                          </td>
                          {(['NotYetDue', 'InProgress', 'AtRisk', 'NonCompliant', 'Compliant', 'Exempt'] as const).map(state => {
                            const cfg = STATE_CFG[state];
                            const count = counts[state] ?? 0;
                            return (
                              <td key={state} className="px-4 py-3 text-center">
                                {count > 0 ? (
                                  <span className="inline-block min-w-[28px] text-xs font-bold px-2 py-1 rounded-full"
                                    style={{ background: cfg.bg, color: cfg.text }}>
                                    {count}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-sm">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-bold text-gray-900">{total}</span>
                          </td>
                        </tr>
                      ))}
                      {complianceNoUni.length > 0 && (
                        <tr className="hover:bg-gray-50 bg-yellow-50/40">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-yellow-700">Без университета</p>
                          </td>
                          {(['NotYetDue', 'InProgress', 'AtRisk', 'NonCompliant', 'Compliant', 'Exempt'] as const).map(state => {
                            const cfg = STATE_CFG[state];
                            const count = complianceNoUni.filter(r => r.state === state).length;
                            return (
                              <td key={state} className="px-4 py-3 text-center">
                                {count > 0 ? (
                                  <span className="inline-block min-w-[28px] text-xs font-bold px-2 py-1 rounded-full"
                                    style={{ background: cfg.bg, color: cfg.text }}>
                                    {count}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-sm">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-bold text-gray-900">{complianceNoUni.length}</span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {/* Totals row */}
                    {complianceRecs.length > 0 && (
                      <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                        <tr>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-700">Итого</td>
                          {(['NotYetDue', 'InProgress', 'AtRisk', 'NonCompliant', 'Compliant', 'Exempt'] as const).map(state => {
                            const cfg = STATE_CFG[state];
                            const count = complianceRecs.filter(r => r.state === state).length;
                            return (
                              <td key={state} className="px-4 py-3 text-center">
                                {count > 0 ? (
                                  <span className="inline-block min-w-[28px] text-xs font-bold px-2 py-1 rounded-full"
                                    style={{ background: cfg.bg, color: cfg.text }}>
                                    {count}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-sm">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-bold text-gray-900">{complianceRecs.length}</span>
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Activity ── */}
        {tab === 'activity' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Последние регистрации</h2>
                {usersLoading && <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />}
              </div>
              {users.length === 0 && !usersLoading ? (
                <div className="px-6 py-12 text-center text-gray-400">Нет данных</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {users.slice(0, 30).map(u => {
                    const roleColor = ROLE_COLORS[u.role] ?? { bg: '#F3F4F6', text: '#374151' };
                    return (
                      <div key={u.id} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                          style={{ background: roleColor.text }}>
                          {u.email[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{u.email}</p>
                          <p className="text-xs text-gray-400">Роль: <span className="font-medium" style={{ color: roleColor.text }}>{ROLE_LABELS[u.role] ?? u.role}</span></p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!u.is_email_verified && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                              Email не подтверждён
                            </span>
                          )}
                          {!u.is_active && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                              Заблокирован
                            </span>
                          )}
                          <span className="text-xs text-gray-400">{timeAgo(u.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {vacancies.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Последние вакансии</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {[...vacancies]
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .slice(0, 10)
                    .map(v => (
                      <div key={v.id}
                        className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/job/${v.id}`)}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-100 text-green-700 text-lg shrink-0">💼</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{v.title}</p>
                          <p className="text-xs text-gray-400">{v.company_name || '—'} · {v.location || '—'}</p>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{timeAgo(v.created_at)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Universities ── */}
        {tab === 'universities' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Все университеты ({universities.length})</h2>
            </div>
            {universities.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400">Нет данных</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {universities.map((uni, i) => (
                  <div key={uni.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                        style={{ background: STAT_COLORS[i % STAT_COLORS.length] }}>
                        {(uni.name || 'U')[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{uni.name || '—'}</p>
                        <p className="text-xs text-gray-400">{[uni.city, uni.country].filter(Boolean).join(', ') || '—'}</p>
                      </div>
                    </div>
                    {uni.website && (
                      <a href={uni.website} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline">Сайт</a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Vacancies ── */}
        {tab === 'vacancies' && (
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <input type="text" placeholder="Поиск по названию или компании..."
                value={vacancySearch} onChange={e => setVacancySearch(e.target.value)}
                className="flex-1 min-w-48 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              <select value={vacancyType} onChange={e => setVacancyType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">Все типы</option>
                {jobTypes.map(jt => <option key={jt} value={jt}>{jt}</option>)}
              </select>
              {(vacancySearch || vacancyType) && (
                <button onClick={() => { setVacancySearch(''); setVacancyType(''); }}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl">
                  Сбросить
                </button>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Вакансии ({filteredVacancies.length})</h2>
              </div>
              {filteredVacancies.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-400">Нет вакансий</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Название', 'Компания', 'Тип', 'Город', 'Статус', 'Дата'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredVacancies.map(v => (
                        <tr key={v.id} onClick={() => navigate(`/job/${v.id}`)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[200px] truncate">{v.title}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{v.company_name || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{v.job_type || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{v.location || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                              v.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}>{v.status === 'active' ? 'Активна' : v.status}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {v.created_at ? new Date(v.created_at).toLocaleDateString('ru-RU') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Skills ── */}
        {tab === 'skills' && summary && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-5">
              Востребованные навыки
              <span className="ml-2 text-sm font-normal text-gray-400">из всех вакансий системы</span>
            </h2>
            {summary.vacancies.demanded_skills.length === 0 ? (
              <p className="text-gray-400 text-sm">Нет данных</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {summary.vacancies.demanded_skills.map((sk, idx) => {
                  const max = summary.vacancies.demanded_skills[0]?.count || 1;
                  const pct = Math.round((sk.count / max) * 100);
                  return (
                    <div key={sk.name} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-red-600 text-white rounded-full text-xs flex items-center justify-center font-bold">{idx + 1}</span>
                          <span className="font-semibold text-gray-900 text-sm">{sk.name}</span>
                        </div>
                        <span className="text-red-600 font-bold text-sm">{sk.count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">упоминаний в вакансиях</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
