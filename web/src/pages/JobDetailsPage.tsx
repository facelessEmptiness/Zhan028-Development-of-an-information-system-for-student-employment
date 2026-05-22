import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon';
import { apiFetch } from '../utils/apiClient';
import { parseSkills } from '../utils';
import { applicationService } from '../services/applicationService';
import { useAuth } from '../context/AuthContext';
import { type JobPosting } from '../services/employerService';

function getCompanyColor(company: string): string {
  const colors = ['#EF2D30','#00B74F','#FF7A00','#0033A0','#7C3AED','#2563EB','#E11D48','#0891B2'];
  return colors[company.charCodeAt(0) % colors.length];
}

const JobDetailsPage = () => {
  const { t } = useTranslation();
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
        toast.error(t('jobs.details.loadError'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, t]);

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
      toast.success(t('jobs.details.applySuccess'));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('jobs.details.applyError'));
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-gray-500">{t('jobs.details.loading')}</div>;
  }
  if (loadError || !job) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">{t('jobs.details.notFound')}</p>
        <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline">{t('common.back')}</button>
      </div>
    );
  }

  const skills = parseSkills(job.skills);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 font-medium">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        {t('common.back')}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Main */}
        <div className="space-y-5">
          {/* Banner header card */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="h-20" style={{ background: `linear-gradient(135deg, ${getCompanyColor(job.company_name || '')}30, ${getCompanyColor(job.company_name || '')}08)` }} />
            <div className="px-6 pb-6 -mt-8">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-end gap-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-sm" style={{ background: getCompanyColor(job.company_name || '') }}>
                    {(job.company_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="pb-1">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{job.title}</h1>
                    <p className="text-gray-600">{job.company_name || t('jobs.details.employer')}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-gray-100 text-left">
                {job.location && <div><p className="text-[11px] text-gray-500 mb-0.5">{t('jobs.browse.location')}</p><p className="text-sm font-semibold text-gray-900 flex items-center gap-1"><Icon name="pin" size={14} className="text-gray-400 shrink-0" />{job.location}</p></div>}
                {(job.salary_min > 0 || job.salary_max > 0) && (
                  <div><p className="text-[11px] text-gray-500 mb-0.5">₸</p><p className="text-sm font-semibold text-gray-900">{job.salary_min > 0 ? job.salary_min.toLocaleString() : ''}{job.salary_min > 0 && job.salary_max > 0 ? ' – ' : ''}{job.salary_max > 0 ? job.salary_max.toLocaleString() + ' ₸' : ''}</p></div>
                )}
                <div><p className="text-[11px] text-gray-500 mb-0.5">{t('jobs.browse.jobType')}</p><span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full font-medium">{job.job_type}</span></div>
                <div><p className="text-[11px] text-gray-500 mb-0.5">{t('jobs.details.published')}</p><p className="text-sm font-semibold text-gray-900">{new Date(job.created_at).toLocaleDateString('ru-RU')}</p></div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">{t('jobs.details.description')}</h2>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{job.description}</p>
          </div>

          {/* Skills */}
          {skills.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">{t('jobs.details.skills')}</h2>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span key={skill} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-medium text-sm">{skill}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4 lg:sticky lg:top-20 self-start">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            {(applySuccess || alreadyApplied) && !showForm && (
              <div className="text-center py-4">
                <div className="mb-3 text-green-500 flex justify-center"><Icon name="check-circle" size={40} /></div>
                <p className="font-semibold text-gray-900 mb-1">{t('jobs.details.successTitle')}</p>
                <p className="text-sm text-gray-500">{t('jobs.details.successMessage')}</p>
                <button onClick={() => navigate('/profile')} className="mt-4 w-full px-4 py-2 bg-blue-50 text-blue-600 font-medium rounded-lg hover:bg-blue-100 text-sm">
                  {t('jobs.details.myApplications')}
                </button>
              </div>
            )}

            {user?.role === 'student' && !alreadyApplied && !applySuccess && !showForm && (
              <button onClick={() => setShowForm(true)} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                {t('jobs.details.applyBtn')}
              </button>
            )}

            {showForm && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 text-sm">{t('jobs.details.coverLetter')}</h3>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder={t('jobs.details.coverLetterPlaceholder')}
                  rows={5}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={handleApply} disabled={applying} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm">
                  {applying ? t('jobs.details.submitting') : t('jobs.details.submit')}
                </button>
                <button onClick={() => setShowForm(false)} className="w-full py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 text-sm">
                  {t('common.cancel')}
                </button>
              </div>
            )}

            {user?.role !== 'student' && !showForm && !(applySuccess || alreadyApplied) && (
              <p className="text-sm text-gray-500 text-center py-2">{t('jobs.details.onlyStudents')}</p>
            )}

            <div className="pt-2 border-t border-gray-100">
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${job.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {job.status === 'active' ? t('jobs.details.active') : t('jobs.details.closed')}
              </span>
            </div>
          </div>

          {/* Company card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: getCompanyColor(job.company_name || '') }}>
                {(job.company_name || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{job.company_name || t('jobs.details.employer')}</p>
                {job.location && <p className="text-xs text-gray-500 flex items-center gap-1"><Icon name="pin" size={12} className="shrink-0" />{job.location}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetailsPage;
