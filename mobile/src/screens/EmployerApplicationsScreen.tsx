import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { applicationService, type Application } from '../services/applicationService';
import { formatDate } from '../utils/dateUtils';
import type { EmployerStackParamList } from '../navigation/MainNavigator';

type RouteType = RouteProp<EmployerStackParamList, 'VacancyApplications'>;

const STATUS_COLORS: Record<string, string> = {
  applied:     '#3B82F6',
  review:      '#8B5CF6',
  shortlisted: '#F59E0B',
  interview:   '#6366F1',
  offered:     '#10B981',
  rejected:    '#EF4444',
};

const NEXT_STATUS_VALUES: Record<string, string[]> = {
  applied:     ['review', 'shortlisted', 'rejected'],
  review:      ['shortlisted', 'interview', 'rejected'],
  shortlisted: ['interview', 'rejected'],
  interview:   ['offered', 'rejected'],
  offered:     [],
  rejected:    [],
};

const STATUS_TO_ACTION_KEY: Record<string, string> = {
  review: 'toReview', shortlisted: 'shortlist',
  interview: 'interview', offered: 'offer', rejected: 'reject',
};

type NavProp = NativeStackNavigationProp<EmployerStackParamList>;

export default function EmployerApplicationsScreen() {
  const { t } = useTranslation();
  const route      = useRoute<RouteType>();
  const navigation = useNavigation<NavProp>();
  const { vacancyId, vacancyTitle } = route.params;

  const [apps,       setApps]       = useState<Application[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating,   setUpdating]   = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await applicationService.getVacancyApplications(vacancyId);
      setApps(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vacancyId]);

  useEffect(() => { load(); }, [load]);

  const handleUpdateStatus = (appId: string, newStatus: string, label: string) => {
    Alert.alert(t('employer.apps.statusConfirm'), `${t('employer.apps.changeStatusTitle')} "${label}"?`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.yes'), onPress: async () => {
        setUpdating(appId);
        try {
          await applicationService.updateStatus(appId, newStatus);
          setApps(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus as Application['status'] } : a));
        } catch {
          Alert.alert(t('common.error'), t('employer.apps.statusUpdateError'));
        } finally {
          setUpdating(null);
        }
      }},
    ]);
  };

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#7C3AED" />;

  return (
    <FlatList
      data={apps}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#7C3AED" />}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <Text style={styles.vacancyTitle}>{vacancyTitle}</Text>
          <Text style={styles.count}>{t('employer.apps.count', { count: apps.length })}</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>{t('employer.apps.empty')}</Text>
        </View>
      }
      renderItem={({ item }) => {
        const color = STATUS_COLORS[item.status] ?? '#6B7280';
        const label = t(`status.${item.status}`, { defaultValue: item.status });
        const studentName = item.student
          ? `${item.student.first_name} ${item.student.last_name}`
          : `${t('employer.candidate.student')} #${item.student_id.slice(0, 8)}`;
        const nextStatusValues = NEXT_STATUS_VALUES[item.status] ?? [];
        const isUpdating = updating === item.id;

        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{studentName[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{studentName}</Text>
                {item.student?.skills ? (
                  <Text style={styles.skills} numberOfLines={1}>{item.student.skills}</Text>
                ) : null}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: color + '20' }]}>
                <Text style={[styles.statusText, { color }]}>{label}</Text>
              </View>
            </View>

            {item.match_score > 0 && (
              <View style={styles.matchRow}>
                <Text style={styles.matchLabel}>{t('employer.apps.match')}:</Text>
                <Text style={[styles.matchScore, { color: item.match_score >= 70 ? '#10B981' : item.match_score >= 40 ? '#F59E0B' : '#EF4444' }]}>
                  {item.match_score}%
                </Text>
              </View>
            )}

            {item.cover_letter ? (
              <Text style={styles.coverLetter} numberOfLines={2}>{item.cover_letter}</Text>
            ) : null}

            <Text style={styles.date}>{formatDate(item.created_at)}</Text>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.profileBtn}
                onPress={() => navigation.navigate('CandidateDetail', {
                  studentId: item.student_id,
                  applicationId: item.id,
                })}
              >
                <Text style={styles.profileBtnText}>{t('employer.apps.profile')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chatBtn}
                onPress={() => navigation.navigate('EmployerChat', {
                  applicationId: item.id,
                  title: item.student ? `${item.student.first_name} ${item.student.last_name}` : t('employer.apps.chat'),
                })}
              >
                <Text style={styles.chatBtnText}>{t('employer.apps.chat')}</Text>
              </TouchableOpacity>
            </View>

            {nextStatusValues.length > 0 && (
              <View style={styles.actionsRow}>
                {isUpdating
                  ? <ActivityIndicator color="#7C3AED" />
                  : nextStatusValues.map(value => {
                    const actionKey = STATUS_TO_ACTION_KEY[value] ?? value;
                    const actionLabel = t(`employer.actions.${actionKey}`, { defaultValue: value });
                    return (
                      <TouchableOpacity
                        key={value}
                        style={[styles.actionBtn, value === 'rejected' && styles.rejectBtn]}
                        onPress={() => handleUpdateStatus(item.id, value, actionLabel)}
                      >
                        <Text style={[styles.actionText, value === 'rejected' && styles.rejectText]}>
                          {actionLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                }
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  loader:      { marginTop: 60 },
  list:        { padding: 16, paddingBottom: 40 },
  listHeader:  { marginBottom: 16 },
  vacancyTitle:{ fontSize: 18, fontWeight: '700', color: '#111827' },
  count:       { fontSize: 13, color: '#6B7280', marginTop: 4 },
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:  { fontSize: 16, fontWeight: '700', color: '#2563EB' },
  name:        { fontSize: 15, fontWeight: '700', color: '#111827' },
  skills:      { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, flexShrink: 0 },
  statusText:  { fontSize: 11, fontWeight: '700' },
  matchRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  matchLabel:  { fontSize: 12, color: '#6B7280' },
  matchScore:  { fontSize: 13, fontWeight: '700' },
  coverLetter: { fontSize: 12, color: '#6B7280', marginBottom: 6, lineHeight: 18 },
  date:        { fontSize: 11, color: '#9CA3AF', marginBottom: 10 },
  actionsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  profileBtn:     { backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  profileBtnText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  chatBtn:        { backgroundColor: '#EFF6FF', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  chatBtnText:    { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  actionBtn:      { backgroundColor: '#EFF6FF', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  rejectBtn:      { backgroundColor: '#FEF2F2' },
  actionText:     { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  rejectText:     { color: '#EF4444' },
  empty:       { alignItems: 'center', paddingTop: 80 },
  emptyIcon:   { fontSize: 48, marginBottom: 12 },
  emptyText:   { fontSize: 16, color: '#9CA3AF' },
});
