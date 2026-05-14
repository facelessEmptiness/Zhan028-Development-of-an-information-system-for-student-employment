import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { applicationService, type Application } from '../services/applicationService';
import { formatDate } from '../utils/dateUtils';
import type { ChatsStackParamList } from '../navigation/MainNavigator';

const STATUS_COLORS: Record<string, string> = {
  applied: '#3B82F6', review: '#8B5CF6', shortlisted: '#F59E0B',
  interview: '#6366F1', offered: '#10B981', rejected: '#EF4444',
};

type Nav = NativeStackNavigationProp<ChatsStackParamList>;

export default function ChatsListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const [apps,      setApps]      = useState<Application[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const load = useCallback(async () => {
    try {
      const data = await applicationService.getMyApplications();
      setApps(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />;

  return (
    <FlatList
      data={apps}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#2563EB" />
      }
      ListHeaderComponent={
        apps.length > 0 ? (
          <Text style={styles.header}>{t('chats.chatsWithEmployers', { count: apps.length })}</Text>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>{t('chats.empty')}</Text>
          <Text style={styles.emptyText}>{t('chats.emptyText')}</Text>
        </View>
      }
      renderItem={({ item }) => {
        const statusColor = STATUS_COLORS[item.status] ?? '#6B7280';
        const statusLabel = t(`status.${item.status}`, { defaultValue: item.status });
        const date = formatDate(item.created_at, 'ru-RU', { day: '2-digit', month: 'short' });

        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Chat', {
              applicationId: item.id,
              title: item.company_name || item.vacancy_title || t('chats.withEmployer'),
            })}
            activeOpacity={0.75}
          >
            <View style={styles.avatarBox}>
              <Text style={styles.avatarIcon}>💼</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.company_name || item.vacancy_title || t('chats.applicationDate', { date })}
                </Text>
                <View style={[styles.badge, { backgroundColor: statusColor + '20' }]}>
                  <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </View>
              <Text style={styles.snippet} numberOfLines={1}>
                {item.cover_letter || t('chats.openChat')}
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  loader:       { marginTop: 60 },
  list:         { padding: 16, paddingBottom: 24 },
  header:       { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 14 },
  card:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  avatarBox:    { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarIcon:   { fontSize: 20 },
  cardBody:     { flex: 1 },
  cardTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title:        { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  badge:        { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, flexShrink: 0 },
  badgeText:    { fontSize: 10, fontWeight: '700' },
  snippet:      { fontSize: 12, color: '#6B7280' },
  arrow:        { fontSize: 22, color: '#D1D5DB' },
  empty:        { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon:    { fontSize: 52, marginBottom: 16 },
  emptyTitle:   { fontSize: 17, fontWeight: '700', color: '#374151', marginBottom: 8, textAlign: 'center' },
  emptyText:    { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
});
