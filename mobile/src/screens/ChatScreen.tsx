import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { chatService, type ChatMessage } from '../services/chatService';
import { formatTime } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';

export default function ChatScreen() {
  const { t } = useTranslation();
  const route    = useRoute();
  const { applicationId } = route.params as { applicationId: string; title: string };
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [text,     setText]     = useState('');
  const [sending,  setSending]  = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const data = await chatService.getMessages(applicationId);
      setMessages(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setText('');
    setSending(true);
    try {
      const msg = await chatService.sendMessage(applicationId, content);
      setMessages(prev => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setText(content);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>{t('chats.startChat')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isMine = item.sender_id === user?.id;
          return (
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
                {item.content}
              </Text>
              <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                {formatTime(item.created_at)}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={t('chats.messagePlaceholder')}
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={1000}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.sendIcon}>➤</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:              { flex: 1, backgroundColor: '#F8FAFC' },
  loader:            { marginTop: 60 },
  list:              { padding: 12, paddingBottom: 8, flexGrow: 1 },
  empty:             { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon:         { fontSize: 48, marginBottom: 10 },
  emptyText:         { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  bubble:            { maxWidth: '78%', borderRadius: 16, padding: 10, marginBottom: 8 },
  bubbleMine:        { alignSelf: 'flex-end', backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
  bubbleTheirs:      { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  bubbleText:        { fontSize: 14, lineHeight: 20 },
  bubbleTextMine:    { color: '#fff' },
  bubbleTextTheirs:  { color: '#111827' },
  bubbleTime:        { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMine:    { color: 'rgba(255,255,255,0.7)' },
  bubbleTimeTheirs:  { color: '#9CA3AF' },
  inputRow:          { flexDirection: 'row', alignItems: 'flex-end', padding: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#fff', gap: 8 },
  input:             { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB', maxHeight: 100 },
  sendBtn:           { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:   { backgroundColor: '#93C5FD' },
  sendIcon:          { fontSize: 16, color: '#fff' },
});
