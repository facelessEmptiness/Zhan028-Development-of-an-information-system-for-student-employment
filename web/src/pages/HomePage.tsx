import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context';
import Icon from '../components/Icon';
import type { IconName } from '../components/icons';
import { studentService, type BackendStudentProfile } from '../services/studentService';
import { applicationService, type Application } from '../services/applicationService';
import { type JobPosting } from '../services/employerService';
import { employmentService, type EmploymentRecord } from '../services/employmentService';
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
  return (
    <div className="space-y-8">
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
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-4"><Icon name="briefcase" size={32} /></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">{t('home.employer.title')}</h2>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">{t('home.employer.description')}</p>
        <Link to="/employer-dashboard"
          className="inline-block px-8 py-3 text-white font-semibold rounded-xl transition-colors"
          style={{ background: '#2563EB' }}>
          {t('home.employer.goToDashboard')}
        </Link>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   University / Admin home
═══════════════════════════════════════════════════════════════ */
const UniversityHome = ({ email }: { email?: string }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
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
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mx-auto mb-4"><Icon name="graduation-cap" size={32} /></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">{t('home.university.title')}</h2>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">{t('home.university.description')}</p>
        <Link to="/analytics"
          className="inline-block px-8 py-3 text-white font-semibold rounded-xl transition-colors"
          style={{ background: '#7C3AED' }}>
          {t('home.university.goToAnalytics')}
        </Link>
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
    case 'university':
    case 'admin':      return <UniversityHome email={user.email} />;
    default:           return <LandingPage />;
  }
};

export default HomePage;
