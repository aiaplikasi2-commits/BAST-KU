/**
 * Generates a high-resolution corporate swoosh emblem SVG Data URL (matching the MTA logo
 * in gambar.png, flush-left with zero left margin so it sits fixed at the left edge of the Kop line)
 * and provides smart Kop Surat address line balancing matching the official letterhead.
 */

export function extractCompanyInitials(companyName: string): string {
  const cleaned = (companyName || 'CV. MULIA TEKHNIK ABADI')
    .replace(/^(PT\.?|CV\.?|UD\.?|PD\.?|YAYASAN)\s*/i, '')
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
  // Tight left-aligned viewBox (x=0 is the exact left tip of the crescent swoosh)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="330" height="115" viewBox="0 0 330 115" fill="none">
    <!-- Outer Crescent Swoosh anchored flush left at x=0 -->
    <path d="M 155 6 C 64 8, 0 31, 0 58 C 0 85, 64 108, 155 110 C 92 103, 46 83, 46 58 C 46 33, 92 13, 155 6 Z" fill="#466F8D" />
    <!-- Subtle Top-Right Rim Arc -->
    <path d="M 110 10 C 195 7, 268 23, 286 46 C 262 26, 194 13, 110 10 Z" fill="#466F8D" opacity="0.75" />
    <!-- 3D Extruded Shadow Layer for Initials -->
    <text x="179" y="80" text-anchor="middle" fill="none" stroke="#365873" stroke-width="2.5" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="64" letter-spacing="6" transform="scale(1.08, 0.92)">${initials}</text>
    <!-- Primary Corporate Initials -->
    <text x="174" y="77" text-anchor="middle" fill="#466F8D" stroke="#2C4C66" stroke-width="1.2" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="64" letter-spacing="6" transform="scale(1.08, 0.92)">${initials}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Splits a company address into neat, balanced lines for the Kop Surat
 * matching gambar.png:
 * Line 1: Jl. Letda Nasir No.58 Desa Cikeas Udik
 * Line 2: Kecamatan Gunung Putri Kab. Bogor Kode Pos 16966
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

  // Match split right before "Kecamatan" / "Kec." (exact match to gambar.png)
  const kecMatch = addr.match(/^(.*?)\s+((?:Kecamatan|Kec\.)\s+.*)$/i);
  if (kecMatch && kecMatch[1].length >= 15 && kecMatch[2].length >= 15) {
    return [kecMatch[1].trim(), kecMatch[2].trim()];
  }

  // Fallback pattern match for Kab./Kota split
  const kabMatch = addr.match(/^(.*?)\s+((?:Kab\.|Kabupaten|Kota)\s+.*)$/i);
  if (kabMatch && kabMatch[1].length >= 20 && kabMatch[2].length >= 12) {
    return [kabMatch[1].trim(), kabMatch[2].trim()];
  }

  // If short enough for 1 line, keep on 1 line
  if (addr.length <= 48) {
    return [addr];
  }

  // Otherwise split near 45-50% so top line is slightly shorter than second line (pyramid balance)
  const words = addr.split(/\s+/);
  const targetLen = Math.round(addr.length * 0.46);
  const line1Words: string[] = [];
  const line2Words: string[] = [];
  let currentLen = 0;

  for (const w of words) {
    if (currentLen + w.length <= targetLen || line1Words.length < 3) {
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
