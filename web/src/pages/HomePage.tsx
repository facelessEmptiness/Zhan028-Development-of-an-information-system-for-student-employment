import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context';
import Icon from '../components/Icon';
import type { IconName } from '../components/icons';
import { studentService, type BackendStudentProfile } from '../services/studentService';
import { applicationService, type Application } from '../services/applicationService';
import { employerService, type JobPosting } from '../services/employerService';
import { interviewService, type Interview } from '../services/interviewService';
import { employmentService, type EmploymentRecord } from '../services/employmentService';
import { complianceService, type ComplianceRecord, type ComplianceState } from '../services/complianceService';
import { documentService } from '../services/documentService';
import { apiFetch } from '../utils/apiClient';
import { parseSkills } from '../utils';

/* ─── Match helpers ─────────────────────────────────────────── */
function matchScore(profile: BackendStudentProfile, vacancy: JobPosting): number {
  const studentSkills = parseSkills(profile.skills).map(s => s.toLowerCase());
  const vacancySkills = parseSkills(vacancy.skills).map(s => s.toLowerCase());
  let skillPoints = 0;
  if (vacancySkills.length > 0 && studentSkills.length > 0) {
    const matched = vacancySkills.filter(vs => studentSkills.some(ss => ss.includes(vs) || vs.includes(ss))).length;
    skillPoints = Math.round((matched / vacancySkills.length) * 70);
  } else if (vacancySkills.length === 0) {
    skillPoints = 35;
  }
  let specPoints = 0;
  const spec = (profile.specialization || '').toLowerCase();
  if (spec) {
    const titleLower = vacancy.title.toLowerCase();
    const descLower  = vacancy.description.toLowerCase();
    const specWords  = spec.split(/\s+/).filter(w => w.length > 3);
    const hits = specWords.filter(w => titleLower.includes(w) || descLower.includes(w)).length;
    if (specWords.length > 0) specPoints = Math.round((hits / specWords.length) * 30);
  }
  return skillPoints + specPoints;
}

/* ─── MatchRing SVG (from prototype) ───────────────────────── */
function MatchRing({ value, size = 52, stroke = 5 }: { value: number; size?: number; stroke?: number }) {
  const r   = (size - stroke) / 2;
  const c   = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  const color = value >= 80 ? '#10B981' : value >= 60 ? '#2563EB' : value >= 40 ? '#F59E0B' : '#EF4444';
  return (
    <div className="relative" style={{ width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="#E5E7EB" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke={color} strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-bold" style={{ color, fontSize: size * 0.26 }}>{value}</span>
      </div>
    </div>
  );
}

/* ─── SkillChip ─────────────────────────────────────────────── */
function SkillChip({ children, variant = 'blue' }: { children: React.ReactNode; variant?: 'blue' | 'indigo' | 'gray' }) {
  const map: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    gray:   'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${map[variant]}`}>
      {children}
    </span>
  );
}

/* ─── Compliance state meta (colors match CompliancePanel) ──── */
const COMPLIANCE_META: Record<ComplianceState, { color: string; def: string }> = {
  NotYetDue:    { color: '#9CA3AF', def: 'Срок не наступил' },
  InProgress:   { color: '#3B82F6', def: 'В процессе' },
  Compliant:    { color: '#10B981', def: 'Выполнено' },
  AtRisk:       { color: '#F59E0B', def: 'Под риском' },
  NonCompliant: { color: '#EF4444', def: 'Не выполнено' },
  Exempt:       { color: '#6366F1', def: 'Освобождён' },
};
const COMPLIANCE_DONUT_ORDER: ComplianceState[] = ['Compliant', 'InProgress', 'AtRisk', 'NonCompliant', 'NotYetDue', 'Exempt'];

/* ─── Application status palette (employer dashboard) ───────── */
const APP_STATUS_META: Record<string, { color: string; bg: string; def: string }> = {
  applied:     { color: '#1D4ED8', bg: '#EFF6FF', def: 'Отклик' },
  review:      { color: '#7C3AED', bg: '#F5F3FF', def: 'На рассмотрении' },
  shortlisted: { color: '#B45309', bg: '#FFFBEB', def: 'В шортлисте' },
  interview:   { color: '#7C3AED', bg: '#F5F3FF', def: 'Собеседование' },
  offered:     { color: '#047857', bg: '#ECFDF5', def: 'Оффер' },
  rejected:    { color: '#B91C1C', bg: '#FEF2F2', def: 'Отклонён' },
};

/* ─── Donut (CSS conic-gradient, clickable center) ──────────── */
const ComplianceDonut = ({ data, size = 132, onClick, totalLabel }: {
  data: { label: string; value: number; color: string }[];
  size?: number; onClick?: () => void; totalLabel: string;
}) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <div className="rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 shrink-0"
      style={{ width: size, height: size }}>—</div>
  );
  let acc = 0;
  const gradient = data.filter(d => d.value > 0).map(d => {
    const pct = (d.value / total) * 100;
    const slice = `${d.color} ${acc.toFixed(2)}% ${(acc + pct).toFixed(2)}%`;
    acc += pct;
    return slice;
  }).join(', ');
  const inner = size * 0.58;
  const off = (size - inner) / 2;
  return (
    <button type="button" onClick={onClick}
      className="relative shrink-0 group focus:outline-none"
      style={{ width: size, height: size, cursor: onClick ? 'pointer' : 'default' }}>
      <div className="transition-transform group-hover:scale-[1.03]"
        style={{ width: size, height: size, borderRadius: '50%', background: `conic-gradient(${gradient})` }} />
      <div className="absolute flex flex-col items-center justify-center"
        style={{ top: off, left: off, width: inner, height: inner, borderRadius: '50%', background: 'white' }}>
        <span className="text-2xl font-bold text-gray-900 leading-none">{total}</span>
        <span className="text-[10px] text-gray-400 mt-0.5">{totalLabel}</span>
      </div>
    </button>
  );
};

/* ─── Data ──────────────────────────────────────────────────── */
const jobCategories: { id: number; labelKey: string; icon: IconName }[] = [
  { id: 1, labelKey: 'home.categories_list.it',           icon: 'code'           },
  { id: 2, labelKey: 'home.categories_list.sales',        icon: 'chart-bar'      },
  { id: 3, labelKey: 'home.categories_list.finance',      icon: 'chart-line'     },
  { id: 4, labelKey: 'home.categories_list.hr',           icon: 'user-circle'    },
  { id: 5, labelKey: 'home.categories_list.engineering',  icon: 'briefcase'      },
  { id: 6, labelKey: 'home.categories_list.medicine',     icon: 'certificate'    },
  { id: 7, labelKey: 'home.categories_list.education',    icon: 'graduation-cap' },
  { id: 8, labelKey: 'home.categories_list.construction', icon: 'building-2'     },
];

/* ═══════════════════════════════════════════════════════════════
   Landing (unauthenticated)
═══════════════════════════════════════════════════════════════ */
const LandingPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="space-y-8">

      {/* ── Hero gradient ── */}
      <section className="relative overflow-hidden rounded-2xl p-8 sm:p-12 text-white"
        style={{ background: 'linear-gradient(135deg,#2563EB 0%,#4F46E5 100%)' }}>
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full opacity-10 bg-white" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-medium mb-4 backdrop-blur">
            <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
            {t('home.hero.onlineStudents')}
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold mb-3 leading-tight">{t('home.hero.title')}</h1>
          <p className="text-lg text-blue-100 mb-6 max-w-2xl">{t('home.hero.subtitle')}</p>

          {/* Search bar */}
          <div className="bg-white rounded-xl p-2 flex flex-col sm:flex-row gap-2 max-w-2xl shadow-lg">
            <div className="flex-1 flex items-center gap-2 px-3 border border-gray-100 sm:border-0 rounded-lg sm:rounded-none">
              <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input className="flex-1 py-2 text-gray-900 focus:outline-none text-sm"
                placeholder={t('home.hero.searchPlaceholder')} />
            </div>
            <button onClick={() => navigate('/jobs')}
              className="px-6 py-2.5 text-white font-semibold rounded-lg transition-colors text-sm"
              style={{ background: '#2563EB' }}>
              {t('home.hero.searchBtn')}
            </button>
          </div>

          {/* CTA buttons */}
          <div className="flex gap-3 mt-6 flex-wrap">
            <button onClick={() => navigate('/register')}
              className="px-6 py-2.5 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-50 text-sm transition-colors">
              {t('home.hero.register')}
            </button>
            <button onClick={() => navigate('/login')}
              className="px-6 py-2.5 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 text-sm transition-colors">
              {t('home.hero.login')}
            </button>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900">{t('home.how.title')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('home.how.subtitle')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: 'user-circle'    as IconName, n: 1, tk: 'step1' },
            { icon: 'briefcase'      as IconName, n: 2, tk: 'step2' },
            { icon: 'graduation-cap' as IconName, n: 3, tk: 'step3' },
          ].map(s => (
            <div key={s.n} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Icon name={s.icon} size={22} />
                </div>
                <span className="text-sm font-semibold text-gray-300">0{s.n}</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 text-sm">{t(`home.how.${s.tk}Title`)}</h3>
              <p className="text-gray-500 text-sm">{t(`home.how.${s.tk}Text`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Categories ── */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('home.categories.title')}</h2>
            <p className="text-sm text-gray-500 mt-1">{t('home.categories.subtitle')}</p>
          </div>
          <button onClick={() => navigate('/jobs')}
            className="text-sm font-medium text-blue-600 hover:underline">
            {t('home.categories.all')} →
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {jobCategories.map(cat => (
            <button key={cat.id} onClick={() => navigate('/jobs')}
              className="text-left bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition-all category-card">
              <div className="mb-3 text-blue-500"><Icon name={cat.icon} size={28} /></div>
              <h3 className="font-semibold text-gray-900 text-sm">{t(cat.labelKey)}</h3>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Student home
═══════════════════════════════════════════════════════════════ */
const StudentHome = ({ userEmail }: { userEmail?: string }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery,  setSearchQuery]  = useState('');
  const [profile,           setProfile]           = useState<BackendStudentProfile | null>(null);
  const [applications,      setApplications]      = useState<Application[]>([]);
  const [employmentRecords, setEmploymentRecords] = useState<EmploymentRecord[]>([]);
  const [compliance,        setCompliance]        = useState<ComplianceRecord | null>(null);
  const [loadingStats,      setLoadingStats]      = useState(true);
  const [recommended,  setRecommended]  = useState<(JobPosting & { score: number })[]>([]);
  const [loadingRec,   setLoadingRec]   = useState(false);

  useEffect(() => {
    Promise.all([
      studentService.getProfile().catch(() => null),
      applicationService.getMyApplications().catch(() => []),
      employmentService.getMyRecords().catch(() => [] as EmploymentRecord[]),
    ]).then(([prof, apps, empRecs]) => {
      setProfile(prof);
      setApplications(apps);
      setEmploymentRecords(empRecs);
      setLoadingStats(false);
      if (prof?.user_id) complianceService.getForStudent(prof.user_id).then(setCompliance).catch(() => {});
      if (prof && (prof.skills || prof.specialization)) {
        setLoadingRec(true);
        apiFetch('/api/vacancies/?page=1&page_size=100')
          .then(r => r.ok ? r.json() : { vacancies: [] })
          .then(data => {
            const vacancies: JobPosting[] = Array.isArray(data) ? data : (data.vacancies ?? []);
            const scored = vacancies
              .map(v => ({ ...v, score: matchScore(prof, v) }))
              .filter(v => v.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, 6);
            setRecommended(scored);
          })
          .catch(() => {})
          .finally(() => setLoadingRec(false));
      }
    });
  }, []);

  const calcCompletion = (p: BackendStudentProfile | null) => {
    if (!p) return 0;
    const fields = [p.first_name, p.last_name, p.phone, p.bio, p.skills, p.specialization, p.graduation_year, p.location_city];
    return Math.round(fields.filter(f => f && String(f).trim() !== '' && String(f) !== '0').length / fields.length * 100);
  };

  const displayName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : userEmail?.split('@')[0];
  const completion  = calcCompletion(profile);
  const appCount    = applications.length;

  return (
    <div className="space-y-6">

      {/* ── Welcome hero ── */}
      <section className="relative overflow-hidden rounded-2xl p-7 sm:p-10 text-white"
        style={{ background: 'linear-gradient(135deg,#2563EB 0%,#4F46E5 100%)' }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full opacity-10 bg-white" />
        <div className="relative">
          <p className="text-blue-100 text-sm mb-1">{t('home.welcome.subtitle')}</p>
          <h1 className="text-2xl sm:text-4xl font-bold mb-5 leading-tight">
            {t('home.welcome.greeting', { name: displayName })}
          </h1>
          <div className="bg-white rounded-xl p-2 flex flex-col sm:flex-row gap-2 max-w-2xl shadow-lg">
            <div className="flex-1 flex items-center gap-2 px-3 border border-gray-100 sm:border-0 rounded-lg sm:rounded-none">
              <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                className="flex-1 py-2 text-gray-900 focus:outline-none text-sm"
                placeholder={t('home.student.searchPlaceholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && searchQuery.trim()) navigate(`/jobs?q=${encodeURIComponent(searchQuery.trim())}`); }}
              />
            </div>
            <button
              onClick={() => navigate(searchQuery.trim() ? `/jobs?q=${encodeURIComponent(searchQuery.trim())}` : '/jobs')}
              className="px-5 py-2.5 text-white font-semibold rounded-lg transition-colors text-sm whitespace-nowrap"
              style={{ background: '#2563EB' }}>
              {t('home.hero.searchBtn')}
            </button>
          </div>
        </div>
      </section>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Profile completion */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">{t('home.student.profileCompletion')}</p>
          {loadingStats ? <div className="skeleton h-7 w-16 mt-1" /> : (
            <>
              <p className="text-2xl font-bold text-blue-600">{completion}%</p>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="progress-bar h-1.5 rounded-full" style={{ width: `${completion}%` }} />
              </div>
            </>
          )}
        </div>

        {/* Applications */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">{t('home.student.myApplications')}</p>
          {loadingStats ? <div className="skeleton h-7 w-10 mt-1" /> : (
            <>
              <p className="text-2xl font-bold text-indigo-600">{appCount}</p>
              <Link to="/my-applications" className="text-xs text-blue-600 mt-1.5 inline-block hover:underline">
                {t('home.student.viewAll')} →
              </Link>
            </>
          )}
        </div>

        {/* Recommended */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">{t('home.student.recommended')}</p>
          {loadingRec ? <div className="skeleton h-7 w-10 mt-1" /> : (
            <p className="text-2xl font-bold text-purple-600">{recommended.length}</p>
          )}
        </div>

        {/* Profile status */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">{t('home.student.profileCard')}</p>
          {loadingStats ? <div className="skeleton h-7 w-16 mt-1" /> : (
            <>
              <div className="mt-1" style={{ color: completion < 100 ? '#F59E0B' : '#10B981' }}>
                {completion < 100 ? <Icon name="alert-triangle" size={24} /> : <Icon name="check" size={24} />}
              </div>
              <Link to="/profile" className="text-xs text-blue-600 mt-1.5 inline-block hover:underline">
                {completion < 100 ? t('home.student.fillProfile') : `${t('home.student.viewAll')} →`}
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { titleKey: 'home.student.profileCard',      descKey: 'home.student.profileDesc',      link: '/profile',         bg: 'bg-blue-50',   iconBg: 'bg-blue-100',   icon: 'user'           as IconName },
          { titleKey: 'home.student.jobsCard',         descKey: 'home.student.jobsDesc',         link: '/jobs',            bg: 'bg-indigo-50', iconBg: 'bg-indigo-100', icon: 'search'         as IconName },
          { titleKey: 'home.student.applicationsCard', descKey: 'home.student.applicationsDesc', link: '/my-applications', bg: 'bg-purple-50', iconBg: 'bg-purple-100', icon: 'clipboard-list' as IconName },
        ].map(item => (
          <Link key={item.link} to={item.link}
            className={`${item.bg} rounded-xl border border-transparent p-5 hover:shadow-md hover:border-blue-200 transition-all`}>
            <div className={`${item.iconBg} w-10 h-10 rounded-xl flex items-center justify-center text-blue-600 mb-3`}>
              <Icon name={item.icon} size={20} />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{t(item.titleKey)}</h3>
            <p className="text-gray-500 text-sm">{t(item.descKey)}</p>
          </Link>
        ))}
      </div>

      {/* ── Grant compliance state badge ── */}
      {compliance && (() => {
        const m = COMPLIANCE_META[compliance.state];
        const lbl = t(`universityAnalytics.compliance.states.${compliance.state}`, { defaultValue: m.def });
        return (
          <section className="bg-white rounded-xl border p-5" style={{ borderColor: `${m.color}40` }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${m.color}1A`, color: m.color }}>
                <Icon name="graduation-cap" size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-0.5">{t('home.student.complianceLabel', { defaultValue: 'Мой статус по гранту' })}</p>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                  <span className="font-semibold text-gray-900">{lbl}</span>
                </div>
              </div>
              {compliance.deadline && (
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">{t('home.student.complianceDeadline', { defaultValue: 'Срок' })}</p>
                  <p className="text-sm font-medium text-gray-700">{new Date(compliance.deadline).toLocaleDateString('ru-RU')}</p>
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* ── Grant obligation ── */}
      {employmentRecords.filter(r => r.status === 'active' || r.status === 'completed').length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{t('home.student.grantTitle')}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{t('home.student.grantSubtitle')}</p>
            </div>
          </div>
          <div className="space-y-3">
            {employmentRecords.filter(r => r.status === 'active' || r.status === 'completed').map(rec => (
              <div key={rec.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{rec.job_title}</h3>
                    <p className="text-sm text-gray-500">{rec.company_name}</p>
                  </div>
                  {rec.grant_fulfilled ? (
                    <span className="text-green-600 font-semibold text-sm shrink-0">{t('employment.grantFulfilled')}</span>
                  ) : (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium shrink-0 bg-green-50 text-green-700">
                      {t('employment.status.active')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${rec.progress}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 shrink-0">{rec.progress}%</span>
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-400">
                  <span>{t('employment.table.daysWorked')}: {rec.days_worked}</span>
                  {!rec.grant_fulfilled && (
                    <span>{t('employment.remaining', { days: rec.remaining_days })}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Recommended jobs ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t('home.student.recommended')}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{t('home.student.recommendedDesc', { defaultValue: '' })}</p>
          </div>
          <Link to="/jobs" className="text-sm font-medium text-blue-600 hover:underline">
            {t('home.student.viewAllJobs')} →
          </Link>
        </div>

        {loadingRec && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="skeleton h-4 w-1/2 mb-2" />
                <div className="skeleton h-3 w-1/3" />
              </div>
            ))}
          </div>
        )}

        {!loadingRec && recommended.length > 0 && (
          <div className="space-y-3">
            {recommended.map(v => (
              <Link key={v.id} to={`/job/${v.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition-all job-card-hover">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 truncate">{v.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {v.company_name || t('jobs.details.employer')}
                      {v.location ? ` · ${v.location}` : ''}
                    </p>
                    {v.skills && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {parseSkills(v.skills).slice(0, 4).map(s => (
                          <SkillChip key={s}>{s}</SkillChip>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-center gap-0.5">
                    <MatchRing value={v.score} size={48} stroke={4} />
                    <span className="text-[10px] text-gray-400">{t('home.student.match')}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loadingRec && recommended.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <div className="mb-3 text-gray-300 flex justify-center"><Icon name="search" size={40} /></div>
            <p className="text-gray-600 mb-4">{t('home.student.fillProfileForRec')}</p>
            <Link to="/profile"
              className="inline-block px-6 py-2 text-white rounded-lg font-medium transition-colors"
              style={{ background: '#2563EB' }}>
              {t('home.student.fillProfile')}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Employer home
═══════════════════════════════════════════════════════════════ */
const EmployerHome = ({ email }: { email?: string }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [vacancies,  setVacancies]  = useState<JobPosting[]>([]);
  const [apps,        setApps]       = useState<(Application & { vacancyTitle: string })[]>([]);
  const [interviews,  setInterviews] = useState<Interview[]>([]);
  const [loading,     setLoading]    = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [vacs, ints] = await Promise.all([
          employerService.getJobPostings().catch(() => [] as JobPosting[]),
          interviewService.getForEmployer().catch(() => [] as Interview[]),
        ]);
        setVacancies(vacs);
        setInterviews(ints);
        const appLists = await Promise.all(
          vacs.map(v =>
            applicationService.getVacancyApplications(v.id)
              .then(list => list.map(a => ({ ...a, vacancyTitle: v.title })))
              .catch(() => [] as (Application & { vacancyTitle: string })[])
          )
        );
        setApps(appLists.flat());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Derived metrics (all real) ──
  const activeVacancies = vacancies.filter(v => v.status === 'active').length;
  const totalApps = apps.length;
  const isToday = (iso: string) => {
    const d = new Date(iso);
    return d.toDateString() === new Date().toDateString();
  };
  const newToday = apps.filter(a => isToday(a.created_at)).length;
  const scheduledInterviews = interviews.filter(i => i.status === 'scheduled').length;

  const recent = [...apps]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const statusLabel = (st: string) =>
    t(`employerDashboard.status.${st}`, { defaultValue: APP_STATUS_META[st]?.def ?? st });

  const candidateName = (a: Application & { vacancyTitle: string }) =>
    a.student ? `${a.student.first_name} ${a.student.last_name}`.trim() : a.student_id.slice(0, 8);

  const statCards: { label: string; value: number; color: string; onClick: () => void }[] = [
    { label: t('home.employer.stats.activeVacancies', { defaultValue: 'Активных вакансий' }), value: activeVacancies,      color: '#2563EB', onClick: () => navigate('/employer-dashboard?tab=jobs') },
    { label: t('home.employer.stats.applications',    { defaultValue: 'Всего откликов' }),    value: totalApps,           color: '#6366F1', onClick: () => navigate('/employer-dashboard?tab=applications') },
    { label: t('home.employer.stats.newToday',        { defaultValue: 'Новых сегодня' }),     value: newToday,            color: '#7C3AED', onClick: () => navigate('/employer-dashboard?tab=applications') },
    { label: t('home.employer.stats.interviews',      { defaultValue: 'Собеседований' }),     value: scheduledInterviews, color: '#10B981', onClick: () => navigate('/employer-dashboard?tab=applications') },
  ];

  return (
    <div className="space-y-6">

      {/* ── Welcome banner ── */}
      <section className="relative overflow-hidden rounded-2xl p-7 sm:p-10 text-white"
        style={{ background: 'linear-gradient(135deg,#2563EB 0%,#4F46E5 100%)' }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full opacity-10 bg-white" />
        <div className="relative">
          <h1 className="text-2xl sm:text-4xl font-bold mb-1">
            {t('home.welcome.greeting', { name: email?.split('@')[0] })}
          </h1>
          <p className="text-blue-100">{t('home.employer.subtitle')}</p>
        </div>
      </section>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c, i) => (
          <button key={i} onClick={c.onClick}
            className="text-left bg-white rounded-2xl border border-gray-200 p-5 transition-all hover:shadow-md hover:border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
              <span className="text-xs text-gray-500 font-medium">{c.label}</span>
            </div>
            {loading ? <div className="skeleton h-8 w-12" /> : <p className="text-3xl font-bold text-gray-900">{c.value}</p>}
          </button>
        ))}
      </div>

      {/* ── Main grid: recent applications + quick actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent applications with match-score */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {t('home.employer.recentTitle', { defaultValue: 'Последние отклики' })}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {t('home.employer.recentSubtitle', { defaultValue: 'Кандидаты с процентом совпадения навыков' })}
              </p>
            </div>
            <button onClick={() => navigate('/employer-dashboard?tab=applications')}
              className="text-sm font-medium text-blue-600 hover:underline shrink-0">
              {t('home.employer.allApplications', { defaultValue: 'Все отклики' })} →
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton rounded-full" style={{ width: 44, height: 44 }} />
                  <div className="flex-1 space-y-1.5"><div className="skeleton h-4 w-1/2" /><div className="skeleton h-3 w-1/3" /></div>
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="py-8 text-center">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 mx-auto mb-3">
                <Icon name="briefcase" size={28} />
              </div>
              <p className="text-gray-600 mb-4 max-w-sm mx-auto">
                {vacancies.length === 0
                  ? t('home.employer.noVacancies', { defaultValue: 'У вас ещё нет вакансий — опубликуйте первую, чтобы получать отклики' })
                  : t('home.employer.noApplications', { defaultValue: 'Пока нет откликов на ваши вакансии' })}
              </p>
              <button onClick={() => navigate('/employer-dashboard?tab=jobs')}
                className="inline-block px-6 py-2.5 text-white font-semibold rounded-xl transition-colors"
                style={{ background: '#2563EB' }}>
                {vacancies.length === 0
                  ? t('home.employer.postVacancy', { defaultValue: 'Опубликовать вакансию →' })
                  : t('home.employer.toVacancies', { defaultValue: 'К вакансиям →' })}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map(a => {
                const meta = APP_STATUS_META[a.status] ?? { color: '#6B7280', bg: '#F3F4F6', def: a.status };
                return (
                  <button key={a.id} onClick={() => navigate('/employer-dashboard?tab=applications')}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left">
                    <MatchRing value={a.match_score ?? 0} size={44} stroke={4} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{candidateName(a)}</p>
                      <p className="text-xs text-gray-500 truncate">{a.vacancyTitle}</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                      style={{ color: meta.color, background: meta.bg }}>
                      {statusLabel(a.status)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {t('home.employer.quickActions', { defaultValue: 'Быстрые действия' })}
          </h2>
          <div className="space-y-2.5">
            <button onClick={() => navigate('/employer-dashboard?tab=jobs')}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all text-left">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Icon name="briefcase" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{t('home.employer.postVacancyAction', { defaultValue: 'Опубликовать вакансию' })}</p>
                <p className="text-xs text-gray-400">{t('home.employer.postVacancyHint', { defaultValue: 'Новая вакансия для кандидатов' })}</p>
              </div>
            </button>

            <button onClick={() => navigate('/employer-dashboard?tab=applications')}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all text-left">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Icon name="clipboard-list" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{t('home.employer.reviewApplications', { defaultValue: 'Отклики кандидатов' })}</p>
                {!loading && <p className="text-xs text-gray-400">{t('home.employer.applicationsCount', { count: totalApps, defaultValue: `${totalApps} всего` })}</p>}
              </div>
            </button>

            <button onClick={() => navigate('/employer-dashboard?tab=jobs')}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50/40 transition-all text-left">
              <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Icon name="chart-bar" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{t('home.employer.myVacancies', { defaultValue: 'Мои вакансии' })}</p>
                {!loading && <p className="text-xs text-gray-400">{t('home.employer.activeCount', { count: activeVacancies, defaultValue: `${activeVacancies} активных` })}</p>}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   University / Admin home
═══════════════════════════════════════════════════════════════ */
const UniversityHome = ({ email }: { email?: string }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [records,     setRecords]     = useState<ComplianceRecord[]>([]);
  const [students,    setStudents]    = useState<BackendStudentProfile[]>([]);
  const [employment,  setEmployment]  = useState<EmploymentRecord[]>([]);
  const [pendingDocs, setPendingDocs] = useState(0);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      complianceService.getForUniversity().catch(() => [] as ComplianceRecord[]),
      studentService.listByUniversity().then(r => r.students ?? []).catch(() => [] as BackendStudentProfile[]),
      employmentService.getAllRecords().catch(() => [] as EmploymentRecord[]),
      documentService.pendingCount().catch(() => 0),
    ]).then(([recs, studs, emp, pending]) => {
      setRecords(recs);
      setStudents(studs);
      setEmployment(emp);
      setPendingDocs(pending);
    }).finally(() => setLoading(false));
  }, []);

  // ── Derived metrics (all from real data) ──
  const employedIds   = new Set(employment.filter(r => r.status === 'active' || r.status === 'completed').map(r => r.student_id));
  const employedCount = students.filter(s => employedIds.has(s.user_id)).length;
  const employmentRate = students.length > 0 ? Math.round((employedCount / students.length) * 100) : 0;
  const tracked = records.length;
  const atRisk  = records.filter(r => r.state === 'AtRisk' || r.state === 'NonCompliant').length;

  const stateLabel = (st: ComplianceState) =>
    t(`universityAnalytics.compliance.states.${st}`, { defaultValue: COMPLIANCE_META[st].def });

  const donutData = COMPLIANCE_DONUT_ORDER
    .map(st => ({ st, label: stateLabel(st), value: records.filter(r => r.state === st).length, color: COMPLIANCE_META[st].color }))
    .filter(d => d.value > 0);

  const goCompliance = (state?: ComplianceState) =>
    navigate(state ? `/analytics?tab=compliance&state=${state}` : '/analytics?tab=compliance');

  const statCards: { label: string; value: string | number; color: string; alert: boolean; onClick: () => void }[] = [
    { label: t('home.university.stats.students',  { defaultValue: 'Студентов' }),      value: students.length,      color: '#2563EB', alert: false,        onClick: () => navigate('/analytics?tab=programs') },
    { label: t('home.university.stats.employed',  { defaultValue: 'Трудоустроено' }),  value: `${employmentRate}%`, color: '#10B981', alert: false,        onClick: () => navigate('/analytics') },
    { label: t('home.university.stats.tracked',   { defaultValue: 'На контроле' }),    value: tracked,              color: '#6366F1', alert: false,        onClick: () => goCompliance() },
    { label: t('home.university.stats.atRisk',    { defaultValue: 'В зоне риска' }),    value: atRisk,               color: '#F59E0B', alert: atRisk > 0,   onClick: () => goCompliance('AtRisk') },
  ];

  return (
    <div className="space-y-6">

      {/* ── Welcome banner ── */}
      <section className="relative overflow-hidden rounded-2xl p-7 sm:p-10 text-white"
        style={{ background: 'linear-gradient(135deg,#7C3AED 0%,#4F46E5 100%)' }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full opacity-10 bg-white" />
        <div className="relative">
          <h1 className="text-2xl sm:text-4xl font-bold mb-1">
            {t('home.welcome.greeting', { name: email?.split('@')[0] })}
          </h1>
          <p className="text-purple-100">{t('home.university.subtitle')}</p>
        </div>
      </section>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c, i) => (
          <button key={i} onClick={c.onClick}
            className={`text-left bg-white rounded-2xl border p-5 transition-all hover:shadow-md ${
              c.alert ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200 hover:border-blue-200'
            }`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
              <span className="text-xs text-gray-500 font-medium">{c.label}</span>
            </div>
            {loading
              ? <div className="skeleton h-8 w-14" />
              : <p className="text-3xl font-bold" style={{ color: c.alert ? '#D97706' : '#111827' }}>{c.value}</p>}
          </button>
        ))}
      </div>

      {/* ── Main grid: compliance distribution + quick actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Compliance distribution (clickable donut) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {t('home.university.complianceTitle', { defaultValue: 'Грантовые обязательства' })}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {t('home.university.complianceSubtitle', { defaultValue: 'Распределение выпускников по статусам — нажмите для деталей' })}
              </p>
            </div>
            <button onClick={() => goCompliance()}
              className="text-sm font-medium text-blue-600 hover:underline shrink-0">
              {t('home.university.allDetails', { defaultValue: 'Подробнее' })} →
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-6">
              <div className="skeleton rounded-full" style={{ width: 132, height: 132 }} />
              <div className="flex-1 space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-4 w-full" />)}</div>
            </div>
          ) : tracked === 0 ? (
            <div className="py-8 text-center">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mx-auto mb-3">
                <Icon name="graduation-cap" size={28} />
              </div>
              <p className="text-gray-600 mb-4 max-w-sm mx-auto">
                {t('home.university.complianceEmpty', { defaultValue: 'Ни один выпускник ещё не на контроле грантовых обязательств' })}
              </p>
              <button onClick={() => goCompliance()}
                className="inline-block px-6 py-2.5 text-white font-semibold rounded-xl transition-colors"
                style={{ background: '#7C3AED' }}>
                {t('home.university.complianceEnroll', { defaultValue: 'Добавить выпускников →' })}
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ComplianceDonut
                data={donutData}
                onClick={() => goCompliance()}
                totalLabel={t('home.university.donutTotal', { defaultValue: 'всего' })}
              />
              <div className="flex-1 w-full space-y-1.5">
                {donutData.map(d => (
                  <button key={d.st} onClick={() => goCompliance(d.st)}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-sm text-gray-600 truncate group-hover:text-gray-900">{d.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 shrink-0">{d.value}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {t('home.university.quickActions', { defaultValue: 'Быстрые действия' })}
          </h2>
          <div className="space-y-2.5">
            {/* Verify documents */}
            <button onClick={() => navigate('/analytics?tab=programs')}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-amber-300 hover:bg-amber-50/40 transition-all text-left">
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Icon name="clipboard-list" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{t('home.university.verifyDocs', { defaultValue: 'Проверить справки' })}</p>
                {!loading && pendingDocs > 0 && (
                  <p className="text-xs text-amber-600 font-medium">{t('home.university.pendingDocs', { count: pendingDocs, defaultValue: `${pendingDocs} ожидают` })}</p>
                )}
              </div>
              {!loading && pendingDocs > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              )}
            </button>

            {/* At-risk */}
            <button onClick={() => goCompliance('AtRisk')}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50/40 transition-all text-left">
              <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <Icon name="alert-triangle" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{t('home.university.riskZone', { defaultValue: 'Зона риска' })}</p>
                {!loading && <p className="text-xs text-gray-400">{t('home.university.riskCount', { count: atRisk, defaultValue: `${atRisk} требуют внимания` })}</p>}
              </div>
            </button>

            {/* Full analytics */}
            <button onClick={() => navigate('/analytics')}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all text-left">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Icon name="chart-bar" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{t('home.university.fullAnalytics', { defaultValue: 'Полная аналитика' })}</p>
                <p className="text-xs text-gray-400">{t('home.university.fullAnalyticsHint', { defaultValue: 'Программы, трудоустройство, работодатели' })}</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Main
═══════════════════════════════════════════════════════════════ */
const HomePage = () => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) return <LandingPage />;

  switch (user?.role) {
    case 'student':    return <StudentHome userEmail={user.email} />;
    case 'employer':   return <EmployerHome email={user.email} />;
    case 'university': return <UniversityHome email={user.email} />;
    case 'admin':      return <Navigate to="/admin" replace />;
    default:           return <LandingPage />;
  }
};

export default HomePage;
