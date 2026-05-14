import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { applicationService, type Application } from '../services/applicationService';
import { formatDate } from '../utils/dateUtils';
import type { AppsStackParamList } from '../navigation/MainNavigator';

const STATUS_COLORS: Record<string, string> = {
  applied: '#3B82F6', review: '#8B5CF6', shortlisted: '#F59E0B',
  interview: '#6366F1', offered: '#10B981', rejected: '#EF4444',
};

export default function ApplicationsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<AppsStackParamList>>();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await applicationService.getMyApplications();
      setApplications(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const STATUS_LABELS: Record<string, string> = {
    applied: t('status.applied'), review: t('status.review'),
    shortlisted: t('status.shortlisted'), interview: t('status.interview'),
    offered: t('status.offered'), rejected: t('status.rejected'),
  };

  const handleWithdraw = (id: string) => {
    Alert.alert(t('apps.confirm.title'), t('apps.confirm.text'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('apps.confirm.btn'), style: 'destructive',
        onPress: async () => {
          try {
            await applicationService.withdraw(id);
            setApplications(prev => prev.filter(a => a.id !== id));
          } catch (e: any) {
            Alert.alert(t('common.error'), e.message);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Application }) => {
    const statusColor = STATUS_COLORS[item.status] ?? '#6B7280';
    const statusLabel = STATUS_LABELS[item.status] ?? item.status;
    const date = formatDate(item.created_at);

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <Text style={styles.date}>{date}</Text>
        </View>

        {item.cover_letter ? (
          <Text style={styles.coverLetter} numberOfLines={2}>{item.cover_letter}</Text>
        ) : null}

        <View style={styles.cardMeta}>
          <Text style={styles.score}>{t('apps.match', { score: item.match_score })}</Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.chatBtn}
              onPress={() => navigation.navigate('Chat', {
                applicationId: item.id,
                title: item.company_name || item.vacancy_title || t('apps.chatWith'),
              })}
            >
              <Text style={styles.chatBtnText}>{t('apps.chat')}</Text>
            </TouchableOpacity>
            {item.status === 'applied' && (
              <TouchableOpacity onPress={() => handleWithdraw(item.id)}>
                <Text style={styles.withdrawBtn}>{t('apps.withdraw')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />;
  }

  return (
    <FlatList
      data={applications}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#2563EB" />}
      ListHeaderComponent={
        <View>
          <Text style={styles.header}>{t('apps.header', { count: applications.length })}</Text>
          <TouchableOpacity
            style={styles.interviewBanner}
            onPress={() => navigation.navigate('InterviewsList')}
            activeOpacity={0.8}
          >
            <Text style={styles.interviewBannerText}>{t('apps.interviewsBanner')}</Text>
            <Text style={styles.interviewBannerArrow}>→</Text>
          </TouchableOpacity>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>{t('apps.empty.title')}</Text>
          <Text style={styles.emptyText}>{t('apps.empty.text')}</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  loader:       { marginTop: 60 },
  list:         { padding: 16 },
  header:       { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 16 },
  card:         { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTop:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statusDot:    { width: 8, height: 8, borderRadius: 4 },
  statusBadge:  { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  statusText:   { fontSize: 12, fontWeight: '700' },
  date:         { fontSize: 12, color: '#9CA3AF', marginLeft: 'auto' },
  coverLetter:  { fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 10 },
  cardMeta:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  score:        { fontSize: 12, color: '#6B7280' },
  withdrawBtn:  { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  cardActions:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chatBtn:             { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  chatBtnText:         { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  interviewBanner:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#EDE9FE', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
  interviewBannerText: { fontSize: 14, fontWeight: '700', color: '#7C3AED' },
  interviewBannerArrow:{ fontSize: 16, color: '#7C3AED', fontWeight: '700' },
  empty:        { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptyText:    { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
});
