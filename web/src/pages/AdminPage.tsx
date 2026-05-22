import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/apiClient';

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

type Tab = 'overview' | 'universities' | 'vacancies' | 'skills';

const STAT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'];

export default function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [universities, setUniversities] = useState<University[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [vacancySearch, setVacancySearch] = useState('');
  const [vacancyType, setVacancyType] = useState('');

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

  const jobTypes = [...new Set(vacancies.map(v => v.job_type).filter(Boolean))];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Обзор' },
    { key: 'universities', label: `Университеты (${universities.length})` },
    { key: 'vacancies', label: `Вакансии (${vacancies.length})` },
    { key: 'skills', label: 'Навыки' },
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
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
              Администратор
            </span>
          </div>
        </div>

        {/* Stats grid */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {statsCards.map(card => (
              <div key={card.label} className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{ background: card.bg }}>
                  {card.icon}
                </div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500 leading-tight">{card.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {tab === 'overview' && summary && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Application statuses */}
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
                {summary.applications.by_status.length === 0 && (
                  <p className="text-gray-400 text-sm">Нет данных</p>
                )}
              </div>
            </div>

            {/* Vacancies by job type */}
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

            {/* Students by specialization */}
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

            {/* Top locations */}
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
                    <div className="flex items-center gap-3">
                      {uni.website && (
                        <a href={uni.website} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline">
                          Сайт
                        </a>
                      )}
                      <span className="text-xs text-gray-400 font-mono truncate max-w-[160px]" title={uni.id}>
                        {uni.id.slice(0, 8)}...
                      </span>
                    </div>
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
              <input
                type="text"
                placeholder="Поиск по названию или компании..."
                value={vacancySearch}
                onChange={e => setVacancySearch(e.target.value)}
                className="flex-1 min-w-48 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <select
                value={vacancyType}
                onChange={e => setVacancyType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
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
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
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
