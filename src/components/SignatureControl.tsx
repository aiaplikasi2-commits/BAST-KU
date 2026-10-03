import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Eraser,
  PenTool,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { compressImageFile } from '../utils/formatters';
import { showQuickPopup } from '../utils/quickPopup';

interface SignatureControlProps {
  label: string;
  subtitle?: string;
  value: string;
  onChange: (dataUrl: string) => void;
  defaultSettingSignature?: string;
  onUseDefaultFromSettings?: () => void;
}

interface Point {
  x: number;
  y: number;
}

export const SignatureControl: React.FC<SignatureControlProps> = ({
  label,
  subtitle,
  value,
  onChange,
  defaultSettingSignature,
  onUseDefaultFromSettings,
}) => {
  const [activeMode, setActiveMode] = useState<'preview' | 'pad'>('preview');
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Redraw signature canvas whenever strokes or currentStroke change
  useEffect(() => {
    if (activeMode !== 'pad') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawPath = (pts: Point[]) => {
      if (pts.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      if (pts.length === 1) {
        ctx.lineTo(pts[0].x + 0.5, pts[0].y + 0.5);
      }
      ctx.stroke();
    };

    strokes.forEach(drawPath);
    if (currentStroke.length > 0) {
      drawPath(currentStroke);
    }
  }, [strokes, currentStroke, activeMode]);

  const getCanvasPoint = (
    e: React.PointerEvent<HTMLCanvasElement>
  ): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getCanvasPoint(e);
    if (!pt) return;
    setIsDrawing(true);
    setCurrentStroke([pt]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pt = getCanvasPoint(e);
    if (!pt) return;
    setCurrentStroke((prev) => [...prev, pt]);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    if (currentStroke.length > 0) {
      setStrokes((prev) => [...prev, currentStroke]);
      setCurrentStroke([]);
    }
  };

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleClearPad = () => {
    setStrokes([]);
    setCurrentStroke([]);
  };

  const handleSavePad = () => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) return;

    // Crop tight around drawn strokes with transparent PNG background
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;

    for (const stroke of strokes) {
      for (const pt of stroke) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
    }

    const pad = 16;
    const cropX = Math.max(0, Math.floor(minX - pad));
    const cropY = Math.max(0, Math.floor(minY - pad));
    const cropW = Math.min(
      canvas.width - cropX,
      Math.max(80, Math.ceil(maxX - minX + pad * 2))
    );
    const cropH = Math.min(
      canvas.height - cropY,
      Math.max(40, Math.ceil(maxY - minY + pad * 2))
    );

    const outCanvas = document.createElement('canvas');
    outCanvas.width = cropW;
    outCanvas.height = cropH;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return;

    outCtx.clearRect(0, 0, cropW, cropH);
    outCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const pngDataUrl = outCanvas.toDataURL('image/png');
    onChange(pngDataUrl);
    setActiveMode('preview');
    showQuickPopup('Tanda tangan berhasil dibuat!', 'success');
  };

  const processImageFile = async (file: File) => {
    setUploadError(null);
    const isImage =
      file.type.startsWith('image/') ||
      /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);

    if (!isImage) {
      setUploadError('Gunakan format file gambar (PNG, JPG, JPEG, WEBP).');
      return;
    }

    try {
      const compressed = await compressImageFile(file, 600, 300, true);
      onChange(compressed);
      setActiveMode('preview');
      showQuickPopup('File tanda tangan berhasil diupload & siap digunakan!', 'success');
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Gagal memproses file tanda tangan.'
      );
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processImageFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processImageFile(file);
    }
  };

  const isSyncedWithSettings = Boolean(
    value &&
    defaultSettingSignature &&
    value.trim() === defaultSettingSignature.trim()
  );

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-900 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              {label}
            </h4>
            {isSyncedWithSettings && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3 h-3" />
                Sinkron Pengaturan
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {defaultSettingSignature && onUseDefaultFromSettings && (
            <button
              type="button"
              onClick={onUseDefaultFromSettings}
              className={`min-h-[38px] px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 border transition ${
                isSyncedWithSettings
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
              }`}
              title="Gunakan Tanda Tangan dari Menu Pengaturan"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Singkron Pengaturan
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setStrokes([]);
              setActiveMode(activeMode === 'pad' ? 'preview' : 'pad');
            }}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              activeMode === 'pad'
                ? 'bg-blue-900 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            Coret Layar
          </button>

          <button
            type="button"
            onClick={triggerUploadClick}
            className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 flex items-center gap-1.5 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload File TTD
          </button>

          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-1 transition"
              title="Hapus Tanda Tangan"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.png,.jpg,.jpeg,.webp"
        onClick={(e) => {
          (e.target as HTMLInputElement).value = '';
        }}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {uploadError && (
        <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-300">
          {uploadError}
        </div>
      )}

      {activeMode === 'pad' ? (
        <div className="space-y-3">
          <div className="relative rounded-xl border-2 border-dashed border-blue-400 bg-white overflow-hidden shadow-inner">
            <canvas
              ref={canvasRef}
              width={560}
              height={220}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="w-full h-44 touch-none cursor-crosshair block"
            />
            {strokes.length === 0 && currentStroke.length === 0 && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-xs text-slate-400">
                Goreskan tanda tangan di area ini menggunakan jari, mouse, atau stylus
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUndo}
                disabled={strokes.length === 0}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Undo
              </button>
              <button
                type="button"
                onClick={handleClearPad}
                disabled={strokes.length === 0}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1.5"
              >
                <Eraser className="w-3.5 h-3.5" />
                Ulangi
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveMode('preview')}
                className="min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSavePad}
                disabled={strokes.length === 0}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 disabled:opacity-40 flex items-center gap-1.5 shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                Simpan Goresan TTD
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`min-h-[104px] rounded-xl border-2 transition p-4 flex flex-col items-center justify-center ${
            isDragOver
              ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40'
              : 'border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40'
          }`}
        >
          {value ? (
            <div className="flex flex-col items-center gap-2.5 w-full">
              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-center max-w-full">
                <img
                  src={value}
                  alt={label}
                  referrerPolicy="no-referrer"
                  className="max-h-24 max-w-full object-contain"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Tanda tangan aktif &amp; siap dicetak di PDF
                </span>
                <button
                  type="button"
                  onClick={triggerUploadClick}
                  className="text-[11px] font-semibold text-blue-900 dark:text-blue-300 hover:underline"
                >
                  Ganti File
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center py-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveMode('pad')}
                  className="px-3 py-1.5 rounded-lg bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 flex items-center gap-1"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  Coret Layar
                </button>
                <span className="text-xs text-slate-400">atau</span>
                <button
                  type="button"
                  onClick={triggerUploadClick}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  Pilih File Gambar (PNG/JPG)
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Bisa drag &amp; drop file foto/scan tanda tangan langsung ke sini
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
