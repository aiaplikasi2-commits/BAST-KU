import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs transition"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install Aplikasi</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-900 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Install Aplikasi BAST ke HP
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
                <p>Untuk menginstall aplikasi di perangkat iOS/Safari:</p>
                <ol className="list-decimal list-inside space-y-1 font-medium">
                  <li>
                    Ketuk ikon <strong>Bagikan (Share)</strong> di bilah bawah browser.
                  </li>
                  <li>
                    Pilih menu <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
                <p>
                  Untuk menginstall aplikasi BAST langsung ke layar utama HP Android Anda:
                </p>
                <ol className="list-decimal list-inside space-y-1 font-medium">
                  <li>
                    Ketuk ikon menu <strong> titik tiga (&vellip;)</strong> di pojok kanan atas browser Chrome.
                  </li>
                  <li>
                    Pilih <strong>Install aplikasi</strong> atau <strong>Tambahkan ke layar utama</strong>.
                  </li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full min-h-[42px] rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};
