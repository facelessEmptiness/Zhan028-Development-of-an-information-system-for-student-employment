import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context';
import { studentService, type BackendStudentProfile } from '../services/studentService';
import { applicationService, type Application } from '../services/applicationService';
import { type JobPosting } from '../services/employerService';
import { apiFetch } from '../utils/apiClient';

function matchScore(profile: BackendStudentProfile, vacancy: JobPosting): number {
  const studentSkills = (profile.skills || '')
    .split(',').map(s => s.toLowerCase().trim()).filter(Boolean);
  const vacancySkills = (vacancy.skills || '')
    .split(',').map(s => s.toLowerCase().trim()).filter(Boolean);

  // Skills overlap (0–70 points)
  let skillPoints = 0;
  if (vacancySkills.length > 0 && studentSkills.length > 0) {
    const matched = vacancySkills.filter(vs =>
      studentSkills.some(ss => ss.includes(vs) || vs.includes(ss))
    ).length;
    skillPoints = Math.round((matched / vacancySkills.length) * 70);
  } else if (vacancySkills.length === 0) {
    skillPoints = 35; // no requirements — neutral
  }

  // Specialization match in title/description (0–30 points)
  let specPoints = 0;
  const spec = (profile.specialization || '').toLowerCase();
  if (spec) {
    const titleLower = vacancy.title.toLowerCase();
    const descLower = vacancy.description.toLowerCase();
    const specWords = spec.split(/\s+/).filter(w => w.length > 3);
    const hits = specWords.filter(w => titleLower.includes(w) || descLower.includes(w)).length;
    if (specWords.length > 0) {
      specPoints = Math.round((hits / specWords.length) * 30);
    }
  }

  return skillPoints + specPoints;
}

const jobCategories = [
  { id: 1, labelKey: 'home.categories_list.it', count: '2 340', icon: '💻' },
  { id: 2, labelKey: 'home.categories_list.sales', count: '1 850', icon: '📊' },
  { id: 3, labelKey: 'home.categories_list.finance', count: '1 250', icon: '💰' },
  { id: 4, labelKey: 'home.categories_list.hr', count: '890', icon: '👥' },
  { id: 5, labelKey: 'home.categories_list.engineering', count: '1 560', icon: '⚙️' },
  { id: 6, labelKey: 'home.categories_list.medicine', count: '940', icon: '⚕️' },
  { id: 7, labelKey: 'home.categories_list.education', count: '720', icon: '🎓' },
  { id: 8, labelKey: 'home.categories_list.construction', count: '1 100', icon: '🏗️' },
];

// ── Landing Page ──────────────────────────────────────────────────────────────
const LandingPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="space-y-8">
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 sm:p-12 text-white text-center">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">{t('home.hero.title')}</h1>
        <p className="text-xl text-blue-100 mb-8">{t('home.hero.subtitle')}</p>
        <div className="bg-white rounded-xl p-4 mb-6 max-w-2xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder={t('home.hero.searchPlaceholder')}
              className="flex-1 px-4 py-2 text-gray-900 focus:outline-none"
            />
            <button
              onClick={() => navigate('/jobs')}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('home.hero.searchBtn')}
            </button>
          </div>
        </div>
        <div className="flex gap-4 justify-center flex-wrap">
          <button onClick={() => navigate('/register')} className="px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors">
            {t('home.hero.register')}
          </button>
          <button onClick={() => navigate('/login')} className="px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors">
            {t('home.hero.login')}
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('home.categories.title')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {jobCategories.map((category) => (
            <Link
              key={category.id}
              to="/jobs"
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="text-4xl mb-3">{category.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1 text-sm">{t(category.labelKey)}</h3>
              <p className="text-blue-600 font-bold">{category.count}</p>
              <p className="text-gray-500 text-xs">{t('home.categories.openPositions')}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

// ── Student Home ──────────────────────────────────────────────────────────────
const StudentHome = ({ userEmail }: { userEmail?: string }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState<BackendStudentProfile | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [recommended, setRecommended] = useState<(JobPosting & { score: number })[]>([]);
  const [loadingRec, setLoadingRec] = useState(false);

  useEffect(() => {
    Promise.all([
      studentService.getProfile().catch(() => null),
      applicationService.getMyApplications().catch(() => []),
    ]).then(([prof, apps]) => {
      setProfile(prof);
      setApplications(apps);
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
              .slice(0, 5);
            setRecommended(scored);
          })
          .catch(() => {})
          .finally(() => setLoadingRec(false));
      }
    });
  }, []);

  const calcCompletion = (p: BackendStudentProfile | null): number => {
    if (!p) return 0;
    const fields = [p.first_name, p.last_name, p.phone, p.bio, p.skills, p.specialization, p.graduation_year, p.location_city];
    const filled = fields.filter(f => f && String(f).trim() !== '' && String(f) !== '0').length;
    return Math.round((filled / fields.length) * 100);
  };

  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : userEmail?.split('@')[0];

  const completion = calcCompletion(profile);
  const appCount = applications.length;

  return (
    <div className="space-y-8">
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-1">{t('home.welcome.greeting', { name: displayName })}</h1>
        <p className="text-blue-100">{t('home.welcome.subtitle')}</p>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('home.student.searchTitle')}</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder={t('home.student.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                navigate(`/jobs?q=${encodeURIComponent(searchQuery.trim())}`);
              }
            }}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => navigate(searchQuery.trim() ? `/jobs?q=${encodeURIComponent(searchQuery.trim())}` : '/jobs')}
            className="px-6 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors py-3 whitespace-nowrap"
          >
            {t('home.hero.searchBtn')}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-gray-500 text-sm mb-2">{t('home.student.profileCompletion')}</p>
          {loadingStats ? (
            <div className="h-8 bg-gray-100 rounded animate-pulse w-20 mb-4" />
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900 mb-3">{completion}%</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${completion}%` }} />
              </div>
              {completion < 100 && (
                <Link to="/profile" className="text-sm text-blue-600 mt-2 inline-block hover:underline">
                  {t('home.student.fillProfile')}
                </Link>
              )}
            </>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-gray-500 text-sm mb-2">{t('home.student.myApplications')}</p>
          {loadingStats ? (
            <div className="h-8 bg-gray-100 rounded animate-pulse w-12" />
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900">{appCount}</p>
              <Link to="/my-applications" className="text-sm text-blue-600 mt-2 inline-block hover:underline">
                {t('home.student.viewAll')}
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { titleKey: 'home.student.profileCard', descriptionKey: 'home.student.profileDesc', icon: '👤', link: '/profile' },
          { titleKey: 'home.student.jobsCard', descriptionKey: 'home.student.jobsDesc', icon: '🔍', link: '/jobs' },
          { titleKey: 'home.student.applicationsCard', descriptionKey: 'home.student.applicationsDesc', icon: '📋', link: '/my-applications' },
        ].map((item) => (
          <Link
            key={item.link}
            to={item.link}
            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 transition-all"
          >
            <div className="text-3xl mb-3">{item.icon}</div>
            <h3 className="font-semibold text-gray-900 mb-1">{t(item.titleKey)}</h3>
            <p className="text-gray-500 text-sm">{t(item.descriptionKey)}</p>
          </Link>
        ))}
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">{t('home.student.recommended')}</h2>
          <Link to="/jobs" className="text-sm text-blue-600 hover:underline">{t('home.student.viewAllJobs')}</Link>
        </div>

        {loadingRec && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        )}

        {!loadingRec && recommended.length > 0 && (
          <div className="space-y-3">
            {recommended.map(v => (
              <Link
                key={v.id}
                to={`/job/${v.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-300 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{v.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {v.company_name || t('jobs.details.employer')}
                      {v.location ? ` · ${v.location}` : ''}
                    </p>
                    {v.skills && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {v.skills.split(',').slice(0, 4).map(s => (
                          <span key={s} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                            {s.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                      v.score >= 70 ? 'border-green-500 text-green-600 bg-green-50' :
                      v.score >= 40 ? 'border-blue-500 text-blue-600 bg-blue-50' :
                                      'border-gray-300 text-gray-500 bg-gray-50'
                    }`}>
                      {v.score}%
                    </div>
                    <span className="text-xs text-gray-400 mt-1">{t('home.student.match')}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loadingRec && recommended.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-gray-600 mb-4">{t('home.student.fillProfileForRec')}</p>
            <Link to="/profile" className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">
              {t('home.student.fillProfile')}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const HomePage = () => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) return <LandingPage />;

  switch (user?.role) {
    case 'student':
      return <StudentHome userEmail={user.email} />;
    case 'employer':
      return (
        <div className="space-y-8">
          <section className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
            <h1 className="text-3xl font-bold mb-1">{t('home.welcome.greeting', { name: user.email?.split('@')[0] })}</h1>
            <p className="text-blue-100">{t('home.employer.subtitle')}</p>
          </section>
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-5xl mb-4">💼</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{t('home.employer.title')}</h2>
            <p className="text-gray-600 mb-6">{t('home.employer.description')}</p>
            <Link to="/employer-dashboard" className="inline-block px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
              {t('home.employer.goToDashboard')}
            </Link>
          </div>
        </div>
      );
    case 'university':
    case 'admin':
      return (
        <div className="space-y-8">
          <section className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
            <h1 className="text-3xl font-bold mb-1">{t('home.welcome.greeting', { name: user.email?.split('@')[0] })}</h1>
            <p className="text-blue-100">{t('home.university.subtitle')}</p>
          </section>
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-5xl mb-4">🎓</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{t('home.university.title')}</h2>
            <p className="text-gray-600 mb-6">{t('home.university.description')}</p>
            <Link to="/analytics" className="inline-block px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
              {t('home.university.goToAnalytics')}
            </Link>
          </div>
        </div>
      );
    default:
      return <LandingPage />;
  }
};

export default HomePage;
