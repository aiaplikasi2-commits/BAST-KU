import * as XLSX from 'xlsx';
import { Company } from '../types';
import { showQuickPopup } from './quickPopup';

export const COMPANY_EXCEL_HEADERS: string[] = [
  'No Urut',
  'Nama PT / Perusahaan *',
  'Nama Pejabat *',
  'Jabatan Pejabat',
  'Alamat Lengkap',
  'Kota / Kabupaten',
  'Kode Pos',
  'Telepon',
  'Email',
];

export const COMPANY_EXCEL_COL_WIDTHS = [
  { wch: 10 }, // No Urut
  { wch: 36 }, // Nama PT / Perusahaan *
  { wch: 24 }, // Nama Pejabat *
  { wch: 24 }, // Jabatan Pejabat
  { wch: 48 }, // Alamat Lengkap
  { wch: 22 }, // Kota / Kabupaten
  { wch: 14 }, // Kode Pos
  { wch: 20 }, // Telepon
  { wch: 30 }, // Email
];

/**
 * Downloads official 9-column Excel Template for Data Perusahaan
 */
export function downloadCompanyExcelTemplate(): void {
  const sampleRows = [
    [
      1,
      'PT. KANSAI PAINT INDONESIA',
      'MUHAMAD RIDHO',
      'General Manager',
      'Blok DD-7 & DD-6 Kawasan Industri MM2100 Cikarang Barat',
      'Kab. Bekasi',
      '17847',
      '021-8980001',
      'info@kansaipaint.co.id',
    ],
    [
      2,
      'PT. ASTRA HONDA MOTOR',
      'BUDI SANTOSO',
      'Manager Operasional',
      'Jl. Laksda Yos Sudarso, Sunter I',
      'Jakarta Utara',
      '14350',
      '021-6518080',
      'procurement@ahm.co.id',
    ],
    [
      3,
      'CV. MULIA TEKHNIK ABADI',
      'ACHMAD HIDAYAT',
      'Direktur Utama',
      'Jln. Letda Nasir No. 58 Kel. Cikeas Udik Kec. Gunung Putri',
      'Bogor',
      '16966',
      '0812-3456-7890',
      'muliatekhnik@gmail.com',
    ],
    [
      4,
      'PT. TOYOTA MOTOR MANUFACTURING INDONESIA',
      'HENDRA WIJAYA',
      'Facility Maintenance Head',
      'Kawasan Industri KIIC Lot DD 1, Karawang Barat',
      'Karawang',
      '41361',
      '0267-644888',
      'maintenance@toyota.co.id',
    ],
    [
      5,
      'PT. INDOFOOD CBP SUKSES MAKMUR TBK',
      'DEDI KURNIAWAN',
      'Procurement Specialist',
      'Jl. Raya Cibitung KM. 48.5 Kawasan Industri',
      'Bekasi',
      '17520',
      '021-8832000',
      'dedi.kurniawan@icbp.indofood.co.id',
    ],
  ];

  const data = [COMPANY_EXCEL_HEADERS, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = COMPANY_EXCEL_COL_WIDTHS;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Perusahaan');
  XLSX.writeFile(wb, 'Template_Lengkap_Data_Perusahaan_BAST.xlsx');
  showQuickPopup('Template Excel Lengkap 9 Kolom berhasil diunduh!', 'success');
}

/**
 * Exports current companies to Excel matching the exact 9-column format
 */
export function exportCompaniesToExcel(companies: Company[]): void {
  if (companies.length === 0) {
    showQuickPopup('Belum ada data perusahaan untuk diexport.', 'info');
    return;
  }

  const sorted = [...companies].sort(
    (a, b) => a.no - b.no || a.nama_pt.localeCompare(b.nama_pt)
  );

  const rows = sorted.map((c, idx) => [
    c.no || idx + 1,
    c.nama_pt,
    c.nama_pejabat,
    c.jabatan_pejabat || '',
    c.alamat || '',
    c.kota || '',
    c.kode_pos || '',
    c.telepon || '',
    c.email || '',
  ]);

  const data = [COMPANY_EXCEL_HEADERS, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = COMPANY_EXCEL_COL_WIDTHS;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Daftar Perusahaan');
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Data_Perusahaan_Lengkap_${dateStr}.xlsx`);
  showQuickPopup(`${companies.length} data perusahaan berhasil diexport ke Excel!`, 'success');
}
