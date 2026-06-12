/**
 * Tiny formatting helpers shared by templates. No deps.
 */

export function formatINR(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format an amount in any ISO currency (₹, $, €, …) with 2 decimals. */
export function formatMoney(
  value: number | undefined | null,
  currency = 'INR',
): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatINRWords(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return '';
  // Lakh / Crore style for amounts. Conservative; no AI involvement.
  const units = ['', 'Thousand', 'Lakh', 'Crore'];
  const partsFromRight: string[] = [];
  let n = Math.floor(value);
  if (n === 0) return 'Zero';
  let unitIdx = 0;
  while (n > 0 && unitIdx < units.length) {
    const chunk = unitIdx === 0 ? n % 1000 : n % 100;
    partsFromRight.push(`${chunk} ${units[unitIdx]}`.trim());
    n = unitIdx === 0 ? Math.floor(n / 1000) : Math.floor(n / 100);
    unitIdx += 1;
  }
  return partsFromRight.reverse().join(' ').replace(/\s+/g, ' ').trim();
}

export function formatDateLong(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function partyDisplay(
  name?: string,
  parentName?: string,
  relation?: string,
): string {
  if (!name) return '—';
  if (parentName && relation) return `${name}, ${relation} ${parentName}`;
  return name;
}
