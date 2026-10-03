import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppSettings, BastDocument, BastItem } from '../types';
import {
  formatKopAddressLines,
  getCorporateEmblemDataUrl,
} from './defaultLogo';
import {
  formatTanggalIndonesia,
  getKalimatTanggalBast,
} from './formatters';

/**
 * Helper to convert any image URL / Data URL (including SVG Data URL) into a clean
 * high-DPI PNG Data URL and measure its natural aspect ratio for crisp PDF embedding.
 */
async function prepareImageForPdf(
  src: string
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!src || !src.trim()) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = (img.naturalWidth || img.width || 330) * 2;
        const h = (img.naturalHeight || img.height || 115) * 2;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: w,
          height: h,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Generates an official A4 Portrait PDF for a BAST document.
 * Styled after the corporate BAST reference (gambar.png - CV. MULIA TEKHNIK ABADI):
 * - Extra-bold, large Header 1 company name in steel blue (#3B6E8C)
 * - Logo FIXED at the left edge of the horizontal Kop line (marginX), scalable via logo_scale
 * - Balanced 2-line address, underlined email, bold phone number
 * - Formal compound horizontal Kop rule (Garis Kop)
 */
export async function generateBastPdfDocument(
  bast: BastDocument,
  items: BastItem[],
  settings: AppSettings
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 20;
  const contentWidth = pageWidth - marginX * 2; // 170mm

  let cursorY = 14;

  // ---------------------------------------------------------------------------
  // 1. HEADER / KOP SURAT (SESUAI GAMBAR REFERENSI)
  // ---------------------------------------------------------------------------
  const companyName =
    settings.nama_perusahaan?.trim() || 'CV.MULIA TEKHNIK ABADI';
  const companyAddress =
    settings.alamat?.trim() ||
    'Jl. Letda Nasir No.58 Desa Cikeas Udik Kecamatan Gunung Putri Kab. Bogor Kode Pos 16966';
  const companyEmail = settings.email?.trim();
  const companyPhone = settings.telepon?.trim();

  const logoSrc =
    settings.logo?.trim() || getCorporateEmblemDataUrl(companyName);
  const preparedLogo = await prepareImageForPdf(logoSrc);

  // Center X of the Kop text block (slightly right of page center so large title & address sit harmoniously with left logo)
  const headerCenterX = pageWidth / 2 + 10; // 115mm
  const maxTextWidth = 136;

  // KOP HEADER 1: Extra-Bold & Larger (simulating heavy/black font weight like Arial Black in gambar.png)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.setTextColor(59, 110, 140); // #3B6E8C matches gambar.png
  const upperCompanyName = companyName.toUpperCase();
  const titleY = cursorY + 6;
  // Multi-pass micro-offset to achieve ExtraBold / Heavy weight like Arial Black in gambar.png
  doc.text(upperCompanyName, headerCenterX, titleY, { align: 'center' });
  doc.text(upperCompanyName, headerCenterX + 0.22, titleY, { align: 'center' });
  doc.text(upperCompanyName, headerCenterX - 0.22, titleY, { align: 'center' });
  doc.text(upperCompanyName, headerCenterX, titleY + 0.15, { align: 'center' });
  doc.text(upperCompanyName, headerCenterX, titleY - 0.12, { align: 'center' });

  // Balanced Address Lines
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const rawBalancedLines = formatKopAddressLines(companyAddress);
  let headerLineY = titleY + 5.8;

  for (const rawLine of rawBalancedLines) {
    const wrapped = doc.splitTextToSize(rawLine, maxTextWidth);
    for (const subLine of wrapped) {
      doc.text(subLine, headerCenterX, headerLineY, { align: 'center' });
      headerLineY += 4.4;
    }
  }

  // Email Line with underlined email address
  if (companyEmail) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const prefixStr = 'email. ';
    const fullEmailLine = `${prefixStr}${companyEmail}`;
    const fullW = doc.getTextWidth(fullEmailLine);
    const prefixW = doc.getTextWidth(prefixStr);
    const startX = headerCenterX - fullW / 2;

    doc.setTextColor(60, 72, 88);
    doc.text(prefixStr, startX, headerLineY);

    doc.setTextColor(59, 110, 140);
    doc.text(companyEmail, startX + prefixW, headerLineY);

    // Underline specifically beneath the email address
    doc.setDrawColor(59, 110, 140);
    doc.setLineWidth(0.32);
    doc.line(
      startX + prefixW,
      headerLineY + 0.75,
      startX + fullW,
      headerLineY + 0.75
    );
    headerLineY += 4.5;
  }

  // Phone Line
  if (companyPhone) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`Tlp ${companyPhone}`, headerCenterX, headerLineY, {
      align: 'center',
    });
    headerLineY += 4.2;
  }

  // Compute scaled Logo dimensions (Perbesar / Perkecil Logo di KOP)
  let drawLogoW = 0;
  let drawLogoH = 0;
  if (preparedLogo) {
    const logoScale = Math.max(
      0.4,
      Math.min(2.2, (settings.logo_scale || 100) / 100)
    );
    const baseMaxW = 44 * logoScale;
    const baseMaxH = 18 * logoScale;
    const ratio = Math.min(
      baseMaxW / preparedLogo.width,
      baseMaxH / preparedLogo.height
    );
    drawLogoW = preparedLogo.width * ratio;
    drawLogoH = preparedLogo.height * ratio;
  }

  const lineY = Math.max(
    cursorY + 27.5,
    headerLineY + 1.6,
    cursorY + drawLogoH + 3
  );

  // Draw Logo anchored at the left edge of the horizontal Kop line (x = marginX) + user's custom (logo_x, logo_y) position offset
  if (preparedLogo && drawLogoW > 0 && drawLogoH > 0) {
    const offsetXmm = (settings.logo_x || 0) * 0.265;
    const offsetYmm = (settings.logo_y || 0) * 0.265;
    const logoX = Math.max(2, Math.min(pageWidth - drawLogoW - 2, marginX + offsetXmm));
    const logoY = Math.max(2, lineY - drawLogoH - 2.2 + offsetYmm);
    doc.addImage(
      preparedLogo.dataUrl,
      'PNG',
      logoX,
      logoY,
      drawLogoW,
      drawLogoH
    );
  }

  cursorY = lineY;

  // Compound Horizontal Line (Garis Kop Surat Resmi sesuai gambar.png)
  doc.setDrawColor(65, 75, 88);
  doc.setLineWidth(0.25);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
  doc.setLineWidth(0.75);
  doc.line(marginX, cursorY + 0.85, pageWidth - marginX, cursorY + 0.85);
  doc.setLineWidth(0.25);
  doc.line(marginX, cursorY + 1.7, pageWidth - marginX, cursorY + 1.7);

  cursorY += 8.5;

  // ---------------------------------------------------------------------------
  // 2. DOCUMENT TITLE & BAST NUMBER
  // ---------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  const titleText = 'BERITA ACARA SERAH TERIMA';
  doc.text(titleText, pageWidth / 2, cursorY, { align: 'center' });

  const titleWidth = doc.getTextWidth(titleText);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.45);
  doc.line(
    pageWidth / 2 - titleWidth / 2,
    cursorY + 0.9,
    pageWidth / 2 + titleWidth / 2,
    cursorY + 0.9
  );

  if (bast.nomor_bast?.trim()) {
    cursorY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Nomor : ${bast.nomor_bast.trim()}`, pageWidth / 2, cursorY, {
      align: 'center',
    });
  }

  cursorY += 8;

  // ---------------------------------------------------------------------------
  // 3. OPENING PARAGRAPH (PEMBUKA OTOMATIS TERBILANG)
  // ---------------------------------------------------------------------------
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);

  const { kalimatLengkap } = getKalimatTanggalBast(bast.tanggal_bast);
  const openingLines = doc.splitTextToSize(kalimatLengkap, contentWidth);
  doc.text(openingLines, marginX, cursorY);
  cursorY += openingLines.length * 5 + 3;

  // ---------------------------------------------------------------------------
  // 4. PIHAK PERTAMA
  // ---------------------------------------------------------------------------
  doc.setFont('helvetica', 'normal');
  doc.text('Yang disebut Pihak Pertama,', marginX, cursorY);
  cursorY += 5.5;

  const labelColX = marginX;
  const colonColX = marginX + 38;
  const valColX = marginX + 41;
  const valMaxWidth = contentWidth - 41;

  const renderFieldRow = (
    label: string,
    value: string,
    boldValue = false
  ) => {
    if (!value) return;
    doc.setFont('helvetica', 'normal');
    doc.text(label, labelColX, cursorY);
    doc.text(':', colonColX, cursorY);
    doc.setFont('helvetica', boldValue ? 'bold' : 'normal');
    const wrapped = doc.splitTextToSize(value, valMaxWidth);
    doc.text(wrapped, valColX, cursorY);
    cursorY += Math.max(1, wrapped.length) * 4.8 + 0.8;
  };

  renderFieldRow('Nama', bast.pihak_pertama_nama || '-', true);
  if (bast.pihak_pertama_jabatan?.trim()) {
    renderFieldRow('Jabatan', bast.pihak_pertama_jabatan.trim(), false);
  }
  renderFieldRow('Perusahaan', bast.pihak_pertama_pt || '-', true);
  renderFieldRow('Alamat', bast.pihak_pertama_alamat || '-', false);

  cursorY += 3;

  // ---------------------------------------------------------------------------
  // 5. PIHAK KEDUA
  // ---------------------------------------------------------------------------
  doc.setFont('helvetica', 'normal');
  doc.text('Selanjutnya disebut Pihak Kedua,', marginX, cursorY);
  cursorY += 5.5;

  renderFieldRow('Nama', bast.pihak_kedua_nama || '-', true);
  if (bast.pihak_kedua_jabatan?.trim()) {
    renderFieldRow('Jabatan', bast.pihak_kedua_jabatan.trim(), false);
  }
  renderFieldRow('Alamat', bast.pihak_kedua_alamat || '-', false);

  cursorY += 4;

  // ---------------------------------------------------------------------------
  // 6. ISI BERITA ACARA & NOMOR PO
  // ---------------------------------------------------------------------------
  doc.setFont('helvetica', 'normal');
  const poPart = bast.nomor_po?.trim()
    ? ` dengan nomor PO ${bast.nomor_po.trim()}`
    : '';
  const descPart = bast.deskripsi_pekerjaan?.trim()
    ? ` (${bast.deskripsi_pekerjaan.trim()})`
    : '';
  const bodySentence = `Dengan ini menerangkan bahwa pekerjaan${poPart}${descPart} telah selesai dikerjakan dengan rincian sebagai berikut :`;
  const bodyLines = doc.splitTextToSize(bodySentence, contentWidth);
  doc.text(bodyLines, marginX, cursorY);
  cursorY += bodyLines.length * 5 + 2;

  // ---------------------------------------------------------------------------
  // 7. TABEL BARANG / JASA (DENGAN AUTO-WRAP & REPEATING HEADER)
  // ---------------------------------------------------------------------------
  const sortedItems = [...items].sort(
    (a, b) => a.urutan - b.urutan || a.nomor - b.nomor
  );

  const tableBody = sortedItems.map((it, idx) => [
    String(idx + 1),
    it.nama_barang_jasa || '-',
    it.keterangan || 'Sesuai',
  ]);

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    head: [['No', 'Nama Barang / Jasa', 'Keterangan']],
    body: tableBody,
    showHead: 'everyPage',
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      textColor: [15, 23, 42],
      lineColor: [30, 41, 59],
      lineWidth: 0.3,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'center',
      minCellHeight: 9,
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 120, halign: 'left' },
      2: { cellWidth: 36, halign: 'center', fontStyle: 'italic' },
    },
  });

  const finalTableY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY || cursorY + 25;
  cursorY = finalTableY + 7;

  // ---------------------------------------------------------------------------
  // 8. PARAGRAF PENUTUP & TANDA TANGAN (CEGAH TERPOTONG HALAMAN)
  // ---------------------------------------------------------------------------
  const requiredClosingAndSigHeight = 76;
  if (cursorY + requiredClosingAndSigHeight > pageHeight - 16) {
    doc.addPage();
    cursorY = 20;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);

  const tglMulaiStr = formatTanggalIndonesia(bast.tanggal_mulai);
  const tglSelesaiStr = formatTanggalIndonesia(bast.tanggal_selesai);

  const closing1 = `Telah selesai dikerjakan oleh Pihak Kedua yang dimulai pada tanggal ${tglMulaiStr} dan selesai pada tanggal ${tglSelesaiStr} dan selanjutnya diserahkan kepada Pihak Pertama dalam kondisi baik dan berfungsi.`;
  const closing1Lines = doc.splitTextToSize(closing1, contentWidth);
  doc.text(closing1Lines, marginX, cursorY);
  cursorY += closing1Lines.length * 5 + 3.5;

  const closing2 =
    'Demikian Berita Acara Serah Terima ini dibuat untuk dapat digunakan sebagaimana mestinya.';
  const closing2Lines = doc.splitTextToSize(closing2, contentWidth);
  doc.text(closing2Lines, marginX, cursorY);
  cursorY += closing2Lines.length * 5 + 6;

  // ---------------------------------------------------------------------------
  // 9. TANDA TANGAN & STEMPEL
  // ---------------------------------------------------------------------------
  const leftSigCenterX = marginX + 35;
  const rightSigCenterX = pageWidth - marginX - 35;

  const kotaText = bast.kota?.trim() || settings.kota?.trim() || 'Bogor';
  const tanggalBastIndo = formatTanggalIndonesia(bast.tanggal_bast);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${kotaText}, ${tanggalBastIndo}`, leftSigCenterX - 25, cursorY);
  cursorY += 5.5;

  doc.text('Pihak Pertama', leftSigCenterX - 25, cursorY);
  doc.text('Pihak Kedua', rightSigCenterX - 20, cursorY);

  const sigBoxTopY = cursorY + 2;
  const sigBoxHeight = 24;

  const sig1Src =
    bast.signature_party_1?.trim() || settings.signature_party_1?.trim() || '';
  const sig2Src =
    bast.signature_party_2?.trim() || settings.signature_party_2?.trim() || '';
  const stempelSrc =
    bast.use_stempel && settings.stempel?.trim()
      ? settings.stempel.trim()
      : '';

  const [prepSig1, prepSig2, prepStempel] = await Promise.all([
    prepareImageForPdf(sig1Src),
    prepareImageForPdf(sig2Src),
    prepareImageForPdf(stempelSrc),
  ]);

  if (prepSig1) {
    const maxW = 42;
    const maxH = 21;
    const ratio = Math.min(maxW / prepSig1.width, maxH / prepSig1.height);
    const w = prepSig1.width * ratio;
    const h = prepSig1.height * ratio;
    doc.addImage(
      prepSig1.dataUrl,
      'PNG',
      leftSigCenterX - 25,
      sigBoxTopY + (sigBoxHeight - h) / 2,
      w,
      h
    );
  }

  if (prepSig2) {
    const maxW = 42;
    const maxH = 21;
    const ratio = Math.min(maxW / prepSig2.width, maxH / prepSig2.height);
    const w = prepSig2.width * ratio;
    const h = prepSig2.height * ratio;
    doc.addImage(
      prepSig2.dataUrl,
      'PNG',
      rightSigCenterX - 20,
      sigBoxTopY + (sigBoxHeight - h) / 2,
      w,
      h
    );
  }

  if (prepStempel) {
    const scaleFactor = (settings.stempel_scale || 100) / 100;
    const baseMaxW = 34 * scaleFactor;
    const baseMaxH = 26 * scaleFactor;
    const ratio = Math.min(
      baseMaxW / prepStempel.width,
      baseMaxH / prepStempel.height
    );
    const sW = prepStempel.width * ratio;
    const sH = prepStempel.height * ratio;
    const offsetXMm = (settings.stempel_x || 0) * 0.25;
    const offsetYMm = (settings.stempel_y || 0) * 0.25;

    const target = settings.stempel_target || 'pihak_kedua';
    if (target === 'pihak_pertama' || target === 'both') {
      const x1 = Math.max(
        marginX,
        Math.min(pageWidth - marginX - sW, leftSigCenterX - 28 + offsetXMm)
      );
      const y1 = Math.max(
        10,
        Math.min(pageHeight - 25 - sH, sigBoxTopY - 1 + offsetYMm)
      );
      doc.addImage(prepStempel.dataUrl, 'PNG', x1, y1, sW, sH);
    }
    if (target === 'pihak_kedua' || target === 'both') {
      const x2 = Math.max(
        marginX,
        Math.min(pageWidth - marginX - sW, rightSigCenterX - 24 + offsetXMm)
      );
      const y2 = Math.max(
        10,
        Math.min(pageHeight - 25 - sH, sigBoxTopY - 1 + offsetYMm)
      );
      doc.addImage(prepStempel.dataUrl, 'PNG', x2, y2, sW, sH);
    }
  }

  cursorY = sigBoxTopY + sigBoxHeight + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const leftPrimaryName =
    bast.pihak_pertama_nama?.trim() || bast.pihak_pertama_pt?.trim() || '-';
  const rightPrimaryName = bast.pihak_kedua_nama?.trim() || '-';

  doc.text(leftPrimaryName.toUpperCase(), leftSigCenterX - 25, cursorY);
  doc.text(rightPrimaryName.toUpperCase(), rightSigCenterX - 20, cursorY);

  cursorY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  const leftSub =
    bast.pihak_pertama_jabatan?.trim() || bast.pihak_pertama_pt?.trim() || '';
  const rightSub = bast.pihak_kedua_jabatan?.trim() || '';

  if (leftSub) {
    doc.text(leftSub, leftSigCenterX - 25, cursorY);
  }
  if (rightSub) {
    doc.text(rightSub, rightSigCenterX - 20, cursorY);
  }

  return doc;
}

export function getBastPdfFilename(bast: BastDocument): string {
  const safeNo = (bast.nomor_bast || 'BAST')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
  const safePt = (bast.pihak_pertama_pt || 'Perusahaan')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 35);
  return `${safeNo}_${safePt}.pdf`;
}

export async function downloadBastPdf(
  bast: BastDocument,
  items: BastItem[],
  settings: AppSettings
): Promise<void> {
  const doc = await generateBastPdfDocument(bast, items, settings);
  doc.save(getBastPdfFilename(bast));
}

export async function shareBastPdf(
  bast: BastDocument,
  items: BastItem[],
  settings: AppSettings
): Promise<'shared' | 'downloaded'> {
  const doc = await generateBastPdfDocument(bast, items, settings);
  const filename = getBastPdfFilename(bast);
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (
    typeof navigator !== 'undefined' &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({
      title: `BAST - ${bast.nomor_bast}`,
      text: `Berita Acara Serah Terima (${bast.nomor_bast}) - ${bast.pihak_pertama_pt}`,
      files: [file],
    });
    return 'shared';
  }

  doc.save(filename);
  return 'downloaded';
}

// ============================================================================
// REKAP BAST KESELURUHAN & RINCIAN BARANG / JASA (PDF REPORT GENERATOR)
// ============================================================================

export interface RekapPdfOptions {
  title?: string;
  subtitle?: string;
  periodeLabel?: string;
  includeItemDetails?: boolean;
}

/**
 * Generates an executive multi-page formal PDF report containing:
 * 1. Official Kop Surat with company emblem/logo and details
 * 2. Executive summary / KPI metrics of all BASTs
 * 3. Master table of all BAST documents (Nomor BAST, Tanggal, Klien/PT, Pejabat, PO, Status)
 * 4. Detailed itemized breakdown of every line item (Rincian Barang & Jasa) per BAST
 * 5. Official sign-off block with signature and stamp
 */
export async function generateRekapBastPdfDocument(
  bastDocs: BastDocument[],
  allItems: BastItem[],
  settings: AppSettings,
  options: RekapPdfOptions = {}
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 18;
  const contentWidth = pageWidth - marginX * 2; // 174mm

  let cursorY = 12;

  // ---------------------------------------------------------------------------
  // 1. KOP SURAT RESMI (SESUAI GAMBAR REFERENSI PERUSAHAAN)
  // ---------------------------------------------------------------------------
  const companyName =
    settings.nama_perusahaan?.trim() || 'CV.MULIA TEKHNIK ABADI';
  const companyAddress =
    settings.alamat?.trim() ||
    'Jl. Letda Nasir No.58 Desa Cikeas Udik Kecamatan Gunung Putri Kab. Bogor Kode Pos 16966';
  const companyEmail = settings.email?.trim();
  const companyPhone = settings.telepon?.trim();

  const logoSrc =
    settings.logo?.trim() || getCorporateEmblemDataUrl(companyName);
  const preparedLogo = await prepareImageForPdf(logoSrc);

  const headerCenterX = pageWidth / 2 + 10;
  const maxTextWidth = 140;

  // Header 1 (Extra bold font simulation)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(59, 110, 140);
  const upperCompanyName = companyName.toUpperCase();
  const titleY = cursorY + 6;
  doc.text(upperCompanyName, headerCenterX, titleY, { align: 'center' });
  doc.text(upperCompanyName, headerCenterX + 0.2, titleY, { align: 'center' });
  doc.text(upperCompanyName, headerCenterX - 0.2, titleY, { align: 'center' });

  // Address
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const rawBalancedLines = formatKopAddressLines(companyAddress);
  let headerLineY = titleY + 5.5;

  for (const rawLine of rawBalancedLines) {
    const wrapped = doc.splitTextToSize(rawLine, maxTextWidth);
    for (const subLine of wrapped) {
      doc.text(subLine, headerCenterX, headerLineY, { align: 'center' });
      headerLineY += 4.2;
    }
  }

  // Email line
  if (companyEmail) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const prefixStr = 'email. ';
    const fullEmailLine = `${prefixStr}${companyEmail}`;
    const fullW = doc.getTextWidth(fullEmailLine);
    const prefixW = doc.getTextWidth(prefixStr);
    const startX = headerCenterX - fullW / 2;

    doc.setTextColor(60, 72, 88);
    doc.text(prefixStr, startX, headerLineY);
    doc.setTextColor(59, 110, 140);
    doc.text(companyEmail, startX + prefixW, headerLineY);

    doc.setDrawColor(59, 110, 140);
    doc.setLineWidth(0.3);
    doc.line(
      startX + prefixW,
      headerLineY + 0.7,
      startX + fullW,
      headerLineY + 0.7
    );
    headerLineY += 4.2;
  }

  // Phone line
  if (companyPhone) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Tlp ${companyPhone}`, headerCenterX, headerLineY, {
      align: 'center',
    });
    headerLineY += 4.0;
  }

  // Logo draw
  let drawLogoW = 0;
  let drawLogoH = 0;
  if (preparedLogo) {
    const logoScale = Math.max(
      0.4,
      Math.min(2.0, (settings.logo_scale || 100) / 100)
    );
    const baseMaxW = 42 * logoScale;
    const baseMaxH = 17 * logoScale;
    const ratio = Math.min(
      baseMaxW / preparedLogo.width,
      baseMaxH / preparedLogo.height
    );
    drawLogoW = preparedLogo.width * ratio;
    drawLogoH = preparedLogo.height * ratio;
  }

  const lineY = Math.max(
    cursorY + 26,
    headerLineY + 1.5,
    cursorY + drawLogoH + 3
  );

  if (preparedLogo && drawLogoW > 0 && drawLogoH > 0) {
    const offsetXmm = (settings.logo_x || 0) * 0.265;
    const offsetYmm = (settings.logo_y || 0) * 0.265;
    const logoX = Math.max(
      2,
      Math.min(pageWidth - drawLogoW - 2, marginX + offsetXmm)
    );
    const logoY = Math.max(2, lineY - drawLogoH - 2.2 + offsetYmm);
    doc.addImage(
      preparedLogo.dataUrl,
      'PNG',
      logoX,
      logoY,
      drawLogoW,
      drawLogoH
    );
  }

  cursorY = lineY;

  // Garis Kop
  doc.setDrawColor(65, 75, 88);
  doc.setLineWidth(0.25);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
  doc.setLineWidth(0.75);
  doc.line(marginX, cursorY + 0.85, pageWidth - marginX, cursorY + 0.85);
  doc.setLineWidth(0.25);
  doc.line(marginX, cursorY + 1.7, pageWidth - marginX, cursorY + 1.7);

  cursorY += 7.5;

  // ---------------------------------------------------------------------------
  // 2. REPORT TITLE & EXECUTIVE METADATA
  // ---------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  const mainTitle =
    options.title || 'REKAPITULASI DOKUMEN BERITA ACARA SERAH TERIMA (BAST)';
  doc.text(mainTitle, pageWidth / 2, cursorY, { align: 'center' });

  const titleW = doc.getTextWidth(mainTitle);
  doc.setDrawColor(59, 110, 140);
  doc.setLineWidth(0.5);
  doc.line(
    pageWidth / 2 - titleW / 2,
    cursorY + 1.0,
    pageWidth / 2 + titleW / 2,
    cursorY + 1.0
  );

  cursorY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  const subTitle =
    options.subtitle ||
    'Laporan Rekapitulasi Keseluruhan BAST Beserta Rincian Barang & Jasa';
  doc.text(subTitle, pageWidth / 2, cursorY, { align: 'center' });

  cursorY += 6.5;

  // Metrics Bar / Summary Bento
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const selesaiCount = bastDocs.filter((d) => d.status === 'Selesai').length;
  const draftCount = bastDocs.filter((d) => d.status === 'Draft').length;

  const totalItemsCount = allItems.filter((it) =>
    bastDocs.some((d) => d.id === it.bast_id)
  ).length;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, cursorY, contentWidth, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Cakupan: ${options.periodeLabel || 'Semua Dokumen'}`,
    marginX + 4,
    cursorY + 5.5
  );
  doc.text(
    `Total BAST: ${bastDocs.length} Dokumen (${selesaiCount} Selesai, ${draftCount} Draft)`,
    marginX + 4,
    cursorY + 10.5
  );

  doc.setFont('helvetica', 'normal');
  doc.text(
    `Total Rincian Item: ${totalItemsCount} Baris`,
    pageWidth - marginX - 4,
    cursorY + 5.5,
    { align: 'right' }
  );
  doc.text(
    `Tanggal Cetak: ${formatTanggalIndonesia(todayIso)}`,
    pageWidth - marginX - 4,
    cursorY + 10.5,
    { align: 'right' }
  );

  cursorY += 19;

  // ---------------------------------------------------------------------------
  // 3. TABEL 1: MASTER LIST OF BAST DOCUMENTS
  // ---------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('I. DAFTAR DOKUMEN BAST', marginX, cursorY);
  cursorY += 2;

  const masterTableRows = bastDocs.map((bast, index) => [
    String(index + 1),
    bast.nomor_bast || '-',
    formatTanggalIndonesia(bast.tanggal_bast),
    bast.pihak_pertama_pt || '-',
    bast.pihak_pertama_nama || '-',
    bast.nomor_po || '-',
    bast.status || 'Draft',
  ]);

  autoTable(doc, {
    startY: cursorY + 1.5,
    margin: { left: marginX, right: marginX },
    head: [
      [
        'NO',
        'NOMOR BAST',
        'TANGGAL',
        'PIHAK PERTAMA (KLIEN)',
        'PEJABAT',
        'NOMOR PO',
        'STATUS',
      ],
    ],
    body: masterTableRows.length > 0 ? masterTableRows : [['-', 'Belum ada dokumen BAST', '-', '-', '-', '-', '-']],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.25,
      cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [59, 110, 140], // Brand Steel Blue
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      minCellHeight: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 38, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 26, halign: 'center' },
      3: { cellWidth: 44, halign: 'left' },
      4: { cellWidth: 28, halign: 'left' },
      5: { cellWidth: 26, halign: 'center' },
      6: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        if (data.cell.raw === 'Selesai') {
          data.cell.styles.textColor = [16, 122, 60];
        } else if (data.cell.raw === 'Draft') {
          data.cell.styles.textColor = [194, 98, 10];
        }
      }
    },
  });

  const masterTableFinalY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY || cursorY + 40;
  cursorY = masterTableFinalY + 10;

  // ---------------------------------------------------------------------------
  // 4. TABEL 2 / SEKSI: RINCIAN BARANG & JASA LENGKAP TIAP BAST
  // ---------------------------------------------------------------------------
  const includeDetails = options.includeItemDetails !== false;

  if (includeDetails && bastDocs.length > 0) {
    // If not enough room for section header, start on a fresh page
    if (cursorY + 30 > pageHeight - 20) {
      doc.addPage();
      cursorY = 18;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('II. RINCIAN BARANG & JASA LENGKAP TIAP BAST', marginX, cursorY);
    cursorY += 5;

    // Map items by BAST ID
    const itemsByBast = new Map<string, BastItem[]>();
    for (const item of allItems) {
      const bId = item.bast_id;
      if (!itemsByBast.has(bId)) {
        itemsByBast.set(bId, []);
      }
      itemsByBast.get(bId)!.push(item);
    }

    for (let bIdx = 0; bIdx < bastDocs.length; bIdx++) {
      const bast = bastDocs[bIdx];
      const bastItemsList = (itemsByBast.get(bast.id) || []).sort(
        (a, b) => a.urutan - b.urutan || a.nomor - b.nomor
      );

      // Check space for BAST box header + table
      if (cursorY + 32 > pageHeight - 20) {
        doc.addPage();
        cursorY = 18;
      }

      // Small card header for this BAST
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(marginX, cursorY, contentWidth, 10, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `#${bIdx + 1}. BAST: ${bast.nomor_bast} — ${bast.pihak_pertama_pt}`,
        marginX + 3,
        cursorY + 4.2
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const detailSubtitle = `Tgl: ${formatTanggalIndonesia(
        bast.tanggal_bast
      )}  |  PO: ${bast.nomor_po || '-'}  |  Status: ${bast.status}  |  Pelaksana: ${
        bast.pihak_kedua_nama || '-'
      }`;
      doc.text(detailSubtitle, marginX + 3, cursorY + 8.2);

      if (bast.deskripsi_pekerjaan) {
        doc.setFont('helvetica', 'italic');
        doc.text(
          `Pekerjaan: ${bast.deskripsi_pekerjaan.slice(0, 75)}`,
          pageWidth - marginX - 3,
          cursorY + 6,
          { align: 'right' }
        );
      }

      cursorY += 11.5;

      const itemRows =
        bastItemsList.length > 0
          ? bastItemsList.map((it, idx) => [
              String(idx + 1),
              it.nama_barang_jasa || '-',
              it.keterangan || 'Sesuai',
            ])
          : [['-', 'Tidak ada rincian barang/jasa tercatat', '-']];

      autoTable(doc, {
        startY: cursorY,
        margin: { left: marginX + 4, right: marginX + 4 },
        head: [['NO', 'NAMA BARANG / JASA & PEKERJAAN', 'KETERANGAN']],
        body: itemRows,
        theme: 'plain',
        styles: {
          font: 'helvetica',
          fontSize: 7.5,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
          cellPadding: { top: 1.8, right: 2, bottom: 1.8, left: 2 },
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [226, 232, 240],
          textColor: [51, 65, 85],
          fontStyle: 'bold',
          halign: 'center',
          minCellHeight: 6,
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 120, halign: 'left' },
          2: { cellWidth: 36, halign: 'center', fontStyle: 'italic' },
        },
      });

      const itemsFinalY =
        (doc as unknown as { lastAutoTable?: { finalY?: number } })
          .lastAutoTable?.finalY || cursorY + 20;
      cursorY = itemsFinalY + 6;
    }
  }

  // ---------------------------------------------------------------------------
  // 5. OFFICIAL SIGN-OFF BLOCK ON FINAL PAGE
  // ---------------------------------------------------------------------------
  const requiredSigBlockHeight = 48;
  if (cursorY + requiredSigBlockHeight > pageHeight - 16) {
    doc.addPage();
    cursorY = 20;
  }

  cursorY += 4;
  const kotaText = settings.kota?.trim() || 'Bogor';
  const sigX = pageWidth - marginX - 35;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${kotaText}, ${formatTanggalIndonesia(todayIso)}`, sigX, cursorY, {
    align: 'center',
  });
  cursorY += 4.5;
  doc.text('Mengetahui / Penanggung Jawab', sigX, cursorY, {
    align: 'center',
  });
  cursorY += 4.0;
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, sigX, cursorY, { align: 'center' });

  // Signature image & stamp if available
  const sigSrc = settings.signature_party_2 || settings.signature_party_1;
  const stempelSrc = settings.stempel;
  const [prepSig, prepStempel] = await Promise.all([
    prepareImageForPdf(sigSrc),
    prepareImageForPdf(stempelSrc),
  ]);

  const sigBoxTopY = cursorY + 1.5;
  const sigBoxHeight = 18;

  if (prepSig) {
    const maxW = 36;
    const maxH = 16;
    const ratio = Math.min(maxW / prepSig.width, maxH / prepSig.height);
    const w = prepSig.width * ratio;
    const h = prepSig.height * ratio;
    doc.addImage(
      prepSig.dataUrl,
      'PNG',
      sigX - w / 2,
      sigBoxTopY + (sigBoxHeight - h) / 2,
      w,
      h
    );
  }

  if (prepStempel) {
    const maxW = 28;
    const maxH = 18;
    const ratio = Math.min(maxW / prepStempel.width, maxH / prepStempel.height);
    const w = prepStempel.width * ratio;
    const h = prepStempel.height * ratio;
    doc.addImage(
      prepStempel.dataUrl,
      'PNG',
      sigX - w / 2 + 8,
      sigBoxTopY + (sigBoxHeight - h) / 2 - 1,
      w,
      h
    );
  }

  cursorY += sigBoxHeight + 3;
  const signerName =
    settings.default_pihak_kedua_nama?.trim() ||
    settings.nama_perusahaan ||
    'Pimpinan Perusahaan';
  doc.setFont('helvetica', 'bold');
  doc.text(`( ${signerName} )`, sigX, cursorY, { align: 'center' });

  // ---------------------------------------------------------------------------
  // 6. PAGE NUMBERS & OFFICIAL FOOTER ON ALL PAGES
  // ---------------------------------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    // Bottom horizontal rule
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 10, pageWidth - marginX, pageHeight - 10);

    doc.text(
      `${companyName} · Rekapitulasi Berita Acara Serah Terima (BAST)`,
      marginX,
      pageHeight - 6.5
    );
    doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth - marginX, pageHeight - 6.5, {
      align: 'right',
    });
  }

  return doc;
}

/**
 * Convenience helper to download the Rekap BAST PDF directly with automatic filename
 */
export async function downloadRekapBastPdf(
  bastDocs: BastDocument[],
  allItems: BastItem[],
  settings: AppSettings,
  options: RekapPdfOptions = {}
): Promise<void> {
  const doc = await generateRekapBastPdfDocument(
    bastDocs,
    allItems,
    settings,
    options
  );
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const filename = `Rekap_BAST_Keseluruhan_${dateStr}.pdf`;
  doc.save(filename);
}

