/**
 * Indonesian date formatting, Terbilang (number to words) conversion,
 * automatic BAST numbering, and image/Google Drive URL helpers.
 */

const HARI_INDONESIA = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

const BULAN_INDONESIA = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const ROMAWI_BULAN = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
];

const SATUAN = [
  '',
  'satu',
  'dua',
  'tiga',
  'empat',
  'lima',
  'enam',
  'tujuh',
  'delapan',
  'sembilan',
  'sepuluh',
  'sebelas',
];

export function angkaKeTerbilang(n: number): string {
  const num = Math.floor(Math.abs(n));
  if (num === 0) return 'nol';
  if (num < 12) return SATUAN[num];
  if (num < 20) return `${angkaKeTerbilang(num - 10)} belas`;
  if (num < 100) {
    const puluh = Math.floor(num / 10);
    const sisa = num % 10;
    return `${angkaKeTerbilang(puluh)} puluh${sisa > 0 ? ' ' + angkaKeTerbilang(sisa) : ''}`.trim();
  }
  if (num < 200) {
    const sisa = num - 100;
    return `seratus${sisa > 0 ? ' ' + angkaKeTerbilang(sisa) : ''}`.trim();
  }
  if (num < 1000) {
    const ratus = Math.floor(num / 100);
    const sisa = num % 100;
    return `${angkaKeTerbilang(ratus)} ratus${sisa > 0 ? ' ' + angkaKeTerbilang(sisa) : ''}`.trim();
  }
  if (num < 2000) {
    const sisa = num - 1000;
    return `seribu${sisa > 0 ? ' ' + angkaKeTerbilang(sisa) : ''}`.trim();
  }
  if (num < 1000000) {
    const ribu = Math.floor(num / 1000);
    const sisa = num % 1000;
    return `${angkaKeTerbilang(ribu)} ribu${sisa > 0 ? ' ' + angkaKeTerbilang(sisa) : ''}`.trim();
  }
  return String(num);
}

export function toTitleCase(str: string): string {
  return str
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function parseDateSafe(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) return dt;
  }
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

/**
 * Formats YYYY-MM-DD into "14 Mei 2025"
 */
export function formatTanggalIndonesia(dateStr: string): string {
  if (!dateStr) return '-';
  const dt = parseDateSafe(dateStr);
  const tanggal = dt.getDate();
  const bulan = BULAN_INDONESIA[dt.getMonth()] || '';
  const tahun = dt.getFullYear();
  return `${tanggal} ${bulan} ${tahun}`;
}

/**
 * Generates details for the BAST opening sentence:
 * "Pada hari ini Rabu tanggal Empat Belas bulan Mei tahun Dua Ribu Dua Puluh Lima"
 */
export function getKalimatTanggalBast(dateStr: string): {
  hari: string;
  tanggalAngka: number;
  tanggalTerbilang: string;
  bulan: string;
  tahunAngka: number;
  tahunTerbilang: string;
  kalimatLengkap: string;
} {
  const dt = parseDateSafe(dateStr);
  const hari = HARI_INDONESIA[dt.getDay()] || 'Senin';
  const tanggalAngka = dt.getDate();
  const tanggalTerbilang = toTitleCase(angkaKeTerbilang(tanggalAngka));
  const bulan = BULAN_INDONESIA[dt.getMonth()] || 'Januari';
  const tahunAngka = dt.getFullYear();
  const tahunTerbilang = toTitleCase(angkaKeTerbilang(tahunAngka));

  const kalimatLengkap = `Pada hari ini ${hari} tanggal ${tanggalTerbilang} Bulan ${bulan} Tahun ${tahunTerbilang}, kami yang bertanda tangan di bawah ini :`;

  return {
    hari,
    tanggalAngka,
    tanggalTerbilang,
    bulan,
    tahunAngka,
    tahunTerbilang,
    kalimatLengkap,
  };
}

/**
 * Generates an automatic BAST number using user's pattern.
 * Supported tokens: {NO}, {ROMAN_MONTH}, {MONTH}, {YEAR}
 * Example pattern: "BAST/{NO}/{ROMAN_MONTH}/{YEAR}" -> "BAST/001/X/2026"
 */
export function generateNomorBast(
  formatPattern: string,
  counter: number,
  dateStr?: string
): string {
  const dt = dateStr ? parseDateSafe(dateStr) : new Date();
  const paddedNo = String(Math.max(1, counter)).padStart(3, '0');
  const monthIdx = dt.getMonth();
  const romanMonth = ROMAWI_BULAN[monthIdx] || 'I';
  const numMonth = String(monthIdx + 1).padStart(2, '0');
  const year = String(dt.getFullYear());

  const pattern = formatPattern?.trim() || 'BAST/{NO}/{ROMAN_MONTH}/{YEAR}';
  return pattern
    .replace(/\{NO\}/gi, paddedNo)
    .replace(/\{ROMAN_MONTH\}/gi, romanMonth)
    .replace(/\{MONTH\}/gi, numMonth)
    .replace(/\{YEAR\}/gi, year);
}

/**
 * Automatically converts Google Drive sharing links into direct image URLs.
 */
export function convertGoogleDriveUrl(inputUrl: string): string {
  const trimmed = inputUrl.trim();
  if (!trimmed) return '';

  // Match /file/d/FILE_ID/ or /d/FILE_ID/
  const fileIdMatch =
    trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (fileIdMatch && fileIdMatch[1]) {
    const fileId = fileIdMatch[1];
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  return trimmed;
}

/**
 * Generates a clean, valid Firestore document ID matching ^[a-zA-Z0-9_\-]+$
 */
export function generateSafeId(prefix = 'doc'): string {
  const randomPart = Math.random().toString(36).substring(2, 10);
  const timePart = Date.now().toString(36);
  return `${prefix}_${timePart}_${randomPart}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Compresses an uploaded image file (PNG/JPG/JPEG) into a clean Data URL
 * while preserving PNG transparency (crucial for logos, stamps, and signatures)
 * and keeping size strictly under maxChars for Firestore storage.
 */
export async function compressImageFile(
  file: File,
  maxWidth = 600,
  maxHeight = 600,
  preserveTransparency = true
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak valid.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Gagal menginisialisasi pemrosesan gambar.'));
          return;
        }

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const isPng =
          preserveTransparency ||
          file.type === 'image/png' ||
          file.name.toLowerCase().endsWith('.png');

        let dataUrl = isPng
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', 0.82);

        // If PNG is still larger than 220KB, scale down slightly to guarantee Firestore compliance
        if (dataUrl.length > 220000) {
          const scaleCanvas = document.createElement('canvas');
          scaleCanvas.width = Math.round(width * 0.65);
          scaleCanvas.height = Math.round(height * 0.65);
          const sCtx = scaleCanvas.getContext('2d');
          if (sCtx) {
            sCtx.clearRect(0, 0, scaleCanvas.width, scaleCanvas.height);
            sCtx.drawImage(img, 0, 0, scaleCanvas.width, scaleCanvas.height);
            dataUrl = isPng
              ? scaleCanvas.toDataURL('image/png')
              : scaleCanvas.toDataURL('image/jpeg', 0.75);
          }
        }

        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Creates a default MTA / Corporate Logo Data URL so the PDF header looks
 * complete and official out of the box if the user hasn't uploaded one yet.
 */
export function getDefaultCompanyLogoDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="90" viewBox="0 0 260 90">
    <ellipse cx="95" cy="45" rx="85" ry="32" fill="#5B7B9A" opacity="0.85"/>
    <ellipse cx="115" cy="45" rx="72" ry="24" fill="#FFFFFF"/>
    <text x="122" y="55" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="34" fill="#4A6B88" letter-spacing="3">MTA</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
