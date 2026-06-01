import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { chatService, type ChatMessage } from '../services/chatService';
import { useAuth } from '../context';
import Icon from './Icon';

interface Props {
  applicationId: string;
  otherPartyName: string;
  onClose: () => void;
}

const ChatModal = ({ applicationId, otherPartyName, onClose }: Props) => {
  const { t } = useTranslation();
  const { user, accessToken } = useAuth();
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [input, setInput]         = useState('');
  const [sending, setSending]     = useState(false);
  const [connected, setConnected] = useState(false);
  const [modalHeight, setModalHeight] = useState<string>('92dvh');
  const bottomRef      = useRef<HTMLDivElement>(null);
  const wsRef          = useRef<WebSocket | null>(null);
  const reconnectRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setModalHeight(`${Math.round(vv.height * 0.95)}px`);
    vv.addEventListener('resize', update);
    update();
    return () => vv.removeEventListener('resize', update);
  }, []);

  // Load message history once on open
  useEffect(() => {
    chatService.getMessages(applicationId).then(setMessages).catch(() => {});
  }, [applicationId]);

  const connect = useCallback(() => {
    if (!accessToken) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    // Browser WebSocket API cannot send custom headers, so the JWT goes in the query string.
    // This is the standard pattern for browser-based WebSocket auth.
    const ws = new WebSocket(
      `${proto}://${window.location.host}/ws/chat/${applicationId}?token=${accessToken}`
    );
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (e) => {
      try {
        const msg: ChatMessage = JSON.parse(e.data);
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 3 s
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, [applicationId, accessToken]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Server broadcasts the message back — no manual state update needed
      ws.send(JSON.stringify({ content: text }));
      setInput('');
    } else {
      // WS not ready — fall back to HTTP POST
      setSending(true);
      try {
        const msg = await chatService.sendMessage(applicationId, text);
        setMessages(prev => [...prev, msg]);
        setInput('');
      } catch {
        // ignore
      } finally {
        setSending(false);
      }
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg flex flex-col sm:h-[560px]"
        style={{ height: modalHeight }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
              {otherPartyName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{otherPartyName}</p>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                <p className="text-xs text-gray-400">
                  {connected ? t('chat.online') : t('chat.connecting')}
                </p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400 text-sm">{t('chat.empty')}</p>
            </div>
          )}
          {messages.map(msg => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                  isMe
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                }`}>
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-xs mt-1 ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-200">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={t('chat.placeholder')}
              rows={1}
              className="flex-1 resize-none px-4 py-2.5 border border-gray-300 rounded-xl text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {t('chat.send')}
            </button>
          </div>
          <p className="hidden sm:block text-xs text-gray-400 mt-1.5">{t('chat.enterHint')}</p>
        </div>
      </div>
    </div>
  );
};

export default ChatModal;
