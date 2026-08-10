import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/authService';
import Icon from '../components/Icon';

interface Props {
  email: string;
  onSuccess: () => void;
  onGoLogin: () => void;
}

export default function VerifyEmailScreen({ email, onSuccess, onGoLogin }: Props) {
  const { t } = useTranslation();
  const [digits,   setDigits]   = useState(['', '', '', '', '', '']);
  const [loading,  setLoading]  = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const code = digits.join('');

  const handleChange = (val: string, idx: number) => {
    if (val.length > 1) {
      const chars = val.replace(/\D/g, '').slice(0, 6).split('');
      const next = [...digits];
      chars.forEach((ch, i) => { if (idx + i < 6) next[idx + i] = ch; });
      setDigits(next);
      const focusIdx = Math.min(idx + chars.length, 5);
      inputRefs.current[focusIdx]?.focus();
      return;
    }
    const next = [...digits];
    next[idx] = val.replace(/\D/g, '');
    setDigits(next);
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyPress = (key: string, idx: number) => {
    if (key === 'Backspace' && !digits[idx] && idx > 0) {
      const next = [...digits];
      next[idx - 1] = '';
      setDigits(next);
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      Alert.alert(t('common.error'), t('verify.error.code'));
      return;
    }
    setLoading(true);
    try {
      await authService.verifyEmail(email, code);
      Alert.alert(t('verify.success.title'), t('verify.success.text'), [
        { text: t('verify.success.loginBtn'), onPress: onSuccess },
      ]);
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('verify.error.invalid'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await authService.resendVerification(email);
      setCooldown(60);
      Alert.alert(t('verify.resent'), t('verify.resentText'));
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.error'));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.bg} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={styles.iconBox}>
          <Icon name="mail" size={56} color="#2563EB" />
        </View>

        <Text style={styles.title}>{t('verify.title')}</Text>
        <Text style={styles.subtitle}>
          {t('verify.subtitle')}{'\n'}
          <Text style={styles.email}>{email}</Text>
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>{t('verify.codeLabel')}</Text>

          <View style={styles.codeRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={ref => { inputRefs.current[i] = ref; }}
                style={[styles.digitInput, d ? styles.digitFilled : null]}
                value={d}
                onChangeText={val => handleChange(val, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                keyboardType="number-pad"
                maxLength={6}
                selectTextOnFocus
                autoFocus={i === 0}
                textAlign="center"
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.btn, code.length < 6 && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={loading || code.length < 6}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{t('verify.confirmBtn')}</Text>
            }
          </TouchableOpacity>

          <View style={styles.resendRow}>
            <Text style={styles.resendHint}>{t('verify.noCode')}</Text>
            <TouchableOpacity onPress={handleResend} disabled={cooldown > 0}>
              <Text style={[styles.resendBtn, cooldown > 0 && styles.resendDisabled]}>
                {cooldown > 0 ? t('verify.resendCooldown', { count: cooldown }) : t('verify.resend')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity onPress={onGoLogin} style={styles.backLink}>
          <Text style={styles.backLinkText}>{t('verify.backToLogin')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bg:            { flex: 1, backgroundColor: '#F8FAFC' },
  container:     { flexGrow: 1, padding: 24, paddingBottom: 40, justifyContent: 'center' },
  iconBox:       { alignItems: 'center', marginBottom: 12 },
  title:         { fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 8 },
  subtitle:      { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  email:         { fontWeight: '700', color: '#2563EB' },
  card:          { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  label:         { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 16, textAlign: 'center' },
  codeRow:       { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 24 },
  digitInput:    { width: 44, height: 54, borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 12, fontSize: 22, fontWeight: '700', color: '#111827', backgroundColor: '#F9FAFB' },
  digitFilled:   { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  btn:           { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnDisabled:   { backgroundColor: '#93C5FD' },
  btnText:       { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendRow:     { alignItems: 'center', marginTop: 18, gap: 6 },
  resendHint:    { fontSize: 13, color: '#6B7280' },
  resendBtn:     { fontSize: 13, color: '#2563EB', fontWeight: '700' },
  resendDisabled:{ color: '#9CA3AF' },
  backLink:      { alignItems: 'center', marginTop: 24 },
  backLinkText:  { fontSize: 13, color: '#2563EB', fontWeight: '600' },
});
