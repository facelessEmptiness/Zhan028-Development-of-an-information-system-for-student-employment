import { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ComplianceRecord, ComplianceState } from '../services/complianceService';
import type { BackendStudentProfile } from '../services/studentService';

const STATE_META: Record<ComplianceState, { def: string; chip: string; dot: string; color: string }> = {
  NotYetDue:    { def: 'Срок не наступил', chip: 'bg-gray-100 text-gray-600',    dot: '#9CA3AF', color: '#9CA3AF' },
  InProgress:   { def: 'В процессе',       chip: 'bg-blue-50 text-blue-700',     dot: '#3B82F6', color: '#3B82F6' },
  Compliant:    { def: 'Выполнено',        chip: 'bg-green-50 text-green-700',   dot: '#10B981', color: '#10B981' },
  AtRisk:       { def: 'Под риском',       chip: 'bg-amber-50 text-amber-700',   dot: '#F59E0B', color: '#F59E0B' },
  NonCompliant: { def: 'Не выполнено',     chip: 'bg-red-50 text-red-700',       dot: '#EF4444', color: '#EF4444' },
  Exempt:       { def: 'Освобождён',       chip: 'bg-indigo-50 text-indigo-700', dot: '#6366F1', color: '#6366F1' },
};

const ORDER: ComplianceState[] = ['NotYetDue', 'InProgress', 'AtRisk', 'NonCompliant', 'Compliant', 'Exempt'];
const DONUT_STATES: ComplianceState[] = ['Compliant', 'InProgress', 'AtRisk', 'NonCompliant', 'NotYetDue', 'Exempt'];

const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('ru-RU') : '—');

const daysUntil = (deadline?: string): number | null => {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
};

// ── Inline donut chart (no external deps) ──
const DonutChart = ({ data, size = 140 }: { data: { label: string; value: number; color: string }[]; size?: number }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <div className="rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400"
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
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div style={{ width: size, height: size, borderRadius: '50%', background: `conic-gradient(${gradient})` }} />
      <div className="absolute flex flex-col items-center justify-center"
        style={{ top: off, left: off, width: inner, height: inner, borderRadius: '50%', background: 'white' }}>
        <span className="text-xl font-bold text-gray-900 leading-none">{total}</span>
        <span className="text-[10px] text-gray-400 mt-0.5">всего</span>
      </div>
    </div>
  );
};

interface Props {
  records: ComplianceRecord[];
  myStudents: BackendStudentProfile[];
  onEnroll?: (student: BackendStudentProfile) => void;
  onEnrollMany?: (students: BackendStudentProfile[]) => void;
  enrollingId?: string | null;
  enrollingIds?: Set<string>;
  initialFilter?: ComplianceState | null;
}

const CompliancePanel = ({ records, myStudents, onEnroll, onEnrollMany, enrollingId, enrollingIds, initialFilter }: Props) => {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<ComplianceState | null>(initialFilter ?? null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const indeterminateRef = useRef<HTMLInputElement>(null);

  const allEnrollingIds = useMemo(() => {
    const s = new Set(enrollingIds ?? []);
    if (enrollingId) s.add(enrollingId);
    return s;
  }, [enrollingId, enrollingIds]);

  const label = (st: ComplianceState) =>
    t(`universityAnalytics.compliance.states.${st}`, { defaultValue: STATE_META[st].def });

  const nameById = new Map(myStudents.map(s => [s.user_id, `${s.first_name} ${s.last_name}`.trim()]));
  const nameOf = (id: string) => nameById.get(id) || id.slice(0, 8);

  const total = records.length;
  const counts = ORDER.map(st => ({ st, n: records.filter(r => r.state === st).length }));
  const atRisk = records.filter(r => r.state === 'AtRisk' || r.state === 'NonCompliant');

  const trackedIds = new Set(records.map(r => r.student_id));
  const untracked = myStudents.filter(s => !trackedIds.has(s.user_id));

  const filteredRecords = activeFilter ? records.filter(r => r.state === activeFilter) : records;

  const searchLower = search.toLowerCase();
  const filteredUntracked = search
    ? untracked.filter(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchLower))
    : untracked;

  const allFilteredIds = filteredUntracked.map(s => s.user_id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id));
  const someSelected = allFilteredIds.some(id => selected.has(id));

  if (indeterminateRef.current) {
    indeterminateRef.current.indeterminate = someSelected && !allSelected;
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(prev => { const n = new Set(prev); allFilteredIds.forEach(id => n.delete(id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); allFilteredIds.forEach(id => n.add(id)); return n; });
    }
  };

  const handleBulkEnroll = () => {
    const toEnroll = filteredUntracked.filter(s => selected.has(s.user_id));
    if (!toEnroll.length) return;
    if (onEnrollMany) onEnrollMany(toEnroll); else if (onEnroll) toEnroll.forEach(s => onEnroll(s));
    setSelected(new Set());
  };

  const selectedCount = filteredUntracked.filter(s => selected.has(s.user_id)).length;

  // ── Days-remaining chip ──
  const daysChip = (deadline?: string) => {
    const d = daysUntil(deadline);
    if (d === null) return null;
    if (d < 0)  return { text: `${t('universityAnalytics.compliance.overdue', { defaultValue: 'Просрочено' })} ${Math.abs(d)} ${t('universityAnalytics.compliance.daysShort', { defaultValue: 'дн.' })}`, cls: 'bg-red-50 text-red-700 border border-red-200' };
    if (d === 0) return { text: t('universityAnalytics.compliance.today', { defaultValue: 'Сегодня' }), cls: 'bg-red-50 text-red-700 border border-red-200' };
    if (d <= 30) return { text: `${d} ${t('universityAnalytics.compliance.daysShort', { defaultValue: 'дн.' })}`, cls: 'bg-amber-50 text-amber-700 border border-amber-200' };
    return       { text: `${d} ${t('universityAnalytics.compliance.daysShort', { defaultValue: 'дн.' })}`, cls: 'bg-green-50 text-green-700 border border-green-200' };
  };

  // ── CSV export ──
  const exportCSV = () => {
    const colStudent  = t('universityAnalytics.compliance.cols.student',   { defaultValue: 'Студент' });
    const colState    = t('universityAnalytics.compliance.cols.state',     { defaultValue: 'Статус' });
    const colDeadline = t('universityAnalytics.compliance.cols.deadline',  { defaultValue: 'Дедлайн' });
    const colRemain   = t('universityAnalytics.compliance.cols.remaining', { defaultValue: 'Осталось (дн.)' });
    const colGrad     = t('universityAnalytics.compliance.cols.graduation',{ defaultValue: 'Выпуск' });
    const colYears    = t('universityAnalytics.compliance.cols.years',     { defaultValue: 'Срок' });

    const headers = [colStudent, colState, colDeadline, colRemain, colGrad, colYears];
    const rows = filteredRecords.map(r => {
      const days = daysUntil(r.deadline);
      return [
        nameOf(r.student_id),
        label(r.state),
        r.deadline ? fmtDate(r.deadline) : '—',
        days !== null ? String(days) : '—',
        r.graduation_date ? fmtDate(r.graduation_date) : '—',
        `${r.grant_years} ${t('universityAnalytics.compliance.yearsShort', { defaultValue: 'г.' })}`,
      ].map(c => `"${String(c).replace(/"/g, '""')}"`).join(',');
    });
    const csv = '﻿' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grant_compliance_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Donut data ──
  const donutData = DONUT_STATES
    .map(st => ({ label: label(st), value: records.filter(r => r.state === st).length, color: STATE_META[st].color }))
    .filter(d => d.value > 0);

  return (
    <div className="space-y-4">

      {/* ── Top row: status cards + donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Status cards (2/3 width) */}
        <div className="lg:col-span-2 grid grid-cols-3 sm:grid-cols-3 gap-3">
          {counts.map(({ st, n }) => {
            const isActive = activeFilter === st;
            const pct = total > 0 ? Math.round((n / total) * 100) : 0;
            return (
              <button
                key={st}
                onClick={() => setActiveFilter(isActive ? null : st)}
                className={`rounded-2xl border p-4 text-center transition-all cursor-pointer ${
                  isActive
                    ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-300 shadow-sm scale-[1.02]'
                    : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATE_META[st].dot }} />
                  <span className="text-[11px] text-gray-500 font-medium truncate">{label(st)}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{n}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {pct}% {t('universityAnalytics.compliance.ofTotal', { defaultValue: 'от всех' })}
                </p>
                {isActive && (
                  <p className="text-[10px] text-blue-500 font-semibold mt-0.5">
                    {t('universityAnalytics.compliance.filterActive', { defaultValue: 'фильтр' })}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Donut chart (1/3 width) */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            {t('universityAnalytics.compliance.chartTitle', { defaultValue: 'Распределение по статусам' })}
          </p>
          {total === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              {t('universityAnalytics.compliance.empty', { defaultValue: 'Нет данных' })}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <DonutChart data={donutData} size={100} />
              <div className="flex-1 space-y-1.5 min-w-0">
                {donutData.map(d => (
                  <div key={d.label} className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-gray-600 truncate">{d.label}</span>
                    </div>
                    <span className="font-semibold text-gray-800 shrink-0">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active filter banner */}
      {activeFilter && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATE_META[activeFilter].dot }} />
          <span className="text-sm text-blue-700 font-medium flex-1">
            {t('universityAnalytics.compliance.filterBanner', { defaultValue: 'Фильтр по статусу' })}:{' '}
            <strong>{label(activeFilter)}</strong>
            {' '}·{' '}
            <span className="font-normal">{filteredRecords.length} {t('universityAnalytics.compliance.filterCount', { defaultValue: 'записей' })}</span>
          </span>
          <button
            onClick={() => setActiveFilter(null)}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-semibold px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            {t('universityAnalytics.compliance.clearFilter', { defaultValue: 'Сбросить' })}
          </button>
        </div>
      )}

      {/* ── At-risk panel ── */}
      {(!activeFilter || activeFilter === 'AtRisk' || activeFilter === 'NonCompliant') && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            {atRisk.length > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />}
            <h2 className="font-semibold text-gray-900">
              {t('universityAnalytics.compliance.atRiskTitle', { defaultValue: 'Требуют внимания' })}
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{atRisk.length}</span>
          </div>
          {atRisk.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              {t('universityAnalytics.compliance.noAtRisk', { defaultValue: 'Нет студентов под риском' })}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {atRisk.map(r => {
                const chip = daysChip(r.deadline);
                return (
                  <div key={r.id} className="flex items-center gap-3 px-6 py-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{ background: r.state === 'NonCompliant' ? '#EF4444' : '#F59E0B' }}>
                      {nameOf(r.student_id).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{nameOf(r.student_id)}</p>
                      <p className="text-xs text-gray-400">
                        {t('universityAnalytics.compliance.cols.deadline', { defaultValue: 'Дедлайн' })}: {fmtDate(r.deadline)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {chip && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${chip.cls}`}>{chip.text}</span>
                      )}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATE_META[r.state].chip}`}>
                        {label(r.state)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── All tracked records ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <h2 className="font-semibold text-gray-900 flex-1">
            {t('universityAnalytics.compliance.allTitle', { defaultValue: 'Обязательства по гранту' })}
          </h2>
          {activeFilter && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATE_META[activeFilter].chip}`}>
              {filteredRecords.length} / {records.length}
            </span>
          )}
          {records.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {t('universityAnalytics.compliance.exportCsv', { defaultValue: 'CSV' })}
            </button>
          )}
        </div>

        {records.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <p>{t('universityAnalytics.compliance.empty', { defaultValue: 'Пока нет отслеживаемых студентов' })}</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <p>{t('universityAnalytics.compliance.noFilterResults', { defaultValue: 'Нет студентов с данным статусом' })}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">
                    {t('universityAnalytics.compliance.cols.student', { defaultValue: 'Студент' })}
                  </th>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">
                    {t('universityAnalytics.compliance.cols.state', { defaultValue: 'Статус' })}
                  </th>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">
                    {t('universityAnalytics.compliance.cols.graduation', { defaultValue: 'Выпуск' })}
                  </th>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">
                    {t('universityAnalytics.compliance.cols.deadline', { defaultValue: 'Дедлайн' })}
                  </th>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">
                    {t('universityAnalytics.compliance.cols.remaining', { defaultValue: 'Осталось' })}
                  </th>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">
                    {t('universityAnalytics.compliance.cols.years', { defaultValue: 'Срок' })}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRecords.map(r => {
                  const atr = r.state === 'AtRisk' || r.state === 'NonCompliant';
                  const chip = daysChip(r.deadline);
                  return (
                    <tr key={r.id} className={atr ? 'bg-amber-50/40' : 'hover:bg-gray-50 transition-colors'}>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{nameOf(r.student_id)}</td>
                      <td className="px-6 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATE_META[r.state].chip}`}>
                          {label(r.state)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">{fmtDate(r.graduation_date)}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{fmtDate(r.deadline)}</td>
                      <td className="px-6 py-3">
                        {chip
                          ? <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${chip.cls}`}>{chip.text}</span>
                          : <span className="text-xs text-gray-400">—</span>
                        }
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {r.grant_years} {t('universityAnalytics.compliance.yearsShort', { defaultValue: 'г.' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Enroll untracked students ── */}
      {onEnroll && untracked.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-gray-900">
                {t('universityAnalytics.compliance.untrackedTitle', { defaultValue: 'Не в отслеживании' })}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('universityAnalytics.compliance.untrackedHint', { defaultValue: 'Добавьте студентов с грантом, чтобы отслеживать выполнение обязательства' })}
              </p>
            </div>
            {selectedCount > 0 && (
              <button
                onClick={handleBulkEnroll}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('universityAnalytics.compliance.enrollSelected', { defaultValue: 'Отслеживать выбранных' })} ({selectedCount})
              </button>
            )}
          </div>

          {/* Search + select-all bar */}
          <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3 bg-gray-50/60">
            <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
              <input
                ref={indeterminateRef}
                type="checkbox"
                className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                checked={allSelected}
                onChange={toggleSelectAll}
              />
              <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
                {t('universityAnalytics.compliance.selectAll', { defaultValue: 'Выбрать всех' })}
              </span>
            </label>
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t('universityAnalytics.compliance.searchPlaceholder', { defaultValue: 'Поиск по имени...' })}
                className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <span className="text-xs text-gray-400 font-medium whitespace-nowrap shrink-0">
              {filteredUntracked.length} / {untracked.length}
            </span>
          </div>

          {filteredUntracked.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              {search
                ? t('universityAnalytics.compliance.noSearchResults', { defaultValue: 'Студенты не найдены' })
                : t('universityAnalytics.compliance.allTracked', { defaultValue: 'Все студенты уже отслеживаются' })
              }
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredUntracked.map(s => {
                const isSelected = selected.has(s.user_id);
                const isEnrolling = allEnrollingIds.has(s.user_id);
                return (
                  <div
                    key={s.id}
                    onClick={() => !isEnrolling && toggleSelect(s.user_id)}
                    className={`flex items-center gap-3 px-6 py-3 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/70' : 'hover:bg-gray-50'}`}
                  >
                    <input
                      type="checkbox" className="w-4 h-4 rounded accent-blue-600 shrink-0 cursor-pointer"
                      checked={isSelected} disabled={isEnrolling} onChange={() => {}}
                      onClick={e => e.stopPropagation()}
                    />
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0 transition-colors"
                      style={{ background: isSelected ? '#2563EB' : 'linear-gradient(135deg,#3B82F6,#6366F1)' }}
                    >
                      {(s.first_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{s.first_name} {s.last_name}</p>
                      {s.graduation_year > 0 && (
                        <p className="text-xs text-gray-400">
                          {t('universityAnalytics.compliance.cols.graduation', { defaultValue: 'Выпуск' })}: {s.graduation_year}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onEnroll(s);
                        setSelected(prev => { const n = new Set(prev); n.delete(s.user_id); return n; });
                      }}
                      disabled={isEnrolling}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                    >
                      {isEnrolling
                        ? t('common.loading', { defaultValue: 'Загрузка...' })
                        : t('universityAnalytics.compliance.enroll', { defaultValue: 'Отслеживать' })}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CompliancePanel;
