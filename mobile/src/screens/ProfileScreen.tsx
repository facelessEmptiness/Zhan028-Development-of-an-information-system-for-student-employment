import React from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Alert, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSelector from '../components/LanguageSelector';

const ROLE_COLORS: Record<string, string> = {
  student:    '#2563EB',
  employer:   '#7C3AED',
  university: '#059669',
  admin:      '#DC2626',
};

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(t('account.logoutConfirm'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('account.logoutBtn'), style: 'destructive', onPress: logout },
    ]);
  };

  if (!user) return null;

  const roleColor = ROLE_COLORS[user.role] ?? '#6B7280';
  const roleLabel = t(`role.${user.role}`, { defaultValue: user.role });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <View style={styles.avatarSection}>
        <View style={[styles.avatar, { backgroundColor: roleColor + '20' }]}>
          <Text style={[styles.avatarText, { color: roleColor }]}>
            {user.email[0].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.email}>{user.email}</Text>
        <View style={[styles.roleBadge, { backgroundColor: roleColor + '15' }]}>
          <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('account.title')}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('account.email')}</Text>
          <Text style={styles.infoValue}>{user.email}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('account.role')}</Text>
          <Text style={styles.infoValue}>{roleLabel}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('account.emailVerified')}</Text>
          <Text style={[styles.infoValue, { color: user.is_email_verified ? '#10B981' : '#EF4444' }]}>
            {user.is_email_verified ? t('account.yes') : t('account.no')}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('account.language')}</Text>
        <LanguageSelector />
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>{t('account.logoutBtn')}</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#F8FAFC' },
  content:       { padding: 20 },
  avatarSection: { alignItems: 'center', paddingVertical: 28 },
  avatar:        { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText:    { fontSize: 32, fontWeight: '800' },
  email:         { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
  roleBadge:     { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4 },
  roleText:      { fontSize: 13, fontWeight: '700' },
  section:       { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 },
  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel:     { fontSize: 14, color: '#6B7280' },
  infoValue:     { fontSize: 14, fontWeight: '600', color: '#111827', maxWidth: '60%', textAlign: 'right' },
  logoutBtn:     { backgroundColor: '#FEF2F2', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  logoutText:    { color: '#DC2626', fontSize: 16, fontWeight: '700' },
});
