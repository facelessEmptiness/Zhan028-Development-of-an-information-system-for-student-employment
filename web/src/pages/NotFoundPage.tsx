import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGoHome = () => {
    if (!user) {
      navigate('/');
    } else if (user.role === 'student') {
      navigate('/profile');
    } else if (user.role === 'employer') {
      navigate('/employer-dashboard');
    } else if (user.role === 'university' || user.role === 'admin') {
      navigate('/analytics');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
      <div className="text-center max-w-lg">

        {/* Big 404 */}
        <div className="relative mb-8">
          <span className="text-[160px] font-black text-blue-100 leading-none select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-lg px-6 py-4 border border-blue-100">
              <svg
                className="w-12 h-12 text-blue-500 mx-auto mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm font-semibold text-gray-500">Страница не найдена</p>
            </div>
          </div>
        </div>

        {/* Text */}
        <h1 className="text-2xl font-bold text-gray-800 mb-3">
          Похоже, вы потерялись
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Страница, которую вы ищете, не существует или была перемещена.
          Проверьте адрес или вернитесь на главную.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleGoHome}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            На главную
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-white text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
          >
            Назад
          </button>
        </div>

        {/* Quick links */}
        {user && (
          <div className="mt-10 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-400 mb-4">Быстрые ссылки</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <a href="/jobs" className="text-sm text-blue-600 hover:underline px-3 py-1 bg-blue-50 rounded-full">
                Вакансии
              </a>
              {user.role === 'student' && (
                <>
                  <a href="/profile" className="text-sm text-blue-600 hover:underline px-3 py-1 bg-blue-50 rounded-full">
                    Мой профиль
                  </a>
                </>
              )}
              {user.role === 'employer' && (
                <a href="/employer-dashboard" className="text-sm text-blue-600 hover:underline px-3 py-1 bg-blue-50 rounded-full">
                  Панель работодателя
                </a>
              )}
              {(user.role === 'university' || user.role === 'admin') && (
                <a href="/analytics" className="text-sm text-blue-600 hover:underline px-3 py-1 bg-blue-50 rounded-full">
                  Аналитика
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
