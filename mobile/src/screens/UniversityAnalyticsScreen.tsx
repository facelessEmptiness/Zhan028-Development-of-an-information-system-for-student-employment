import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { universityService, type AnalyticsSummary } from '../services/universityService';
import { employmentService, type EmploymentRecord } from '../services/employmentService';
import { formatDate } from '../utils/dateUtils';
import Icon from '../components/Icon';
import type { IconName } from '../components/icons';

type Tab = 'overview' | 'programs' | 'employment' | 'stats' | 'employers';


const APP_STATUS_COLORS: Record<string, string> = {
  applied:     '#3B82F6',
  review:      '#8B5CF6',
  shortlisted: '#F59E0B',
  interview:   '#6366F1',
  offered:     '#10B981',
  rejected:    '#EF4444',
};

const FUNNEL_COLORS = ['#3B82F6', '#8B5CF6', '#6366F1', '#10B981'];

const EMP_STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  active:           { color: '#059669', bg: '#D1FAE5' },
  completed:        { color: '#2563EB', bg: '#DBEAFE' },
  terminated_early: { color: '#EF4444', bg: '#FEE2E2' },
};

export default function UniversityAnalyticsScreen() {
  const { t } = useTranslation();
  const [tab,             setTab]             = useState<Tab>('overview');
  const [data,            setData]            = useState<AnalyticsSummary | null>(null);
  const [empRecs,    setEmpRecs]    = useState<EmploymentRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);

  const load = useCallback(async () => {
    try {
      const [analytics, records] = await Promise.allSettled([
        universityService.getAnalytics(),
        employmentService.getAllRecords(),
      ]);
      if (analytics.status === 'fulfilled') setData(analytics.value);
      if (records.status === 'fulfilled')   setEmpRecs(records.value);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#059669" />;

  const totalStudents  = data?.students?.total ?? 0;
  const totalVacancies = data?.vacancies?.total ?? 0;
  const totalApps      = data?.applications?.total ?? 0;
  const offeredCount   = data?.applications?.offered_count ?? 0;
  const employmentRate = totalStudents > 0 ? Math.round((offeredCount / totalStudents) * 100) : 0;

  const byStatus  = data?.applications?.by_status ?? [];
  const topSkills = (data?.vacancies?.demanded_skills ?? []).slice(0, 8);
  const bySpec    = [...(data?.students?.by_specialization ?? [])].sort((a, b) => b.count - a.count);
  const byJobType = data?.vacancies?.by_job_type ?? [];

  const activeEmp    = empRecs.filter(r => r.status === 'active').length;
  const completedEmp = empRecs.filter(r => r.status === 'completed').length;

  const empStatusLabels: Record<string, string> = {
    active:           t('university.employment.active'),
    completed:        t('university.employment.completed'),
    terminated_early: t('university.employment.terminated'),
  };

  // Derive companies from employment records (same as web version)
  const companyMap = new Map<string, { studentIds: Set<string>; activeCount: number; completedCount: number }>();
  empRecs.forEach(r => {
    if (!companyMap.has(r.company_name)) {
      companyMap.set(r.company_name, { studentIds: new Set(), activeCount: 0, completedCount: 0 });
    }
    const c = companyMap.get(r.company_name)!;
    c.studentIds.add(r.student_id);
    if (r.status === 'active') c.activeCount++;
    if (r.status === 'completed') c.completedCount++;
  });
  const companies = Array.from(companyMap.entries()).map(([name, c]) => ({
    name,
    studentCount: c.studentIds.size,
    activeCount: c.activeCount,
    completedCount: c.completedCount,
  }));

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',   label: t('university.overview') },
    { key: 'programs',   label: t('university.programs') },
    { key: 'employment', label: t('university.employmentTab') },
    { key: 'stats',      label: t('university.stats') },
    { key: 'employers',  label: t('university.employers') },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map(tabItem => (
          <TouchableOpacity
            key={tabItem.key}
            style={[styles.tabBtn, tab === tabItem.key && styles.tabBtnActive]}
            onPress={() => setTab(tabItem.key)}
          >
            <Text style={[styles.tabText, tab === tabItem.key && styles.tabTextActive]}>{tabItem.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#059669" />
        }
      >
        {/* ─── OVERVIEW ─── */}
        {tab === 'overview' && (
          <>
            <View style={styles.kpiGrid}>
              <KpiCard label={t('university.totalStudents')}  value={totalStudents}  color="#2563EB" icon="graduation-cap" />
              <KpiCard label={t('university.totalVacancies')} value={totalVacancies} color="#7C3AED" icon="briefcase" />
              <KpiCard label={t('university.totalApps')}      value={totalApps}      color="#F59E0B" icon="clipboard-list" />
              <KpiCard label={t('university.offeredCount')}   value={offeredCount}   color="#10B981" icon="check-circle" />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('university.employmentRate')}</Text>
              <View style={styles.rateRow}>
                <Text style={styles.rateValue}>{employmentRate}%</Text>
                <View style={styles.rateBar}>
                  <View style={[styles.rateBarFill, { width: `${employmentRate}%` as any }]} />
                </View>
              </View>
              <Text style={styles.rateNote}>{t('university.offerOutOf', { count: offeredCount, total: totalStudents })}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('university.employmentRecords')}</Text>
              <View style={styles.empSummaryRow}>
                <View style={styles.empSummaryCard}>
                  <Text style={styles.empSummaryNum}>{activeEmp}</Text>
                  <Text style={styles.empSummaryLabel}>{t('university.active')}</Text>
                </View>
                <View style={styles.empSummaryCard}>
                  <Text style={[styles.empSummaryNum, { color: '#2563EB' }]}>{completedEmp}</Text>
                  <Text style={styles.empSummaryLabel}>{t('university.completed')}</Text>
                </View>
                <View style={styles.empSummaryCard}>
                  <Text style={styles.empSummaryNum}>{empRecs.length}</Text>
                  <Text style={styles.empSummaryLabel}>{t('university.total')}</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ─── PROGRAMS ─── */}
        {tab === 'programs' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('university.studentsBySpec')}</Text>
              {bySpec.length === 0 ? (
                <Text style={styles.emptySmall}>{t('university.noData')}</Text>
              ) : bySpec.map((s, i) => {
                const maxC = bySpec[0].count;
                const pct  = maxC > 0 ? (s.count / maxC) * 100 : 0;
                const colors = ['#059669', '#2563EB', '#7C3AED', '#F59E0B', '#EF4444', '#6366F1'];
                const color  = colors[i % colors.length];
                return (
                  <View key={s.specialization} style={styles.specRowItem}>
                    <View style={styles.specLabelRow}>
                      <View style={[styles.specDot, { backgroundColor: color }]} />
                      <Text style={styles.specName} numberOfLines={2}>
                        {s.specialization || t('university.noData')}
                      </Text>
                      <Text style={styles.specCount}>{s.count}</Text>
                    </View>
                    <View style={styles.specTrack}>
                      <View style={[styles.specFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('university.distribution')}</Text>
              <View style={styles.legendGrid}>
                {bySpec.slice(0, 6).map((s, i) => {
                  const colors = ['#059669', '#2563EB', '#7C3AED', '#F59E0B', '#EF4444', '#6366F1'];
                  const color  = colors[i % colors.length];
                  const pct    = totalStudents > 0 ? Math.round((s.count / totalStudents) * 100) : 0;
                  return (
                    <View key={s.specialization} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: color }]} />
                      <Text style={styles.legendLabel} numberOfLines={1}>
                        {s.specialization || t('university.noData')}
                      </Text>
                      <Text style={styles.legendPct}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {/* ─── EMPLOYMENT ─── */}
        {tab === 'employment' && (
          <>
            <View style={styles.empStatsRow}>
              {(['active', 'completed', 'terminated_early'] as const).map(st => {
                const cfg   = EMP_STATUS_COLORS[st];
                const count = empRecs.filter(r => r.status === st).length;
                const label = empStatusLabels[st] ?? st;
                return (
                  <View key={st} style={[styles.empStatCard, { borderTopColor: cfg.color }]}>
                    <Text style={[styles.empStatNum, { color: cfg.color }]}>{count}</Text>
                    <Text style={styles.empStatLabel}>{label}</Text>
                  </View>
                );
              })}
            </View>

            {empRecs.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptySmall}>{t('university.employment.noRecords')}</Text>
              </View>
            ) : empRecs.map(r => {
              const cfg   = EMP_STATUS_COLORS[r.status] ?? EMP_STATUS_COLORS.active;
              const label = empStatusLabels[r.status] ?? r.status;
              const date  = formatDate(r.started_at, 'ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
              return (
                <View key={r.id} style={styles.empCard}>
                  <View style={styles.empCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.empJobTitle}>{r.job_title}</Text>
                      <Text style={styles.empCompany}>{r.company_name}</Text>
                      <Text style={styles.empDate}>{t('university.employment.startDate', { date })}</Text>
                    </View>
                    <View style={[styles.empBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.empBadgeText, { color: cfg.color }]}>{label}</Text>
                    </View>
                  </View>
                  <View style={styles.empProgressRow}>
                    <View style={styles.empProgressBg}>
                      <View
                        style={[
                          styles.empProgressFill,
                          { width: `${Math.min(r.progress, 100)}%` as any, backgroundColor: cfg.color },
                        ]}
                      />
                    </View>
                    <Text style={styles.empProgressPct}>{Math.round(r.progress)}%</Text>
                  </View>
                  <View style={styles.empStats}>
                    <View style={styles.empStatItem}>
                      <Icon name="calendar" size={11} color="#6B7280" />
                      <Text style={styles.empStat}>{r.days_worked} {t('university.employment.daysWorked')}</Text>
                    </View>
                    {r.status === 'active' && (
                      <View style={styles.empStatItem}>
                        <Icon name="in-progress" size={11} color="#6B7280" />
                        <Text style={styles.empStat}>{r.remaining_days} {t('university.employment.daysLeft')}</Text>
                      </View>
                    )}
                    {r.grant_fulfilled && (
                      <View style={styles.empStatItem}>
                        <Icon name="check-circle" size={11} color="#059669" />
                        <Text style={[styles.empStat, { color: '#059669' }]}>{t('university.employment.grantFulfilled')}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* ─── STATS ─── */}
        {tab === 'stats' && (
          <>
            {byStatus.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('university.appsByStatus')}</Text>
                {byStatus.map(s => {
                  const color = APP_STATUS_COLORS[s.status] ?? '#6B7280';
                  const label = t(`status.${s.status}`, { defaultValue: s.status });
                  const pct   = totalApps > 0 ? (s.count / totalApps) * 100 : 0;
                  return (
                    <View key={s.status} style={styles.statusRowItem}>
                      <View style={styles.statusLabelRow}>
                        <Text style={styles.statusLabel}>{label}</Text>
                        <Text style={[styles.statusCount, { color }]}>{s.count}</Text>
                      </View>
                      <View style={styles.statusTrack}>
                        <View style={[styles.statusFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {topSkills.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('university.topSkills')}</Text>
                {topSkills.map((s, i) => {
                  const maxC = topSkills[0].count;
                  const pct  = maxC > 0 ? (s.count / maxC) * 100 : 0;
                  return (
                    <View key={s.name} style={styles.skillRow}>
                      <Text style={styles.skillRank}>#{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <View style={styles.skillLabelRow}>
                          <Text style={styles.skillName}>{s.name}</Text>
                          <Text style={styles.skillCount}>{s.count}</Text>
                        </View>
                        <View style={styles.skillTrack}>
                          <View style={[styles.skillFill, { width: `${pct}%` as any }]} />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {byJobType.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('university.vacanciesByType')}</Text>
                <View style={styles.typeGrid}>
                  {byJobType.map(jt => (
                    <View key={jt.name} style={styles.typeCard}>
                      <Text style={styles.typeCount}>{jt.count}</Text>
                      <Text style={styles.typeName}>{jt.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* ─── EMPLOYERS ─── */}
        {tab === 'employers' && (
          <>
            {companies.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptySmall}>{t('university.noEmployers')}</Text>
              </View>
            ) : companies.map(c => (
              <View key={c.name} style={styles.empCard}>
                <View style={styles.empCardTop}>
                  <View style={styles.empAvatar}>
                    <Text style={styles.empAvatarText}>{c.name[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.empJobTitle}>{c.name}</Text>
                    <Text style={styles.empCompany}>{t('university.employerVacancies', { count: c.studentCount })}</Text>
                  </View>
                </View>
                <View style={styles.empStatRow}>
                  {c.activeCount > 0 && (
                    <View style={styles.empStatPill}>
                      <Text style={styles.empStatPillText}>
                        {t('university.active')}: {c.activeCount}
                      </Text>
                    </View>
                  )}
                  {c.completedCount > 0 && (
                    <View style={[styles.empStatPill, { backgroundColor: '#DBEAFE' }]}>
                      <Text style={[styles.empStatPillText, { color: '#2563EB' }]}>
                        {t('university.completed')}: {c.completedCount}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function KpiCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: IconName }) {
  return (
    <View style={[styles.kpiCard, { borderTopColor: color }]}>
      <View style={styles.kpiIcon}><Icon name={icon} size={22} color={color} /></View>
      <Text style={[styles.kpiValue, { color }]}>{value.toLocaleString()}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader:          { marginTop: 60 },
  container:       { flex: 1, backgroundColor: '#F8FAFC' },

  tabBar:          { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', maxHeight: 50, flexGrow: 0 },
  tabBarContent:   { paddingHorizontal: 8 },
  tabBtn:          { paddingHorizontal: 16, paddingVertical: 14 },
  tabBtnActive:    { borderBottomWidth: 2, borderBottomColor: '#059669' },
  tabText:         { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive:   { color: '#059669' },

  scroll:          { flex: 1 },
  content:         { padding: 16, paddingBottom: 40 },

  kpiGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  kpiCard:         { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 14, padding: 14, borderTopWidth: 3, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  kpiIcon:         { marginBottom: 6 },
  kpiValue:        { fontSize: 22, fontWeight: '800' },
  kpiLabel:        { fontSize: 11, color: '#6B7280', marginTop: 2 },

  card:            { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardTitle:       { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 },

  rateRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  rateValue:       { fontSize: 32, fontWeight: '800', color: '#059669', width: 72 },
  rateBar:         { flex: 1, height: 10, backgroundColor: '#D1FAE5', borderRadius: 5, overflow: 'hidden' },
  rateBarFill:     { height: 10, backgroundColor: '#059669', borderRadius: 5 },
  rateNote:        { fontSize: 12, color: '#6B7280' },

  empSummaryRow:   { flexDirection: 'row', gap: 10 },
  empSummaryCard:  { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, alignItems: 'center' },
  empSummaryNum:   { fontSize: 22, fontWeight: '800', color: '#059669' },
  empSummaryLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  specRowItem:     { marginBottom: 12 },
  specLabelRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  specDot:         { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  specName:        { flex: 1, fontSize: 13, color: '#374151' },
  specCount:       { fontSize: 13, fontWeight: '700', color: '#111827', marginLeft: 8 },
  specTrack:       { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginLeft: 16 },
  specFill:        { height: 6, borderRadius: 3 },

  legendGrid:      { gap: 10 },
  legendItem:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot:       { width: 10, height: 10, borderRadius: 5 },
  legendLabel:     { flex: 1, fontSize: 12, color: '#374151' },
  legendPct:       { fontSize: 12, fontWeight: '700', color: '#111827' },

  empStatsRow:     { flexDirection: 'row', gap: 10, marginBottom: 14 },
  empStatCard:     { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderTopWidth: 3, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  empStatNum:      { fontSize: 20, fontWeight: '800', color: '#059669' },
  empStatLabel:    { fontSize: 10, color: '#6B7280', marginTop: 2, textAlign: 'center' },

  empCard:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  empCardTop:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  empJobTitle:     { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  empCompany:      { fontSize: 12, color: '#6B7280' },
  empDate:         { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  empBadge:        { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  empBadgeText:    { fontSize: 11, fontWeight: '700' },
  empProgressRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  empProgressBg:   { flex: 1, height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  empProgressFill: { height: 6, borderRadius: 3 },
  empProgressPct:  { fontSize: 12, fontWeight: '700', color: '#374151', width: 36 },
  empStats:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empStatItem:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  empStat:         { fontSize: 11, color: '#6B7280' },

  emptySmall:      { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 12 },

  statusRowItem:   { marginBottom: 10 },
  statusLabelRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  statusLabel:     { fontSize: 13, color: '#374151' },
  statusCount:     { fontSize: 13, fontWeight: '700' },
  statusTrack:     { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  statusFill:      { height: 6, borderRadius: 3 },

  skillRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  skillRank:       { width: 24, fontSize: 11, color: '#9CA3AF', fontWeight: '700' },
  skillLabelRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  skillName:       { fontSize: 13, color: '#374151', fontWeight: '600' },
  skillCount:      { fontSize: 11, color: '#9CA3AF' },
  skillTrack:      { height: 5, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  skillFill:       { height: 5, backgroundColor: '#059669', borderRadius: 3 },

  typeGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard:        { flex: 1, minWidth: '45%', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, alignItems: 'center' },
  typeCount:       { fontSize: 20, fontWeight: '800', color: '#7C3AED' },
  typeName:        { fontSize: 11, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  empAvatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  empAvatarText:   { fontSize: 18, fontWeight: '800', color: '#059669' },
  empStatRow:      { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  empStatPill:     { backgroundColor: '#ECFDF5', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  empStatPillText: { fontSize: 12, fontWeight: '600', color: '#059669' },
});
