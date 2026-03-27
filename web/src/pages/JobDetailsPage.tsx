import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '../utils/apiClient';
import { applicationService } from '../services/applicationService';
import { useAuth } from '../context/AuthContext';
import { type JobPosting } from '../services/employerService';

const JobDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [job, setJob] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const res = await apiFetch(`/api/vacancies/${id}`);
        if (!res.ok) throw new Error(`Ошибка ${res.status}`);
        const data = await res.json();
        setJob(data);
      } catch {
        setLoadError(true);
        toast.error('Не удалось загрузить вакансию');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // Check if student already applied
  useEffect(() => {
    if (user?.role !== 'student' || !id) return;
    applicationService.getMyApplications()
      .then(apps => setAlreadyApplied(apps.some(a => a.vacancy_id === id)))
      .catch(() => {});
  }, [id, user]);

  const handleApply = async () => {
    if (!id) return;
    setApplying(true);
    try {
      await applicationService.apply(id, coverLetter);
      setApplySuccess(true);
      setAlreadyApplied(true);
      setShowForm(false);
      toast.success('Заявка успешно отправлена!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Ошибка при подаче заявки');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-gray-500">Загрузка вакансии...</div>;
  }
  if (loadError || !job) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">Вакансия не найдена</p>
        <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline">← Назад</button>
      </div>
    );
  }

  const skills = job.skills ? job.skills.split(',').map(s => s.trim()).filter(Boolean) : [];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium">
        ← Назад
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{job.title}</h1>
                <p className="text-xl text-gray-600 mb-4">{job.company_name || 'Работодатель'}</p>
                <div className="flex flex-wrap gap-4 text-gray-700">
                  {job.location && <span>📍 {job.location}</span>}
                  <span>💼 {job.job_type}</span>
                  {(job.salary_min > 0 || job.salary_max > 0) && (
                    <span>
                      💰{' '}
                      {job.salary_min > 0 ? `${job.salary_min.toLocaleString()}` : ''}
                      {job.salary_min > 0 && job.salary_max > 0 ? ' – ' : ''}
                      {job.salary_max > 0 ? `${job.salary_max.toLocaleString()} ₸` : ''}
                    </span>
                  )}
                  <span className="text-gray-400 text-sm">
                    Опубликовано: {new Date(job.created_at).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Описание вакансии</h2>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{job.description}</p>
          </div>

          {/* Skills */}
          {skills.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Требуемые навыки</h2>
              <div className="flex flex-wrap gap-3">
                {skills.map((skill) => (
                  <span key={skill} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24 space-y-4">

            {/* Apply success */}
            {(applySuccess || alreadyApplied) && !showForm && (
              <div className="text-center py-4">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-lg font-semibold text-gray-900 mb-1">Заявка отправлена!</p>
                <p className="text-sm text-gray-500">Работодатель рассмотрит вашу кандидатуру</p>
                <button
                  onClick={() => navigate('/profile')}
                  className="mt-4 w-full px-4 py-2 bg-blue-50 text-blue-600 font-medium rounded-lg hover:bg-blue-100"
                >
                  Мои заявки
                </button>
              </div>
            )}

            {/* Apply button for students */}
            {user?.role === 'student' && !alreadyApplied && !applySuccess && !showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Подать заявку
              </button>
            )}

            {/* Apply form */}
            {showForm && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Сопроводительное письмо</h3>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="Расскажите почему вы подходите для этой роли..."
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {applying ? 'Отправка...' : 'Отправить заявку'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="w-full px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            )}

            {/* Info for non-students */}
            {user?.role !== 'student' && (
              <p className="text-sm text-gray-500 text-center">
                Только студенты могут подавать заявки
              </p>
            )}

            {/* Status badge */}
            <div className="pt-2 border-t border-gray-100">
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${job.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {job.status === 'active' ? 'Активна' : 'Закрыта'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetailsPage;
