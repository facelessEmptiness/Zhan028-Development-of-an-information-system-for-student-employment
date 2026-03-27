import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context';
import { studentService, type BackendStudentProfile } from '../services/studentService';
import { applicationService, type Application } from '../services/applicationService';

const jobCategories = [
  { id: 1, name: 'IT и разработка', count: '2 340', icon: '💻' },
  { id: 2, name: 'Продажи и маркетинг', count: '1 850', icon: '📊' },
  { id: 3, name: 'Финансы и бухучёт', count: '1 250', icon: '💰' },
  { id: 4, name: 'HR и кадры', count: '890', icon: '👥' },
  { id: 5, name: 'Инженерия', count: '1 560', icon: '⚙️' },
  { id: 6, name: 'Медицина', count: '940', icon: '⚕️' },
  { id: 7, name: 'Образование', count: '720', icon: '🎓' },
  { id: 8, name: 'Строительство', count: '1 100', icon: '🏗️' },
];

// ── Landing Page ──────────────────────────────────────────────────────────────
const LandingPage = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-8">
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 sm:p-12 text-white text-center">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">Найдите работу своей мечты</h1>
        <p className="text-xl text-blue-100 mb-8">Тысячи вакансий для студентов и выпускников Казахстана</p>
        <div className="bg-white rounded-xl p-4 mb-6 max-w-2xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Должность, ключевые слова"
              className="flex-1 px-4 py-2 text-gray-900 focus:outline-none"
            />
            <button
              onClick={() => navigate('/jobs')}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Найти
            </button>
          </div>
        </div>
        <div className="flex gap-4 justify-center flex-wrap">
          <button onClick={() => navigate('/register')} className="px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors">
            Зарегистрироваться
          </button>
          <button onClick={() => navigate('/login')} className="px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors">
            Войти
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Вакансии по профессиям</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {jobCategories.map((category) => (
            <Link
              key={category.id}
              to="/jobs"
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="text-4xl mb-3">{category.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1 text-sm">{category.name}</h3>
              <p className="text-blue-600 font-bold">{category.count}</p>
              <p className="text-gray-500 text-xs">открытых позиций</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

// ── Student Home ──────────────────────────────────────────────────────────────
const StudentHome = ({ userEmail }: { userEmail?: string }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState<BackendStudentProfile | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    Promise.all([
      studentService.getProfile().catch(() => null),
      applicationService.getMyApplications().catch(() => []),
    ]).then(([prof, apps]) => {
      setProfile(prof);
      setApplications(apps);
      setLoadingStats(false);
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
        <h1 className="text-3xl font-bold mb-1">Добро пожаловать, {displayName}!</h1>
        <p className="text-blue-100">Находите и откликайтесь на вакансии, подходящие вашим навыкам</p>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Поиск вакансий</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Название должности или ключевые слова"
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
            Найти
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-gray-500 text-sm mb-2">Заполненность профиля</p>
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
                  Заполнить профиль →
                </Link>
              )}
            </>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-gray-500 text-sm mb-2">Мои отклики</p>
          {loadingStats ? (
            <div className="h-8 bg-gray-100 rounded animate-pulse w-12" />
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900">{appCount}</p>
              <Link to="/my-applications" className="text-sm text-blue-600 mt-2 inline-block hover:underline">
                Посмотреть все →
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: 'Мой профиль', description: 'Заполните резюме и информацию', icon: '👤', link: '/profile' },
          { title: 'Вакансии', description: 'Просмотрите доступные вакансии', icon: '🔍', link: '/jobs' },
          { title: 'Мои отклики', description: 'Отслеживайте статус заявок', icon: '📋', link: '/my-applications' },
        ].map((item) => (
          <Link
            key={item.link}
            to={item.link}
            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 transition-all"
          >
            <div className="text-3xl mb-3">{item.icon}</div>
            <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
            <p className="text-gray-500 text-sm">{item.description}</p>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Рекомендуемые вакансии</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-gray-600 mb-4">Заполните профиль, чтобы получить персональные рекомендации</p>
          <Link to="/jobs" className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">
            Смотреть все вакансии
          </Link>
        </div>
      </section>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const HomePage = () => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) return <LandingPage />;

  switch (user?.role) {
    case 'student':
      return <StudentHome userEmail={user.email} />;
    case 'employer':
      return (
        <div className="space-y-8">
          <section className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
            <h1 className="text-3xl font-bold mb-1">Добро пожаловать, {user.email?.split('@')[0]}!</h1>
            <p className="text-blue-100">Управляйте вакансиями и находите лучших кандидатов</p>
          </section>
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-5xl mb-4">💼</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Панель работодателя</h2>
            <p className="text-gray-600 mb-6">Публикуйте вакансии, просматривайте кандидатов и управляйте откликами</p>
            <Link to="/employer-dashboard" className="inline-block px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
              Перейти в панель
            </Link>
          </div>
        </div>
      );
    case 'university':
    case 'admin':
      return (
        <div className="space-y-8">
          <section className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
            <h1 className="text-3xl font-bold mb-1">Добро пожаловать, {user.email?.split('@')[0]}!</h1>
            <p className="text-blue-100">Отслеживайте статистику трудоустройства выпускников</p>
          </section>
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-5xl mb-4">🎓</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Аналитика трудоустройства</h2>
            <p className="text-gray-600 mb-6">Полная статистика по трудоустройству студентов и анализ востребованных навыков</p>
            <Link to="/analytics" className="inline-block px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
              Перейти в аналитику
            </Link>
          </div>
        </div>
      );
    default:
      return <LandingPage />;
  }
};

export default HomePage;
