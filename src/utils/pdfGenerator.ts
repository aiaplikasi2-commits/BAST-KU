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
        const w = (img.naturalWidth || img.width || 360) * 2;
        const h = (img.naturalHeight || img.height || 170) * 2;
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
 * Styled after the corporate BAST reference (CV. MULIA TEKHNIK ABADI) with:
 * - Official Kop Surat (Logo + Balanced Company Identity + Double Horizontal Line)
 * - Centered bold underlined title "BERITA ACARA SERAH TERIMA" + Nomor BAST
 * - Opening paragraph with automatic Indonesian Terbilang date
 * - Aligned Pihak Pertama & Pihak Kedua blocks
 * - PO statement & bordered AutoTable with repeating headers across pages
 * - Closing completion & handover statements
 * - Dual Signature blocks + configurable Stamp (Stempel) placement
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
  // 1. HEADER / KOP SURAT (RAPIH & PROFESIONAL)
  // ---------------------------------------------------------------------------
  const companyName =
    settings.nama_perusahaan?.trim() || 'CV. MULIA TEKHNIK ABADI';
  const companyAddress =
    settings.alamat?.trim() ||
    'Jl. Letda Nasir No.58 Desa Cikeas Udik Kecamatan Gunung Putri Kab. Bogor Kode Pos 16966';
  const companyEmail = settings.email?.trim();
  const companyPhone = settings.telepon?.trim();

  const logoSrc =
    settings.logo?.trim() || getCorporateEmblemDataUrl(companyName);
  const preparedLogo = await prepareImageForPdf(logoSrc);

  // Left Logo Box (width: 38mm, vertically centered with Kop text block)
  const logoBoxWidth = 38;
  const logoBoxHeight = 23;
  if (preparedLogo) {
    const ratio = Math.min(
      logoBoxWidth / preparedLogo.width,
      logoBoxHeight / preparedLogo.height
    );
    const drawW = preparedLogo.width * ratio;
    const drawH = preparedLogo.height * ratio;
    doc.addImage(
      preparedLogo.dataUrl,
      'PNG',
      marginX + (logoBoxWidth - drawW) / 2,
      cursorY + (logoBoxHeight - drawH) / 2 + 0.5,
      drawW,
      drawH
    );
  }

  // Right/Center Kop Text Column (x = 60mm to 190mm -> center at 125mm)
  const textAreaLeft = marginX + logoBoxWidth + 3; // 61mm
  const textAreaWidth = pageWidth - marginX - textAreaLeft; // 129mm
  const headerCenterX = textAreaLeft + textAreaWidth / 2; // 125.5mm

  // Company Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15.5);
  doc.setTextColor(43, 79, 113); // Corporate Steel Navy (#2B4F71)
  doc.text(companyName.toUpperCase(), headerCenterX, cursorY + 5.2, {
    align: 'center',
  });

  // Balanced Address Lines
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const rawBalancedLines = formatKopAddressLines(companyAddress);
  let headerLineY = cursorY + 10.4;

  for (const rawLine of rawBalancedLines) {
    const wrapped = doc.splitTextToSize(rawLine, textAreaWidth - 2);
    for (const subLine of wrapped) {
      doc.text(subLine, headerCenterX, headerLineY, { align: 'center' });
      headerLineY += 4.3;
    }
  }

  // Email Line with underlined email address
  if (companyEmail) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const prefixStr = 'email. ';
    const fullEmailLine = `${prefixStr}${companyEmail}`;
    const fullW = doc.getTextWidth(fullEmailLine);
    const prefixW = doc.getTextWidth(prefixStr);
    const startX = headerCenterX - fullW / 2;

    doc.setTextColor(43, 79, 113);
    doc.text(prefixStr, startX, headerLineY);
    doc.text(companyEmail, startX + prefixW, headerLineY);

    // Draw underline specifically beneath the email address
    doc.setDrawColor(43, 79, 113);
    doc.setLineWidth(0.28);
    doc.line(
      startX + prefixW,
      headerLineY + 0.7,
      startX + fullW,
      headerLineY + 0.7
    );
    headerLineY += 4.4;
  }

  // Phone Line
  if (companyPhone) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Tlp ${companyPhone}`, headerCenterX, headerLineY, {
      align: 'center',
    });
    headerLineY += 4.2;
  }

  cursorY = Math.max(cursorY + 25, headerLineY + 1.5);

  // Double Horizontal Line (Garis Kop Surat Resmi)
  doc.setDrawColor(45, 55, 72);
  doc.setLineWidth(0.85);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
  doc.setLineWidth(0.3);
  doc.line(marginX, cursorY + 1.2, pageWidth - marginX, cursorY + 1.2);

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
