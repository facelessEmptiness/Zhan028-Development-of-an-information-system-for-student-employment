import { useTranslation } from 'react-i18next';
import type { ComplianceRecord, ComplianceState } from '../services/complianceService';
import type { BackendStudentProfile } from '../services/studentService';

const STATE_META: Record<ComplianceState, { def: string; chip: string; dot: string }> = {
  NotYetDue:    { def: 'Срок не наступил', chip: 'bg-gray-100 text-gray-600',   dot: '#9CA3AF' },
  InProgress:   { def: 'В процессе',       chip: 'bg-blue-50 text-blue-700',    dot: '#3B82F6' },
  Compliant:    { def: 'Выполнено',        chip: 'bg-green-50 text-green-700',  dot: '#10B981' },
  AtRisk:       { def: 'Под риском',       chip: 'bg-amber-50 text-amber-700',  dot: '#F59E0B' },
  NonCompliant: { def: 'Не выполнено',     chip: 'bg-red-50 text-red-700',      dot: '#EF4444' },
  Exempt:       { def: 'Освобождён',       chip: 'bg-indigo-50 text-indigo-700', dot: '#6366F1' },
};

const ORDER: ComplianceState[] = ['NotYetDue', 'InProgress', 'AtRisk', 'NonCompliant', 'Compliant', 'Exempt'];

const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('ru-RU') : '—');

interface Props {
  records: ComplianceRecord[];
  myStudents: BackendStudentProfile[];
  onEnroll?: (student: BackendStudentProfile) => void;
  enrollingId?: string | null;
}

const CompliancePanel = ({ records, myStudents, onEnroll, enrollingId }: Props) => {
  const { t } = useTranslation();
  const label = (st: ComplianceState) =>
    t(`universityAnalytics.compliance.states.${st}`, { defaultValue: STATE_META[st].def });

  const nameById = new Map(myStudents.map(s => [s.user_id, `${s.first_name} ${s.last_name}`.trim()]));
  const nameOf = (id: string) => nameById.get(id) || id.slice(0, 8);

  const counts = ORDER.map(st => ({ st, n: records.filter(r => r.state === st).length }));
  const atRisk = records.filter(r => r.state === 'AtRisk' || r.state === 'NonCompliant');

  const trackedIds = new Set(records.map(r => r.student_id));
  const untracked = myStudents.filter(s => !trackedIds.has(s.user_id));

  return (
    <div className="space-y-4">
      {/* ── State summary chips ── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {counts.map(({ st, n }) => (
          <div key={st} className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATE_META[st].dot }} />
              <span className="text-[11px] text-gray-500 font-medium truncate">{label(st)}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{n}</p>
          </div>
        ))}
      </div>

      {/* ── At-risk attention panel ── */}
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
            {atRisk.map(r => (
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
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATE_META[r.state].chip}`}>
                  {label(r.state)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── All tracked records ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {t('universityAnalytics.compliance.allTitle', { defaultValue: 'Обязательства по гранту' })}
          </h2>
        </div>
        {records.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <p>{t('universityAnalytics.compliance.empty', { defaultValue: 'Пока нет отслеживаемых студентов' })}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{t('universityAnalytics.compliance.cols.student', { defaultValue: 'Студент' })}</th>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{t('universityAnalytics.compliance.cols.state', { defaultValue: 'Статус' })}</th>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{t('universityAnalytics.compliance.cols.graduation', { defaultValue: 'Выпуск' })}</th>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{t('universityAnalytics.compliance.cols.deadline', { defaultValue: 'Дедлайн' })}</th>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{t('universityAnalytics.compliance.cols.years', { defaultValue: 'Срок' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map(r => {
                  const atr = r.state === 'AtRisk' || r.state === 'NonCompliant';
                  return (
                    <tr key={r.id} className={atr ? 'bg-amber-50/40' : ''}>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{nameOf(r.student_id)}</td>
                      <td className="px-6 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATE_META[r.state].chip}`}>{label(r.state)}</span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">{fmtDate(r.graduation_date)}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{fmtDate(r.deadline)}</td>
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
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">
              {t('universityAnalytics.compliance.untrackedTitle', { defaultValue: 'Не в отслеживании' })}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {t('universityAnalytics.compliance.untrackedHint', { defaultValue: 'Добавьте студентов с грантом, чтобы отслеживать выполнение обязательства' })}
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {untracked.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-6 py-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
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
                  onClick={() => onEnroll(s)}
                  disabled={enrollingId === s.user_id}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed">
                  {enrollingId === s.user_id
                    ? t('common.loading', { defaultValue: 'Загрузка...' })
                    : t('universityAnalytics.compliance.enroll', { defaultValue: 'Отслеживать' })}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompliancePanel;
