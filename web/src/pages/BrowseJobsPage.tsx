import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import JobCard from '../components/JobCard';
import { type JobPosting } from '../services/employerService';
import { applicationService } from '../services/applicationService';
import { studentService } from '../services/studentService';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/apiClient';

const PAGE_SIZE = 10;

const PRESET_CITIES = ['Алматы', 'Астана', 'Шымкент', 'Қарағанды'];

const JOB_TYPES = [
  { value: 'Full-time',   labelKey: 'jobs.browse.fullTime' },
  { value: 'Part-time',   labelKey: 'jobs.browse.partTime' },
  { value: 'Internship',  labelKey: 'jobs.browse.internship' },
  { value: 'Contract',    labelKey: 'jobs.browse.contract' },
  { value: 'Remote',      labelKey: 'jobs.browse.remote' },
];

const BrowseJobsPage = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchTerm, setSearchTerm]               = useState(searchParams.get('q') ?? '');
  const [locationInput, setLocationInput]         = useState(searchParams.get('location') ?? '');
  const [selectedTypes, setSelectedTypes]         = useState<string[]>(() => {
    const t = searchParams.get('job_type'); return t ? [t] : [];
  });
  const [selectedLocation, setSelectedLocation]   = useState(searchParams.get('location') ?? '');
  const [salaryMin, setSalaryMin]                 = useState(searchParams.get('salary_min') ?? '');
  const [salaryMax, setSalaryMax]                 = useState(searchParams.get('salary_max') ?? '');
  const [selectedSkills, setSelectedSkills]       = useState<string[]>([]);
  const [sortBy, setSortBy]                       = useState('relevance');
  const [page, setPage]                           = useState(1);

  // Pending filter state (applied on button click)
  const [pendingTypes, setPendingTypes]           = useState<string[]>(selectedTypes);
  const [pendingLocation, setPendingLocation]     = useState(selectedLocation);
  const [pendingMin, setPendingMin]               = useState(salaryMin);
  const [pendingMax, setPendingMax]               = useState(salaryMax);
  const [pendingSkills, setPendingSkills]         = useState<string[]>(selectedSkills);

  const [vacancies, setVacancies]                 = useState<JobPosting[]>([]);
  const [total, setTotal]                         = useState(0);
  const [loading, setLoading]                     = useState(true);
  const [showFilters, setShowFilters]             = useState(false);

  const { user } = useAuth();
  const [studentSkills, setStudentSkills]         = useState('');
  const [applyingTo, setApplyingTo]               = useState<string | null>(null);
  const [coverLetter, setCoverLetter]             = useState('');
  const [applySubmitting, setApplySubmitting]     = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch]     = useState(searchTerm);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(1); }, 400);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [searchTerm]);

  const fetchVacancies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedTypes.length === 1) params.set('job_type', selectedTypes[0]);
      if (selectedLocation) params.set('location', selectedLocation);
      if (salaryMin) params.set('salary_min', salaryMin);
      if (salaryMax) params.set('salary_max', salaryMax);
      if (selectedSkills.length > 0) params.set('skills', selectedSkills.join(','));
      if (sortBy && sortBy !== 'relevance') params.set('sort', sortBy);

      const res = await apiFetch(`/api/vacancies/?${params.toString()}`);
      if (!res.ok) throw new Error(`Ошибка ${res.status}`);
      const data = await res.json();
      setVacancies(Array.isArray(data) ? data : (data.vacancies ?? []));
      setTotal(data.total ?? 0);

      const urlParams: Record<string, string> = {};
      if (debouncedSearch) urlParams.q = debouncedSearch;
      if (selectedTypes.length === 1) urlParams.job_type = selectedTypes[0];
      if (selectedLocation) urlParams.location = selectedLocation;
      if (salaryMin) urlParams.salary_min = salaryMin;
      if (salaryMax) urlParams.salary_max = salaryMax;
      setSearchParams(urlParams, { replace: true });
    } catch {
      toast.error(t('jobs.browse.loadError'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedTypes, selectedLocation, salaryMin, salaryMax, selectedSkills, sortBy, page, setSearchParams, t]);

  useEffect(() => { fetchVacancies(); }, [fetchVacancies]);

  useEffect(() => {
    if (user?.role === 'student') {
      studentService.getProfile().then(p => setStudentSkills(p.skills || '')).catch(() => {});
    }
  }, [user]);

  const applyFilters = () => {
    setSelectedTypes(pendingTypes);
    setSelectedLocation(pendingLocation);
    setSalaryMin(pendingMin);
    setSalaryMax(pendingMax);
    setSelectedSkills(pendingSkills);
    setLocationInput(pendingLocation);
    setPage(1);
    setShowFilters(false);
  };

  const resetFilters = () => {
    setPendingTypes([]);        setSelectedTypes([]);
    setPendingLocation('');     setSelectedLocation('');
    setPendingMin('');          setSalaryMin('');
    setPendingMax('');          setSalaryMax('');
    setPendingSkills([]);       setSelectedSkills([]);
    setSearchTerm('');
    setLocationInput('');
    setPage(1);
  };

  const handleApply = async () => {
    if (!applyingTo) return;
    setApplySubmitting(true);
    try {
      await applicationService.apply(applyingTo, coverLetter);
      toast.success(t('jobs.details.applySuccess'));
      setApplyingTo(null); setCoverLetter('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('jobs.details.applyError'));
    } finally {
      setApplySubmitting(false);
    }
  };

  const calculateMatchIndex = (studentSkillsStr: string, vacancySkillsStr: string): number => {
    if (!vacancySkillsStr?.trim()) return 50;
    const vacancy = vacancySkillsStr.split(',').map(s => s.toLowerCase().trim()).filter(Boolean);
    if (vacancy.length === 0) return 50;
    const student = studentSkillsStr.split(',').map(s => s.toLowerCase().trim()).filter(Boolean);
    if (student.length === 0) return 10;
    const matched = vacancy.filter(vs => student.some(ss => ss.includes(vs) || vs.includes(ss))).length;
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
    skills: v.skills ? v.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
    postedDate: new Date(v.created_at).toLocaleDateString('ru-RU'),
  });

  // Extract unique skills from loaded vacancies for sidebar chips
  const sidebarSkillOptions = useMemo(() => {
    const set = new Set<string>();
    vacancies.forEach(v => { if (v.skills) v.skills.split(',').map(s => s.trim()).filter(Boolean).forEach(s => set.add(s)); });
    return Array.from(set).slice(0, 12);
  }, [vacancies]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasActiveFilters = selectedTypes.length > 0 || selectedLocation || salaryMin || salaryMax || selectedSkills.length > 0;

  const togglePendingType = (val: string) => {
    setPendingTypes(prev => prev.includes(val) ? prev.filter(t => t !== val) : [...prev, val]);
  };
  const togglePendingSkill = (s: string) => {
    setPendingSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const salaryMinNum = pendingMin ? parseInt(pendingMin) / 1000 : 0;
  const salaryMaxNum = pendingMax ? parseInt(pendingMax) / 1000 : 2000;

  return (
    <div>
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('jobs.browse.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {loading
            ? t('jobs.browse.loading')
            : `${total} ${t('jobs.browse.vacanciesCount')} · ${t('jobs.browse.updatedRecently')}`}
        </p>
      </div>

      {/* Top search bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-5 flex flex-col md:flex-row gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 border border-gray-200 rounded-lg">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            className="flex-1 py-2 text-sm text-gray-900 focus:outline-none"
            placeholder={t('jobs.browse.searchPlaceholder')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 px-3 border border-gray-200 rounded-lg">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0L6.343 16.657A8 8 0 1117.657 16.657z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          <input
            className="py-2 text-sm text-gray-900 focus:outline-none w-28"
            placeholder={t('jobs.browse.locationPlaceholder')}
            value={locationInput}
            onChange={e => { setLocationInput(e.target.value); setPendingLocation(e.target.value); }}
            onBlur={() => { setSelectedLocation(locationInput); setPage(1); }}
            onKeyDown={e => { if (e.key === 'Enter') { setSelectedLocation(locationInput); setPage(1); } }}
          />
        </div>
        <button
          className="md:hidden px-4 py-2 text-sm font-medium bg-gray-100 rounded-lg text-gray-700"
          onClick={() => setShowFilters(v => !v)}
        >
          {t('jobs.browse.filters')}
          {hasActiveFilters && <span className="ml-1.5 w-1.5 h-1.5 bg-blue-600 rounded-full inline-block"/>}
        </button>
        <button
          onClick={() => { setSelectedLocation(locationInput); setPage(1); }}
          className="px-6 py-2 text-white font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors text-sm"
        >
          {t('home.hero.searchBtn')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5">
        {/* ── Filter Sidebar ── */}
        <aside className={`${showFilters ? 'block' : 'hidden'} md:block`}>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 md:sticky md:top-24 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{t('jobs.browse.filters')}</h3>
              <button onClick={resetFilters} className="text-xs font-medium text-blue-600 hover:underline">
                {t('jobs.browse.resetFilters')}
              </button>
            </div>

            {/* Job type checkboxes */}
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">{t('jobs.browse.jobType')}</p>
              <div className="space-y-2">
                {JOB_TYPES.map(opt => (
                  <label key={opt.value} className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                    <input
                      type="checkbox"
                      checked={pendingTypes.includes(opt.value)}
                      onChange={() => togglePendingType(opt.value)}
                      className="w-4 h-4 rounded accent-blue-600"
                    />
                    {t(opt.labelKey)}
                  </label>
                ))}
              </div>
            </div>

            {/* City radio buttons */}
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">{t('jobs.browse.city')}</p>
              <div className="space-y-2">
                {PRESET_CITIES.map(city => (
                  <label key={city} className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                    <input
                      type="radio"
                      name="city"
                      checked={pendingLocation === city}
                      onChange={() => { setPendingLocation(city); setLocationInput(city); }}
                      className="w-4 h-4 accent-blue-600"
                    />
                    {city}
                  </label>
                ))}
                <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                  <input
                    type="radio"
                    name="city"
                    checked={pendingLocation === ''}
                    onChange={() => { setPendingLocation(''); setLocationInput(''); }}
                    className="w-4 h-4 accent-blue-600"
                  />
                  {t('jobs.browse.anyCity')}
                </label>
              </div>
            </div>

            {/* Salary range */}
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">{t('jobs.browse.salaryThousands')}</p>
              <div className="flex gap-2 mb-3">
                <input
                  type="number" min={0} placeholder={t('jobs.browse.salaryFrom')}
                  value={pendingMin ? Math.round(parseInt(pendingMin) / 1000) : ''}
                  onChange={e => setPendingMin(e.target.value ? String(parseInt(e.target.value) * 1000) : '')}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="number" min={0} placeholder={t('jobs.browse.salaryTo')}
                  value={pendingMax ? Math.round(parseInt(pendingMax) / 1000) : ''}
                  onChange={e => setPendingMax(e.target.value ? String(parseInt(e.target.value) * 1000) : '')}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {/* Visual range track */}
              <div className="relative pt-1">
                <div className="h-1.5 bg-gray-100 rounded-full relative">
                  <div
                    className="absolute h-1.5 bg-blue-500 rounded-full"
                    style={{
                      left: `${Math.min((salaryMinNum / 2000) * 100, 100)}%`,
                      right: `${Math.max(100 - (salaryMaxNum / 2000) * 100, 0)}%`,
                    }}
                  />
                </div>
                <input
                  type="range" min={0} max={2000} step={50}
                  value={salaryMinNum}
                  onChange={e => setPendingMin(String(parseInt(e.target.value) * 1000))}
                  className="absolute inset-0 w-full opacity-0 h-4 cursor-pointer"
                />
              </div>
            </div>

            {/* Skills chips */}
            {sidebarSkillOptions.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">{t('jobs.browse.skills')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {sidebarSkillOptions.map(s => (
                    <button
                      key={s}
                      onClick={() => togglePendingSkill(s)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        pendingSkills.includes(s)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Apply button */}
            <button
              onClick={applyFilters}
              className="w-full py-2.5 text-white font-semibold rounded-xl text-sm bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              {t('jobs.browse.applyFilters')}
            </button>
          </div>
        </aside>

        {/* ── Results ── */}
        <div>
          {/* Active chips + sort row */}
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <div className="flex flex-wrap gap-2">
              {selectedTypes.map(type => (
                <span key={type} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-white text-gray-700 font-medium">
                  {type}
                  <button onClick={() => { setSelectedTypes(p => p.filter(t => t !== type)); setPendingTypes(p => p.filter(t => t !== type)); setPage(1); }} className="text-gray-400 hover:text-gray-700 ml-0.5">×</button>
                </span>
              ))}
              {selectedLocation && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-white text-gray-700 font-medium">
                  {selectedLocation}
                  <button onClick={() => { setSelectedLocation(''); setPendingLocation(''); setLocationInput(''); setPage(1); }} className="text-gray-400 hover:text-gray-700 ml-0.5">×</button>
                </span>
              )}
              {(salaryMin || salaryMax) && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-white text-gray-700 font-medium">
                  {salaryMin ? Math.round(parseInt(salaryMin) / 1000) : '0'}–{salaryMax ? Math.round(parseInt(salaryMax) / 1000) : '∞'}k ₸
                  <button onClick={() => { setSalaryMin(''); setSalaryMax(''); setPendingMin(''); setPendingMax(''); setPage(1); }} className="text-gray-400 hover:text-gray-700 ml-0.5">×</button>
                </span>
              )}
              {selectedSkills.map(s => (
                <span key={s} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 font-medium">
                  {s}
                  <button onClick={() => { setSelectedSkills(p => p.filter(x => x !== s)); setPendingSkills(p => p.filter(x => x !== s)); setPage(1); }} className="text-blue-400 hover:text-blue-700 ml-0.5">×</button>
                </span>
              ))}
            </div>

            {/* Sort dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-500">{t('jobs.browse.sortLabel')}</span>
              <select
                value={sortBy}
                onChange={e => { setSortBy(e.target.value); setPage(1); }}
                className="text-sm font-medium text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="relevance">{t('jobs.browse.sortRelevance')}</option>
                <option value="date">{t('jobs.browse.sortDate')}</option>
                <option value="salary_desc">{t('jobs.browse.sortSalaryDesc')}</option>
                <option value="salary_asc">{t('jobs.browse.sortSalaryAsc')}</option>
              </select>
            </div>
          </div>

          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-2xl border border-gray-200 h-48 animate-pulse"/>)}
            </div>
          )}

          {!loading && (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {vacancies.length > 0 ? (
                  vacancies.map(v => (
                    <div key={v.id} className="relative group">
                      <JobCard
                        {...toJobCard(v)}
                        matchIndex={studentSkills ? calculateMatchIndex(studentSkills, v.skills || '') : undefined}
                      />
                      {user?.role === 'student' && (
                        <div className="absolute bottom-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => { e.preventDefault(); setApplyingTo(v.id); setCoverLetter(''); }}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow"
                          >
                            {t('jobs.browse.apply')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 bg-white rounded-2xl border border-gray-200 p-12 text-center">
                    <div className="text-4xl mb-3">🔍</div>
                    <p className="text-gray-600 mb-4">{t('jobs.browse.empty')}</p>
                    <button onClick={resetFilters} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
                      {t('jobs.browse.resetFilters')}
                    </button>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-9 h-9 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 disabled:opacity-40 flex items-center justify-center"
                  >‹</button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                    .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                      if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                      acc.push(p); return acc;
                    }, [])
                    .map((p, idx) =>
                      p === '...' ? (
                        <span key={`dots-${idx}`} className="px-2 text-gray-400">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p as number)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                            page === p ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}

                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-9 h-9 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center"
                  >›</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Apply Modal */}
      {applyingTo !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => { setApplyingTo(null); setCoverLetter(''); }}>
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{t('jobs.applyModal.title')}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{vacancies.find(v => v.id === applyingTo)?.title}</p>
              </div>
              <button onClick={() => { setApplyingTo(null); setCoverLetter(''); }} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('jobs.applyModal.coverLetter')}</label>
                <textarea
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                  placeholder={t('jobs.applyModal.coverLetterPlaceholder')}
                  rows={5}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">{coverLetter.length} / 2000</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => { setApplyingTo(null); setCoverLetter(''); }} disabled={applySubmitting} className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg">
                {t('jobs.applyModal.cancel')}
              </button>
              <button onClick={handleApply} disabled={applySubmitting} className="px-5 py-2 text-sm text-white font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {applySubmitting ? t('jobs.applyModal.submitting') : t('jobs.applyModal.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrowseJobsPage;
