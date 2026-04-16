import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { chatService, type ChatMessage } from '../services/chatService';
import { useAuth } from '../context';

interface Props {
  applicationId: string;
  /** Display name of the other party */
  otherPartyName: string;
  onClose: () => void;
}

const POLL_INTERVAL = 4000;

const ChatModal = ({ applicationId, otherPartyName, onClose }: Props) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    chatService.getMessages(applicationId)
      .then(setMessages)
      .catch(() => {});
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [applicationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
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
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col" style={{ height: '560px' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
              {otherPartyName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{otherPartyName}</p>
              <p className="text-xs text-gray-400">{t('chat.online')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
          >
            ✕
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
              className="flex-1 resize-none px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {t('chat.send')}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">{t('chat.enterHint')}</p>
        </div>
      </div>
    </div>
  );
};

export default ChatModal;
