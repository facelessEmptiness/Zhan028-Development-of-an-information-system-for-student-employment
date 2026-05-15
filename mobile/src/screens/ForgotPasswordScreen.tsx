import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/authService';
import Icon from '../components/Icon';

export default function ForgotPasswordScreen({ onGoLogin }: { onGoLogin: () => void }) {
  const { t } = useTranslation();
  const [step,     setStep]     = useState<'email' | 'reset'>('email');
  const [email,    setEmail]    = useState('');
  const [token,    setToken]    = useState('');
  const [newPass,  setNewPass]  = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSendEmail = async () => {
    if (!email.trim()) { Alert.alert(t('common.error'), t('forgot.error.email')); return; }
    setLoading(true);
    try {
      await authService.forgotPassword(email.trim());
      setStep('reset');
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('forgot.error.sendFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    const code = token.trim();
    if (!code) { Alert.alert(t('common.error'), t('forgot.error.code')); return; }
    if (code.length !== 6) { Alert.alert(t('common.error'), t('forgot.error.codeLength')); return; }
    if (newPass.length < 8) { Alert.alert(t('common.error'), t('forgot.error.passwordLength')); return; }
    if (newPass !== confirm) { Alert.alert(t('common.error'), t('forgot.error.passwordMismatch')); return; }
    setLoading(true);
    try {
      await authService.resetPassword(email.trim(), code, newPass);
      Alert.alert(t('forgot.success.title'), t('forgot.success.text'), [
        { text: t('common.ok'), onPress: onGoLogin },
      ]);
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('forgot.error.resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.bg} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={styles.iconBox}>
          <Icon name="key" size={52} color="#2563EB" />
        </View>
        <Text style={styles.title}>{t('forgot.title')}</Text>
        <Text style={styles.subtitle}>
          {step === 'email' ? t('forgot.subtitleEmail') : t('forgot.subtitleReset', { email })}
        </Text>

        <View style={styles.card}>
          {step === 'email' ? (
            <>
              <Text style={styles.label}>{t('forgot.emailLabel')}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="example@mail.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.btn} onPress={handleSendEmail} disabled={loading} activeOpacity={0.8}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('forgot.sendBtn')}</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.infoBox}>{t('forgot.infoBox', { email })}</Text>

              <Text style={styles.label}>{t('forgot.codeLabel')}</Text>
              <TextInput
                style={styles.input}
                value={token}
                onChangeText={setToken}
                placeholder={t('forgot.codePlaceholder')}
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={6}
              />

              <Text style={styles.label}>{t('forgot.newPassword')}</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={styles.input}
                  value={newPass}
                  onChangeText={setNewPass}
                  placeholder={t('forgot.passwordPlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                  <Icon name={showPass ? 'eye-off' : 'eye'} size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>{t('forgot.confirmPassword')}</Text>
              <TextInput
                style={[styles.input, confirm.length > 0 && confirm !== newPass && styles.inputError]}
                value={confirm}
                onChangeText={setConfirm}
                placeholder={t('forgot.repeatPasswordPlaceholder')}
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPass}
              />
              {confirm.length > 0 && confirm !== newPass && (
                <Text style={styles.errorText}>{t('forgot.passwordMismatch')}</Text>
              )}

              <TouchableOpacity style={styles.btn} onPress={handleReset} disabled={loading} activeOpacity={0.8}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('forgot.resetBtn')}</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setStep('email')} style={styles.backBtn}>
                <Text style={styles.backText}>{t('forgot.anotherEmail')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity onPress={onGoLogin} style={styles.loginLink}>
          <Text style={styles.loginLinkText}>{t('forgot.backToLogin')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bg:         { flex: 1, backgroundColor: '#F8FAFC' },
  container:  { flexGrow: 1, padding: 24, paddingBottom: 40, justifyContent: 'center' },
  iconBox:    { alignItems: 'center', marginBottom: 12 },
  title:      { fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 6 },
  subtitle:   { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  card:       { backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  infoBox:    { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, fontSize: 13, color: '#1D4ED8', marginBottom: 16, lineHeight: 20 },
  label:      { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 5 },
  input:      { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 14 },
  inputError: { borderColor: '#EF4444' },
  eyeBtn:     { position: 'absolute', right: 12, top: 10 },
  errorText:  { fontSize: 11, color: '#EF4444', marginBottom: 8 },
  btn:        { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  backBtn:    { alignItems: 'center', marginTop: 14 },
  backText:   { fontSize: 13, color: '#6B7280' },
  loginLink:  { alignItems: 'center', marginTop: 24 },
  loginLinkText:{ fontSize: 13, color: '#2563EB', fontWeight: '600' },
});
