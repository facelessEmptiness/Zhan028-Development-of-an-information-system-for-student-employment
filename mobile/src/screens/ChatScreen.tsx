import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { chatService, type ChatMessage } from '../services/chatService';
import { authService } from '../services/authService';
import { formatTime } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../services/api';

export default function ChatScreen() {
  const { t } = useTranslation();
  const route    = useRoute();
  const { applicationId, standalone } = route.params as { applicationId: string; title: string; standalone?: boolean };
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [messages,       setMessages]       = useState<ChatMessage[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [text,           setText]           = useState('');
  const [sending,        setSending]        = useState(false);
  const [connected,      setConnected]      = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef      = useRef<FlatList>(null);
  const wsRef        = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef   = useRef(true);

  // On Android with edgeToEdgeEnabled, manually track keyboard height
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', e => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Load message history once
  const loadHistory = useCallback(async () => {
    try {
      const data = await chatService.getMessages(applicationId);
      setMessages(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // WebSocket connection
  const connect = useCallback(async () => {
    const token = await authService.getToken();
    if (!token) return;

    const wsBase = API_BASE.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsBase}/ws/chat/${applicationId}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => { if (mountedRef.current) setConnected(true); };

    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'presence') return; // ignore presence events
        const msg: ChatMessage = data;
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      } catch {}
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, [applicationId]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      const ws = wsRef.current;
      if (ws) {
        ws.onclose = null; // prevent reconnect after unmount
        ws.close();
      }
    };
  }, [connect]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Server broadcasts back — no manual state update needed
      ws.send(JSON.stringify({ content }));
      setText('');
    } else {
      // WS not ready — fall back to HTTP POST
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
    }
  };

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#2563EB" />;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.flex, Platform.OS === 'android' && { paddingBottom: keyboardHeight }]}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Icon name="chat" size={48} color="#D1D5DB" /></View>
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

        {/* Connection status strip */}
        {!connected && (
          <View style={styles.statusBar}>
            <ActivityIndicator size="small" color="#6B7280" style={{ marginRight: 6 }} />
            <Text style={styles.statusText}>{t('chats.connecting')}</Text>
          </View>
        )}

        <View style={[styles.inputRow, { paddingBottom: standalone ? 10 + insets.bottom : 10 }]}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={t('chats.messagePlaceholder')}
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={1000}
            returnKeyType="send"
            submitBehavior="newline"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Icon name="send" size={16} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:              { flex: 1, backgroundColor: '#F8FAFC' },
  loader:            { marginTop: 60 },
  list:              { padding: 12, paddingBottom: 8, flexGrow: 1 },
  empty:             { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon:         { marginBottom: 10 },
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
  statusBar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, backgroundColor: '#F3F4F6', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  statusText:        { fontSize: 12, color: '#6B7280' },
  inputRow:          { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 10, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#fff', gap: 8 },
  input:             { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB', maxHeight: 100 },
  sendBtn:           { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:   { backgroundColor: '#93C5FD' },
});
