import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import Icon from '../components/Icon';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { employerVacancyService } from '../services/employerVacancyService';
import { applicationService, STATUS_COLORS } from '../services/applicationService';
import { formatDate, langToLocale } from '../utils/dateUtils';
import type { EmployerChatsStackParamList } from '../navigation/MainNavigator';

type Nav = NativeStackNavigationProp<EmployerChatsStackParamList>;

interface ChatItem {
  applicationId: string;
  studentName:   string;
  vacancyTitle:  string;
  status:        string;
  date:          string;
}

export default function EmployerChatsListScreen() {
  const { t, i18n } = useTranslation();
  const navigation  = useNavigation<Nav>();
  const [chats,     setChats]     = useState<ChatItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const load = useCallback(async () => {
    try {
      const vacancies = await employerVacancyService.getMyVacancies();

      const results = await Promise.all(
        vacancies.map(async (vacancy) => {
          try {
            const apps = await applicationService.getVacancyApplications(vacancy.id);
            return apps.map((app): ChatItem => ({
              applicationId: app.id,
              studentName: app.student
                ? `${app.student.first_name} ${app.student.last_name}`.trim()
                : `Студент #${app.student_id.slice(0, 6)}`,
              vacancyTitle: vacancy.title,
              status:       app.status,
              date:         app.created_at,
            }));
          } catch {
            return [];
          }
        }),
      );

      const all = results.flat().sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      setChats(all);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#7C3AED" />;

  return (
    <FlatList
      data={chats}
      keyExtractor={item => item.applicationId}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#7C3AED" />
      }
      ListHeaderComponent={
        chats.length > 0 ? (
          <Text style={styles.header}>{t('chats.chatsWithCandidates', { count: chats.length })}</Text>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><Icon name="chat" size={52} color="#D1D5DB" /></View>
          <Text style={styles.emptyTitle}>{t('chats.empty')}</Text>
          <Text style={styles.emptyText}>{t('chats.employerEmptyText')}</Text>
        </View>
      }
      renderItem={({ item }) => {
        const statusColor = STATUS_COLORS[item.status] ?? '#6B7280';
        const statusLabel = t(`status.${item.status}`, { defaultValue: item.status });
        const date = formatDate(item.date, langToLocale(i18n.language), { day: '2-digit', month: 'short' });

        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('EmployerChat', {
              applicationId: item.applicationId,
              title: item.studentName,
            })}
            activeOpacity={0.75}
          >
            <View style={styles.avatarBox}>
              <Text style={styles.avatarText}>{item.studentName[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text style={styles.name} numberOfLines={1}>{item.studentName}</Text>
                <View style={[styles.badge, { backgroundColor: statusColor + '20' }]}>
                  <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </View>
              <Text style={styles.vacancy} numberOfLines={1}>{item.vacancyTitle}  ·  {date}</Text>
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
  avatarBox:    { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:   { fontSize: 18, fontWeight: '700', color: '#7C3AED' },
  cardBody:     { flex: 1 },
  cardTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  name:         { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  badge:        { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, flexShrink: 0 },
  badgeText:    { fontSize: 10, fontWeight: '700' },
  vacancy:      { fontSize: 12, color: '#6B7280' },
  arrow:        { fontSize: 22, color: '#D1D5DB' },
  empty:        { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon:    { marginBottom: 16 },
  emptyTitle:   { fontSize: 17, fontWeight: '700', color: '#374151', marginBottom: 8, textAlign: 'center' },
  emptyText:    { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
});
