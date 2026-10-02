import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Eraser,
  PenTool,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { compressImageFile } from '../utils/formatters';

interface SignatureControlProps {
  label: string;
  subtitle?: string;
  value: string;
  onChange: (dataUrl: string) => void;
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
}) => {
  const [activeMode, setActiveMode] = useState<'preview' | 'pad' | 'upload'>(
    'preview'
  );
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Gunakan format file PNG, JPG, atau JPEG.');
      return;
    }

    try {
      const compressed = await compressImageFile(file, 500, 260, true);
      onChange(compressed);
      setActiveMode('preview');
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Gagal memuat gambar tanda tangan.'
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            {label}
          </h4>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setStrokes([]);
              setActiveMode(activeMode === 'pad' ? 'preview' : 'pad');
            }}
            className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
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
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-1.5 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload File
          </button>

          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-1 transition"
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
        accept="image/png,image/jpeg,image/jpg"
        onChange={handleFileUpload}
        className="hidden"
      />

      {uploadError && (
        <p className="text-xs text-red-600 mb-2">{uploadError}</p>
      )}

      {activeMode === 'pad' ? (
        <div className="space-y-3">
          <div className="relative rounded-xl border-2 border-dashed border-blue-300 bg-white overflow-hidden">
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
                Goreskan tanda tangan di area ini menggunakan jari atau stylus
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUndo}
                disabled={strokes.length === 0}
                className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Undo
              </button>
              <button
                type="button"
                onClick={handleClearPad}
                disabled={strokes.length === 0}
                className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1.5"
              >
                <Eraser className="w-3.5 h-3.5" />
                Ulangi / Clear
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveMode('preview')}
                className="min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSavePad}
                disabled={strokes.length === 0}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 disabled:opacity-40 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Simpan Tanda Tangan
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-[96px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-center p-3">
          {value ? (
            <div className="flex flex-col items-center gap-2">
              <img
                src={value}
                alt={label}
                referrerPolicy="no-referrer"
                className="max-h-24 max-w-full object-contain bg-white/90 px-3 py-1.5 rounded-lg border border-slate-200/70"
              />
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                Tanda tangan siap digunakan pada PDF (Background Transparan)
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center">
              Belum ada tanda tangan. Pilih <strong>Coret Layar</strong> atau{' '}
              <strong>Upload File</strong> (PNG/JPG).
            </p>
          )}
        </div>
      )}
    </div>
  );
};
