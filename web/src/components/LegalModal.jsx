import { useEffect } from 'react';

const SRC = {
  privacy: '/privacy.html',
  terms: '/terms.html',
};

const TITLE = {
  privacy: 'SkyXing 隐私政策',
  terms: 'SkyXing 服务条款',
};

export default function LegalModal({ open, type, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={TITLE[type]}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{TITLE[type]}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
            aria-label="关闭"
          >
            &times;
          </button>
        </div>
        <iframe
          src={SRC[type]}
          title={TITLE[type]}
          className="w-full flex-1 border-0"
          style={{ minHeight: '60vh' }}
        />
      </div>
    </div>
  );
}
