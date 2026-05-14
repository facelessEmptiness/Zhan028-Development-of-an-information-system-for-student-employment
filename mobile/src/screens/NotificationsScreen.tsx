import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { notificationService, type Notification } from '../services/notificationService';
import { formatDate } from '../utils/dateUtils';

function relativeTime(dateStr: string, t: (k: string, opts?: any) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return t('notifications.time.justNow');
  if (mins < 60)  return t('notifications.time.minutesAgo', { count: mins });
  if (hours < 24) return t('notifications.time.hoursAgo', { count: hours });
  if (days === 1) return t('notifications.time.yesterday');
  if (days < 7)   return t('notifications.time.daysAgo', { count: days });
  return formatDate(dateStr, 'ru-RU', { day: 'numeric', month: 'short' });
}

const TYPE_CFG: Record<string, { icon: string; color: string }> = {
  application_submitted: { icon: '✅', color: '#10B981' },
  application_status:    { icon: '📋', color: '#3B82F6' },
  interview_scheduled:   { icon: '📅', color: '#8B5CF6' },
  document_verified:     { icon: '✔️', color: '#10B981' },
  document_rejected:     { icon: '❌', color: '#EF4444' },
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await notificationService.getAll();
      setNotifications(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkAllRead = async () => {
    await notificationService.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleMarkRead = async (id: string) => {
    await notificationService.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const cfg   = TYPE_CFG[item.type] ?? { icon: '🔔', color: '#6B7280' };
    const unread = !item.is_read;
    const date  = relativeTime(item.created_at, t);

    return (
      <TouchableOpacity
        style={[styles.card, unread && styles.cardUnread]}
        onPress={() => unread && handleMarkRead(item.id)}
        activeOpacity={unread ? 0.7 : 1}
      >
        <View style={[styles.iconBox, { backgroundColor: cfg.color + '20' }]}>
          <Text style={styles.icon}>{cfg.icon}</Text>
        </View>
        <View style={styles.cardBody}>
          {item.title ? (
            <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
          ) : null}
          {item.body ? (
            <Text style={styles.body} numberOfLines={3}>
              {item.body}
            </Text>
          ) : null}
          <Text style={styles.date}>{date}</Text>
        </View>
        {unread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />;
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <FlatList
      data={notifications}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#2563EB" />}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <Text style={styles.headerTitle}>
            {t('notifications.header')}{unreadCount > 0 ? ` · ${unreadCount}` : ''}
          </Text>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead}>
              <Text style={styles.markAll}>{t('notifications.markAllRead')}</Text>
            </TouchableOpacity>
          )}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  loader:        { marginTop: 60 },
  list:          { padding: 16 },
  listHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle:   { fontSize: 20, fontWeight: '700', color: '#111827' },
  markAll:       { fontSize: 13, color: '#2563EB', fontWeight: '600' },
  card:          { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, alignItems: 'flex-start', gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardUnread:    { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  iconBox:       { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  icon:          { fontSize: 18 },
  cardBody:      { flex: 1 },
  title:         { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  titleUnread:   { color: '#1D4ED8' },
  body:          { fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 4 },
  date:          { fontSize: 11, color: '#9CA3AF' },
  unreadDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB', marginTop: 4, flexShrink: 0 },
  empty:         { alignItems: 'center', paddingTop: 80 },
  emptyIcon:     { fontSize: 48, marginBottom: 12 },
  emptyText:     { fontSize: 16, color: '#9CA3AF' },
});
