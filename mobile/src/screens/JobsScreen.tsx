import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Modal, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { jobService, type Vacancy } from '../services/jobService';
import { type StudentStackParamList } from '../navigation/MainNavigator';
import Icon from '../components/Icon';

type Nav = NativeStackNavigationProp<StudentStackParamList, 'JobsMain'>;

const JOB_TYPES   = ['Full-time', 'Part-time', 'Internship', 'Contract', 'Remote'];
const CITIES      = ['Алматы', 'Астана', 'Шымкент', 'Қарағанды'];
const PAGE_SIZE = 15;

interface Filters { jobTypes: string[]; city: string; salaryMin: string; salaryMax: string; sort: string; }
const emptyFilters: Filters = { jobTypes: [], city: '', salaryMin: '', salaryMax: '', sort: '' };

function filterCount(f: Filters) {
  return f.jobTypes.length + (f.city ? 1 : 0) + (f.salaryMin || f.salaryMax ? 1 : 0) + (f.sort ? 1 : 0);
}

const JOB_TYPE_BG: Record<string, string> = {
  'Full-time': '#EFF6FF', 'Part-time': '#F0FDF4',
  'Internship': '#FFF7ED', 'Remote': '#F5F3FF', 'Contract': '#FDF4FF',
};
const JOB_TYPE_FG: Record<string, string> = {
  'Full-time': '#1D4ED8', 'Part-time': '#15803D',
  'Internship': '#C2410C', 'Remote': '#7C3AED', 'Contract': '#86198F',
};

export default function JobsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const [vacancies,   setVacancies]   = useState<Vacancy[]>([]);
  const [search,      setSearch]      = useState('');
  const [query,       setQuery]       = useState('');
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(true);
  const [filters,     setFilters]     = useState<Filters>(emptyFilters);
  const [draft,       setDraft]       = useState<Filters>(emptyFilters);
  const [showFilter,  setShowFilter]  = useState(false);

  const SORT_OPTIONS = [
    { label: t('jobs.sort.relevance'), value: '' },
    { label: t('jobs.sort.date'),      value: 'date' },
    { label: t('jobs.sort.salaryAsc'), value: 'salary_asc' },
    { label: t('jobs.sort.salaryDesc'),value: 'salary_desc' },
  ];

  const load = useCallback(async (q: string, f: Filters, pg: number, append = false) => {
    if (pg === 1 && !append) setLoading(true);
    else setLoadingMore(true);
    try {
      const data = await jobService.getAll({
        search:    q || undefined,
        page:      pg,
        page_size: PAGE_SIZE,
        job_type:  f.jobTypes.length ? f.jobTypes.join(',') : undefined,
        location:  f.city || undefined,
        salary_min: f.salaryMin ? Number(f.salaryMin) : undefined,
        salary_max: f.salaryMax ? Number(f.salaryMax) : undefined,
        sort:      f.sort || undefined,
      });
      setVacancies(prev => {
        if (!append) return data.vacancies;
        const seen = new Set(prev.map(v => v.id));
        return [...prev, ...data.vacancies.filter(v => !seen.has(v.id))];
      });
      setHasMore(data.vacancies.length === PAGE_SIZE);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(query, filters, 1); }, [load, query, filters]);

  const handleSearch  = () => { setQuery(search); setPage(1); setVacancies([]); };
  const onRefresh     = () => { setRefreshing(true); setPage(1); load(query, filters, 1); };
  const handleLoadMore = () => {
    if (!hasMore || loadingMore || loading) return;
    const next = page + 1; setPage(next); load(query, filters, next, true);
  };
  const applyFilters  = () => { setFilters(draft); setPage(1); setVacancies([]); setShowFilter(false); };
  const resetFilters  = () => { setDraft(emptyFilters); setFilters(emptyFilters); setPage(1); setVacancies([]); setShowFilter(false); };
  const toggleJobType = (jt: string) => setDraft(d => ({
    ...d, jobTypes: d.jobTypes.includes(jt) ? d.jobTypes.filter(x => x !== jt) : [...d.jobTypes, jt],
  }));

  const fc = filterCount(filters);

  const renderItem = ({ item }: { item: Vacancy }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('JobDetail', { vacancy: item })} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <View style={[styles.typeBadge, { backgroundColor: JOB_TYPE_BG[item.job_type] ?? '#EEF2FF' }]}>
          <Text style={[styles.typeText, { color: JOB_TYPE_FG[item.job_type] ?? '#4F46E5' }]}>{item.job_type}</Text>
        </View>
      </View>
      {item.company_name ? <Text style={styles.company}>{item.company_name}</Text> : null}
      <View style={styles.meta}>
        {item.location ? (
          <View style={styles.metaItem}>
            <Icon name="pin" size={12} color="#6B7280" />
            <Text style={styles.metaText}>{item.location}</Text>
          </View>
        ) : null}
        {item.salary_min > 0 ? (
          <Text style={styles.metaText}>₸ {item.salary_min.toLocaleString()} – {item.salary_max.toLocaleString()}</Text>
        ) : null}
      </View>
      {item.skills ? (
        <View style={styles.skills}>
          {String(item.skills ?? '').split(',').filter(Boolean).slice(0, 4).map(s => (
            <View key={s} style={styles.skill}><Text style={styles.skillText}>{s.trim()}</Text></View>
          ))}
        </View>
      ) : null}
      {item.match_score != null ? (
        <View style={styles.matchRow}>
          <View style={[styles.matchBar, { width: `${Math.min(item.match_score, 100)}%` as any,
            backgroundColor: item.match_score >= 70 ? '#10B981' : item.match_score >= 40 ? '#F59E0B' : '#EF4444' }]} />
          <Text style={[styles.matchText, {
            color: item.match_score >= 70 ? '#047857' : item.match_score >= 40 ? '#92400E' : '#991B1B',
          }]}>{t('apps.match', { score: item.match_score })}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('jobs.searchPlaceholder')}
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>🔍</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, fc > 0 && styles.filterBtnActive]}
          onPress={() => { setDraft(filters); setShowFilter(true); }}
        >
          <Icon name="sliders" size={18} color={fc > 0 ? '#fff' : '#374151'} />
          {fc > 0 && <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{fc}</Text></View>}
        </TouchableOpacity>
      </View>

      {fc > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
          {filters.jobTypes.map(jt => (
            <TouchableOpacity key={jt} style={styles.chip} onPress={() => {
              const nf = { ...filters, jobTypes: filters.jobTypes.filter(x => x !== jt) };
              setFilters(nf); setPage(1); setVacancies([]);
            }}>
              <Text style={styles.chipText}>{jt} ×</Text>
            </TouchableOpacity>
          ))}
          {filters.city ? (
            <TouchableOpacity style={styles.chip} onPress={() => { setFilters(f => ({ ...f, city: '' })); setPage(1); setVacancies([]); }}>
              <View style={styles.chipContent}>
                <Icon name="pin" size={11} color="#4F46E5" />
                <Text style={styles.chipText}>{filters.city} ×</Text>
              </View>
            </TouchableOpacity>
          ) : null}
          {(filters.salaryMin || filters.salaryMax) ? (
            <TouchableOpacity style={styles.chip} onPress={() => { setFilters(f => ({ ...f, salaryMin: '', salaryMax: '' })); setPage(1); setVacancies([]); }}>
              <Text style={styles.chipText}>₸ {filters.salaryMin || '0'} – {filters.salaryMax || '∞'} ×</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />
      ) : (
        <FlatList
          data={vacancies}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#2563EB" style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Icon name="search" size={40} color="#D1D5DB" /></View>
              <Text style={styles.emptyText}>{t('jobs.empty')}</Text>
              {fc > 0 && (
                <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
                  <Text style={styles.resetBtnText}>{t('jobs.resetFilters')}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      <Modal visible={showFilter} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.filterModal}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>{t('jobs.filter.title')}</Text>
            <TouchableOpacity onPress={() => setShowFilter(false)}>
              <Text style={styles.filterClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.filterBody} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.filterSectionTitle}>{t('jobs.filter.jobType')}</Text>
            {JOB_TYPES.map(jt => (
              <TouchableOpacity key={jt} style={styles.filterRow} onPress={() => toggleJobType(jt)}>
                <View style={[styles.checkbox, draft.jobTypes.includes(jt) && styles.checkboxChecked]}>
                  {draft.jobTypes.includes(jt) && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.filterRowText}>{jt}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.filterSectionTitle}>{t('jobs.filter.city')}</Text>
            {[{ label: t('jobs.filter.anyCity'), value: '' }, ...CITIES.map(c => ({ label: c, value: c }))].map(opt => (
              <TouchableOpacity key={opt.value} style={styles.filterRow} onPress={() => setDraft(d => ({ ...d, city: opt.value }))}>
                <View style={[styles.radio, draft.city === opt.value && styles.radioChecked]} />
                <Text style={styles.filterRowText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.filterSectionTitle}>{t('jobs.filter.salary')}</Text>
            <View style={styles.salaryRow}>
              <TextInput style={styles.salaryInput} placeholder={t('jobs.filter.from')} placeholderTextColor="#9CA3AF" keyboardType="numeric"
                value={draft.salaryMin} onChangeText={v => setDraft(d => ({ ...d, salaryMin: v }))} />
              <Text style={styles.salarySep}>–</Text>
              <TextInput style={styles.salaryInput} placeholder={t('jobs.filter.to')} placeholderTextColor="#9CA3AF" keyboardType="numeric"
                value={draft.salaryMax} onChangeText={v => setDraft(d => ({ ...d, salaryMax: v }))} />
            </View>

            <Text style={styles.filterSectionTitle}>{t('jobs.filter.sort')}</Text>
            {SORT_OPTIONS.map(opt => (
              <TouchableOpacity key={opt.value} style={styles.filterRow} onPress={() => setDraft(d => ({ ...d, sort: opt.value }))}>
                <View style={[styles.radio, draft.sort === opt.value && styles.radioChecked]} />
                <Text style={styles.filterRowText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.filterFooter}>
            <TouchableOpacity style={styles.resetFilterBtn} onPress={resetFilters}>
              <Text style={styles.resetFilterText}>{t('jobs.filter.reset')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyFilterBtn} onPress={applyFilters}>
              <Text style={styles.applyFilterText}>{t('jobs.filter.apply')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F8FAFC' },
  searchRow:       { flexDirection: 'row', padding: 12, gap: 8 },
  searchInput:     { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111827' },
  searchBtn:       { backgroundColor: '#2563EB', borderRadius: 12, width: 44, alignItems: 'center', justifyContent: 'center' },
  searchBtnText:   { fontSize: 18 },
  filterBtn:       { width: 44, height: 44, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  filterBadge:     { position: 'absolute', top: -4, right: -4, backgroundColor: '#2563EB', borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  filterBadgeText: { fontSize: 9, color: '#fff', fontWeight: '800' },
  chipsScroll:     { maxHeight: 44 },
  chips:           { paddingHorizontal: 12, paddingBottom: 8, gap: 8, flexDirection: 'row' },
  chip:            { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  chipContent:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipText:        { fontSize: 12, color: '#2563EB', fontWeight: '600' },
  metaItem:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  list:            { paddingHorizontal: 12, paddingBottom: 24 },
  loader:          { marginTop: 60 },
  card:            { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  title:           { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827' },
  typeBadge:       { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  typeText:        { fontSize: 11, fontWeight: '600' },
  company:         { fontSize: 13, color: '#6B7280', marginBottom: 6 },
  meta:            { flexDirection: 'row', gap: 12, marginBottom: 8 },
  metaText:        { fontSize: 12, color: '#6B7280' },
  skills:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skill:           { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  skillText:       { fontSize: 11, color: '#1D4ED8', fontWeight: '500' },
  matchRow:        { marginTop: 10, gap: 4 },
  matchBar:        { height: 4, borderRadius: 2, backgroundColor: '#10B981' },
  matchText:       { fontSize: 11, fontWeight: '700' },
  empty:           { alignItems: 'center', paddingTop: 80 },
  emptyIcon:       { marginBottom: 12 },
  emptyText:       { fontSize: 16, color: '#9CA3AF', marginBottom: 16 },
  resetBtn:        { backgroundColor: '#EFF6FF', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  resetBtnText:    { color: '#2563EB', fontWeight: '700', fontSize: 14 },
  filterModal:     { flex: 1, backgroundColor: '#fff' },
  filterHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  filterTitle:     { fontSize: 20, fontWeight: '700', color: '#111827' },
  filterClose:     { fontSize: 22, color: '#9CA3AF', padding: 4 },
  filterBody:      { flex: 1, padding: 16 },
  filterSectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginTop: 20, marginBottom: 10 },
  filterRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  filterRowText:   { fontSize: 15, color: '#374151' },
  checkbox:        { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { borderColor: '#2563EB', backgroundColor: '#2563EB' },
  checkmark:       { color: '#fff', fontSize: 13, fontWeight: '700' },
  radio:           { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB' },
  radioChecked:    { borderColor: '#2563EB', backgroundColor: '#2563EB' },
  salaryRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  salaryInput:     { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB' },
  salarySep:       { fontSize: 18, color: '#9CA3AF' },
  filterFooter:    { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  resetFilterBtn:  { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  resetFilterText: { fontSize: 15, fontWeight: '700', color: '#6B7280' },
  applyFilterBtn:  { flex: 2, backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  applyFilterText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
