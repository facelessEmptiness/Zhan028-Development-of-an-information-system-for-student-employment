import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  type: 'terms' | 'privacy';
  onClose: () => void;
}

export default function LegalModal({ type, onClose }: Props) {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const key = type === 'terms' ? 'legal.terms' : 'legal.privacy';
  const sections = t(`${key}.sections`, { returnObjects: true }) as Array<{ title: string; text: string }>;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t(`${key}.title`)}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t(`${key}.lastUpdated`)}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 flex-1">
          <p className="text-sm text-gray-600 mb-5 leading-relaxed">{t(`${key}.intro`)}</p>

          {Array.isArray(sections) && sections.map((s, i) => (
            <div key={i} className="mb-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-1.5">
                {i + 1}. {s.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">{s.text}</p>
            </div>
          ))}

          <div className="mt-6 p-4 bg-blue-50 rounded-xl">
            <p className="text-xs text-blue-700 leading-relaxed">{t(`${key}.contact`)}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            {t('legal.understood')}
          </button>
        </div>
      </div>
    </div>
  );
}
