import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../services/api';
import Icon from '../components/Icon';
import LanguageSelector from '../components/LanguageSelector';
import type { IconName } from '../components/icons';

type Role = 'student' | 'employer' | 'university';
interface University { id: string; name: string; city: string; }

export default function RegisterScreen({ onGoLogin, onVerify }: { onGoLogin: () => void; onVerify?: (email: string) => void }) {
  const { t } = useTranslation();
  const { register } = useAuth();
  const insets = useSafeAreaInsets();

  const [role,        setRole]        = useState<Role>('student');
  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]    = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [univId,      setUnivId]      = useState('');
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [success,     setSuccess]     = useState(false);
  const [regEmail,    setRegEmail]    = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/universities`)
      .then(r => r.ok ? r.json() : { universities: [] })
      .then((data: any) => setUniversities(Array.isArray(data) ? data : (data.universities ?? [])))
      .catch(() => {});
  }, []);

  const passStrength = useCallback((): { level: number; label: string; color: string } => {
    if (!password) return { level: 0, label: '', color: '#E5E7EB' };
    let s = 0;
    if (password.length >= 8)          s++;
    if (password.length >= 10)         s++;
    if (/[A-Z]/.test(password))        s++;
    if (/[0-9]/.test(password))        s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    if (s <= 2) return { level: 1, label: t('register.strength.weak'),   color: '#EF4444' };
    if (s <= 3) return { level: 2, label: t('register.strength.medium'), color: '#F59E0B' };
    return      { level: 3, label: t('register.strength.strong'), color: '#10B981' };
  }, [password, t]);

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert(t('common.error'), t('register.error.name')); return;
    }
    if (!email.trim()) {
      Alert.alert(t('common.error'), t('register.error.email')); return;
    }
    if (password.length < 8) {
      Alert.alert(t('common.error'), t('register.error.passwordLength')); return;
    }
    if (password !== confirm) {
      Alert.alert(t('common.error'), t('register.error.passwordMismatch')); return;
    }
    if ((role === 'student' || role === 'university') && !univId) {
      Alert.alert(t('common.error'), t('register.error.university')); return;
    }
    setLoading(true);
    try {
      await register({
        email: email.trim(),
        password,
        role,
        university_id: univId || undefined,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      setRegEmail(email.trim());
      if (onVerify) {
        onVerify(email.trim());
      } else {
        setSuccess(true);
      }
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('register.error.failed'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIcon}><Icon name="mail" size={56} color="#2563EB" /></View>
        <Text style={styles.successTitle}>{t('register.success.title')}</Text>
        <Text style={styles.successText}>
          {t('register.success.text')}{'\n'}
          <Text style={styles.successEmail}>{regEmail}</Text>
        </Text>
        <Text style={styles.successNote}>{t('register.success.note')}</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={onGoLogin}>
          <Text style={styles.loginBtnText}>{t('register.success.loginBtn')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const str = passStrength();
  const ROLES: { value: Role; icon: IconName }[] = [
    { value: 'student',    icon: 'graduation-cap' },
    { value: 'employer',   icon: 'building' },
    { value: 'university', icon: 'building-2' },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.bg} contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]} keyboardShouldPersistTaps="handled">

        <View style={styles.langRow}>
          <LanguageSelector />
        </View>

        <View style={styles.logoBox}>
          <View style={styles.logoIcon}><Icon name="graduation-cap" size={44} color="#1E3A8A" /></View>
          <Text style={styles.logoTitle}>{t('register.title')}</Text>
          <Text style={styles.logoSub}>{t('register.appSub')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('register.roleLabel')}</Text>
          <View style={styles.roleRow}>
            {ROLES.map(r => (
              <TouchableOpacity
                key={r.value}
                style={[styles.roleChip, role === r.value && styles.roleChipActive]}
                onPress={() => setRole(r.value)}
              >
                <View style={styles.roleIcon}><Icon name={r.icon} size={20} color={role === r.value ? '#2563EB' : '#6B7280'} /></View>
                <Text style={[styles.roleLabel, role === r.value && styles.roleLabelActive]}>
                  {t(`register.roles.${r.value}.label`)}
                </Text>
                <Text style={styles.roleDesc}>{t(`register.roles.${r.value}.desc`)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t('register.firstName')}</Text>
              <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder={t('register.firstNamePlaceholder')} placeholderTextColor="#9CA3AF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t('register.lastName')}</Text>
              <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder={t('register.lastNamePlaceholder')} placeholderTextColor="#9CA3AF" />
            </View>
          </View>

          {(role === 'student' || role === 'university') && (
            <View style={styles.field}>
              <Text style={styles.label}>{t('register.university')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                {universities.map(u => (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.univChip, univId === u.id && styles.univChipActive]}
                    onPress={() => setUnivId(u.id)}
                  >
                    <Text style={[styles.univChipText, univId === u.id && styles.univChipTextActive]} numberOfLines={1}>
                      {u.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {univId ? (
                <View style={styles.selectedUnivRow}>
                  <Icon name="check" size={12} color="#059669" />
                  <Text style={styles.selectedUniv}>{universities.find(u => u.id === univId)?.name ?? ''}</Text>
                </View>
              ) : null}
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>{t('register.email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t('register.emailPlaceholder')}
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('register.password')}</Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={t('register.passwordPlaceholder')}
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPass}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                <Icon name={showPass ? 'eye-off' : 'eye'} size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                <View style={styles.strengthTrack}>
                  <View style={[styles.strengthFill, { width: `${(str.level / 3) * 100}%` as any, backgroundColor: str.color }]} />
                </View>
                <Text style={[styles.strengthLabel, { color: str.color }]}>{str.label}</Text>
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('register.confirmPassword')}</Text>
            <TextInput
              style={[styles.input, confirm.length > 0 && confirm !== password && styles.inputError]}
              value={confirm}
              onChangeText={setConfirm}
              placeholder={t('register.confirmPasswordPlaceholder')}
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPass}
            />
            {confirm.length > 0 && confirm !== password && (
              <Text style={styles.errorText}>{t('register.passwordMismatch')}</Text>
            )}
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading} activeOpacity={0.8}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{t('register.submitBtn')}</Text>
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={onGoLogin} style={styles.loginLink}>
          <Text style={styles.loginLinkText}>{t('register.hasAccount')} <Text style={styles.loginLinkBold}>{t('register.loginLink')}</Text></Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bg:               { flex: 1, backgroundColor: '#F8FAFC' },
  langRow:          { alignItems: 'flex-end', marginBottom: 8 },
  container:        { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40 },
  logoBox:          { alignItems: 'center', marginBottom: 24, marginTop: 20 },
  logoIcon:         { marginBottom: 6 },
  logoTitle:        { fontSize: 22, fontWeight: '700', color: '#1E3A8A' },
  logoSub:          { fontSize: 13, color: '#6B7280', marginTop: 2 },
  card:             { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  sectionLabel:     { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 10 },
  roleRow:          { flexDirection: 'row', gap: 8, marginBottom: 18 },
  roleChip:         { flex: 1, alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  roleChipActive:   { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  roleIcon:         { marginBottom: 4 },
  roleLabel:        { fontSize: 11, fontWeight: '700', color: '#6B7280', textAlign: 'center' },
  roleLabelActive:  { color: '#2563EB' },
  roleDesc:         { fontSize: 10, color: '#9CA3AF', marginTop: 2, textAlign: 'center' },
  row:              { flexDirection: 'row', gap: 10, marginBottom: 12 },
  field:            { marginBottom: 12 },
  label:            { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 5 },
  input:            { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB' },
  inputError:       { borderColor: '#EF4444' },
  eyeBtn:           { position: 'absolute', right: 12, top: 10 },
  strengthRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  strengthTrack:    { flex: 1, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, overflow: 'hidden' },
  strengthFill:     { height: 4, borderRadius: 2 },
  strengthLabel:    { fontSize: 11, fontWeight: '700', width: 64 },
  errorText:        { fontSize: 11, color: '#EF4444', marginTop: 4 },
  univChip:         { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', marginRight: 8 },
  univChipActive:   { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  univChipText:     { fontSize: 12, color: '#374151', maxWidth: 140 },
  univChipTextActive:{ color: '#fff' },
  selectedUnivRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  selectedUniv:     { fontSize: 11, color: '#059669' },
  btn:              { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  btnText:          { color: '#fff', fontSize: 16, fontWeight: '700' },
  loginLink:        { alignItems: 'center', marginTop: 20 },
  loginLinkText:    { fontSize: 13, color: '#9CA3AF' },
  loginLinkBold:    { fontWeight: '700', color: '#2563EB' },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#F8FAFC' },
  successIcon:      { marginBottom: 16 },
  successTitle:     { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 10 },
  successText:      { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  successEmail:     { fontWeight: '700', color: '#2563EB' },
  successNote:      { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 32 },
  loginBtn:         { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 48, alignItems: 'center' },
  loginBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
});
