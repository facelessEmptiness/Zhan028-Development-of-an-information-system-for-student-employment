import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import JobCard from '../components/JobCard';
import MatchIndex from '../components/MatchIndex';
import { type JobPosting } from '../services/employerService';
import { applicationService } from '../services/applicationService';
import { studentService } from '../services/studentService';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/apiClient';

const PAGE_SIZE = 10;

const BrowseJobsPage = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') ?? '');
  const [selectedType, setSelectedType] = useState(searchParams.get('job_type') ?? '');
  const [selectedLocation, setSelectedLocation] = useState(searchParams.get('location') ?? '');
  const [page, setPage] = useState(1);

  const [vacancies, setVacancies] = useState<JobPosting[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const [studentSkills, setStudentSkills] = useState('');
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [applySubmitting, setApplySubmitting] = useState(false);

  // Debounce search term
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 400);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchTerm]);

  const fetchVacancies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedType) params.set('job_type', selectedType);
      if (selectedLocation) params.set('location', selectedLocation);

      const res = await apiFetch(`/api/vacancies/?${params.toString()}`, {
      });
      if (!res.ok) throw new Error(`Ошибка ${res.status}`);
      const data = await res.json();
      setVacancies(Array.isArray(data) ? data : (data.vacancies ?? []));
      setTotal(data.total ?? 0);

      // Sync URL params
      const urlParams: Record<string, string> = {};
      if (debouncedSearch) urlParams.q = debouncedSearch;
      if (selectedType) urlParams.job_type = selectedType;
      if (selectedLocation) urlParams.location = selectedLocation;
      setSearchParams(urlParams, { replace: true });
    } catch {
      toast.error(t('jobs.browse.loadError'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedType, selectedLocation, page, setSearchParams, t]);

  useEffect(() => {
    fetchVacancies();
  }, [fetchVacancies]);

  useEffect(() => {
    if (user?.role === 'student') {
      studentService.getProfile()
        .then((p) => setStudentSkills(p.skills || ''))
        .catch(() => {});
    }
  }, [user]);

  const handleApply = async () => {
    if (!applyingTo) return;
    setApplySubmitting(true);
    try {
      await applicationService.apply(applyingTo, coverLetter);
      toast.success(t('jobs.details.applySuccess'));
      setApplyingTo(null);
      setCoverLetter('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('jobs.details.applyError'));
    } finally {
      setApplySubmitting(false);
    }
  };

  const calculateMatchIndex = (studentSkillsStr: string, vacancySkillsStr: string): number => {
    if (!vacancySkillsStr?.trim()) return 50;
    const vacancy = vacancySkillsStr.split(',').map((s) => s.toLowerCase().trim()).filter(Boolean);
    if (vacancy.length === 0) return 50;
    const student = studentSkillsStr.split(',').map((s) => s.toLowerCase().trim()).filter(Boolean);
    if (student.length === 0) return 10;
    const matched = vacancy.filter((vs) => student.some((ss) => ss.includes(vs) || vs.includes(ss))).length;
    return Math.round((matched / vacancy.length) * 100);
  };

  const toJobCard = (v: JobPosting) => ({
    id: v.id,
    title: v.title,
    company: v.company_name || t('jobs.details.employer'),
    location: v.location || t('common.notSpecified'),
    salary: { min: v.salary_min, max: v.salary_max },
    type: v.job_type as 'Full-time' | 'Part-time' | 'Internship' | 'Contract',
    description: v.description,
    skills: v.skills ? v.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
    postedDate: new Date(v.created_at).toLocaleDateString('ru-RU'),
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">{t('jobs.browse.title')}</h1>
        <p className="text-xl text-gray-600">{t('jobs.browse.subtitle')}</p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24 space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">{t('jobs.browse.filters')}</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('jobs.browse.searchLabel')}</label>
              <input
                type="text"
                placeholder={t('jobs.browse.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('jobs.browse.jobType')}</label>
              <select
                value={selectedType}
                onChange={(e) => { setSelectedType(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('jobs.browse.allTypes')}</option>
                <option value="Full-time">{t('jobs.browse.fullTime')}</option>
                <option value="Part-time">{t('jobs.browse.partTime')}</option>
                <option value="Internship">{t('jobs.browse.internship')}</option>
                <option value="Contract">{t('jobs.browse.contract')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('jobs.browse.location')}</label>
              <input
                type="text"
                placeholder={t('jobs.browse.locationPlaceholder')}
                value={selectedLocation}
                onChange={(e) => { setSelectedLocation(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedType('');
                setSelectedLocation('');
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              {t('jobs.browse.resetFilters')}
            </button>
          </div>
        </div>

        {/* Job Results */}
        <div className="lg:col-span-3">
          {loading && (
            <div className="text-center py-16 text-gray-500">{t('jobs.browse.loading')}</div>
          )}

          {!loading && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-gray-600">
                  {t('jobs.browse.found')}{' '}
                  <span className="font-semibold text-gray-900">{total}</span> {t('jobs.browse.vacanciesCount')}
                </p>
                {totalPages > 1 && (
                  <p className="text-sm text-gray-500">
                    {t('jobs.browse.page', { page, total: totalPages })}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                {vacancies.length > 0 ? (
                  vacancies.map((v) => (
                    <div key={v.id} className="relative">
                      <JobCard {...toJobCard(v)} />
                      {user?.role === 'student' && (
                        <div className="absolute top-4 right-4 flex items-center gap-3">
                          {studentSkills && (
                            <div className="absolute top-14 right-4">
                              <MatchIndex
                                percentage={calculateMatchIndex(studentSkills, v.skills || '')}
                                size="sm"
                                showLabel={false}
                              />
                            </div>
                          )}
                          <button
                            onClick={() => {
                              setApplyingTo(v.id);
                              setCoverLetter('');
                            }}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow"
                          >
                            {t('jobs.browse.apply')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <p className="text-gray-600 mb-4">{t('jobs.browse.empty')}</p>
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedType('');
                        setSelectedLocation('');
                        setPage(1);
                      }}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      {t('jobs.browse.resetFilters')}
                    </button>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('jobs.browse.prev')}
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                    .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                      if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === '...' ? (
                        <span key={`dots-${idx}`} className="px-2 text-gray-400">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p as number)}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            page === p
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('jobs.browse.next')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Apply Modal */}
      {applyingTo !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-lg w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('jobs.applyModal.title')}</h2>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('jobs.applyModal.coverLetter')}
              </label>
              <textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder={t('jobs.applyModal.coverLetterPlaceholder')}
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleApply}
                disabled={applySubmitting}
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applySubmitting ? t('jobs.applyModal.submitting') : t('jobs.applyModal.submit')}
              </button>
              <button
                onClick={() => {
                  setApplyingTo(null);
                  setCoverLetter('');
                }}
                disabled={applySubmitting}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {t('jobs.applyModal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrowseJobsPage;
