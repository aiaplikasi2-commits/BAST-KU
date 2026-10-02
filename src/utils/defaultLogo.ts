/**
 * Generates a high-resolution corporate swoosh emblem SVG Data URL (like the MTA logo)
 * when the user has not uploaded a custom logo image yet, and provides smart
 * Kop Surat address line balancing so addresses never wrap with awkward orphan words.
 */

export function extractCompanyInitials(companyName: string): string {
  const cleaned = (companyName || 'CV. MULIA TEKHNIK ABADI')
    .replace(/^(PT\.?|CV\.?|UD\.?|PD\.?|YAYASAN)\s+/i, '')
    .trim();

  if (!cleaned) return 'MTA';

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }
  return words
    .slice(0, 4)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function getCorporateEmblemDataUrl(companyName: string): string {
  const initials = extractCompanyInitials(companyName);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="170" viewBox="0 0 360 170" fill="none">
    <!-- Outer Crescent Swoosh -->
    <path d="M 320 85 C 320 34, 240 8, 145 8 C 52 8, 8 42, 8 85 C 8 128, 52 162, 145 162 C 240 162, 320 136, 320 85 Z" fill="#46698A" />
    <!-- Inner White Cutout creating the thick left crescent and thin right rim -->
    <path d="M 314 85 C 314 40, 246 16, 168 16 C 92 16, 48 45, 48 85 C 48 125, 92 154, 168 154 C 246 154, 314 130, 314 85 Z" fill="#FFFFFF" />
    <!-- Secondary Inner Accent Arc -->
    <path d="M 165 23 C 102 25, 62 50, 62 85 C 62 120, 102 145, 165 147 C 114 140, 80 116, 80 85 C 80 54, 114 30, 165 23 Z" fill="#46698A" opacity="0.92" />
    <!-- Corporate Initials -->
    <text x="192" y="106" text-anchor="middle" fill="#3B5D7C" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="64" letter-spacing="3">${initials}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Splits a company address into neat, balanced lines for the Kop Surat
 * so that postal codes or short trailing words never hang alone on a new line.
 */
export function formatKopAddressLines(rawAddress: string): string[] {
  const addr = (
    rawAddress ||
    'Jl. Letda Nasir No.58 Desa Cikeas Udik Kecamatan Gunung Putri Kab. Bogor Kode Pos 16966'
  ).trim();

  if (!addr) return [];

  // Respect explicit line breaks if the user typed them
  if (addr.includes('\n')) {
    return addr
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Exact match or pattern match for Kab./Kota split (like "Kab. Bogor Kode Pos 16966")
  const kabMatch = addr.match(/^(.*?)\s+((?:Kab\.|Kabupaten|Kota)\s+.*)$/i);
  if (kabMatch && kabMatch[1].length >= 25 && kabMatch[2].length >= 12) {
    return [kabMatch[1].trim(), kabMatch[2].trim()];
  }

  // If short enough for 1 line, keep on 1 line
  if (addr.length <= 58) {
    return [addr];
  }

  // Otherwise split cleanly near 58-65% of the string at a word boundary
  const words = addr.split(/\s+/);
  const targetLen = Math.round(addr.length * 0.62);
  const line1Words: string[] = [];
  const line2Words: string[] = [];
  let currentLen = 0;

  for (const w of words) {
    if (
      currentLen + w.length <= targetLen ||
      line1Words.length < 3
    ) {
      line1Words.push(w);
      currentLen += w.length + 1;
    } else {
      line2Words.push(w);
    }
  }

  if (line2Words.length === 0) {
    return [line1Words.join(' ')];
  }

  return [line1Words.join(' '), line2Words.join(' ')];
}
