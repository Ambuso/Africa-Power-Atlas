/* ==================== lib/countries.ts ====================
 * Single source of truth for country code reconciliation.
 *
 * Africa uses multiple country identifiers across datasets:
 *   - ISO 3166-1 alpha-2:  "ZA", "NG", "EG"     (UI, emoji flags)
 *   - ISO 3166-1 alpha-3:  "ZAF", "NGA", "EGY"  (most GeoJSON sources)
 *   - Short name:          "South Africa", "Nigeria", "Egypt"
 *   - Long name variants:  "Congo, Dem. Rep. of" vs "DR Congo"
 *
 * `matchesCountry(feature, selectedISO2[])` handles the cross-walk
 * so the UI (which emits ISO2) can filter any dataset.
 * ==================================================== */

export interface CountryRef {
  iso2: string;
  iso3: string;
  name: string;
  flag: string;
  region: 'North' | 'West' | 'East' | 'Central' | 'Southern';
  aliases?: string[];
}

export const AFRICAN_COUNTRIES: CountryRef[] = [
  { iso2: 'DZ', iso3: 'DZA', name: 'Algeria',          flag: '🇩🇿', region: 'North' },
  { iso2: 'AO', iso3: 'AGO', name: 'Angola',           flag: '🇦🇴', region: 'Central' },
  { iso2: 'BJ', iso3: 'BEN', name: 'Benin',            flag: '🇧🇯', region: 'West' },
  { iso2: 'BW', iso3: 'BWA', name: 'Botswana',         flag: '🇧🇼', region: 'Southern' },
  { iso2: 'BF', iso3: 'BFA', name: 'Burkina Faso',     flag: '🇧🇫', region: 'West' },
  { iso2: 'BI', iso3: 'BDI', name: 'Burundi',          flag: '🇧🇮', region: 'East' },
  { iso2: 'CV', iso3: 'CPV', name: 'Cabo Verde',       flag: '🇨🇻', region: 'West', aliases: ['Cape Verde'] },
  { iso2: 'CM', iso3: 'CMR', name: 'Cameroon',         flag: '🇨🇲', region: 'Central' },
  { iso2: 'CF', iso3: 'CAF', name: 'Central African Republic', flag: '🇨🇫', region: 'Central', aliases: ['CAR'] },
  { iso2: 'TD', iso3: 'TCD', name: 'Chad',             flag: '🇹🇩', region: 'Central' },
  { iso2: 'KM', iso3: 'COM', name: 'Comoros',          flag: '🇰🇲', region: 'East' },
  { iso2: 'CG', iso3: 'COG', name: 'Congo',            flag: '🇨🇬', region: 'Central', aliases: ['Republic of the Congo', 'Congo-Brazzaville'] },
  { iso2: 'CD', iso3: 'COD', name: 'DR Congo',         flag: '🇨🇩', region: 'Central', aliases: ['Democratic Republic of the Congo', 'DRC', 'Congo, Dem. Rep.', 'Congo-Kinshasa', 'Congo (Kinshasa)'] },
  { iso2: 'CI', iso3: 'CIV', name: "Côte d'Ivoire",    flag: '🇨🇮', region: 'West', aliases: ['Ivory Coast'] },
  { iso2: 'DJ', iso3: 'DJI', name: 'Djibouti',         flag: '🇩🇯', region: 'East' },
  { iso2: 'EG', iso3: 'EGY', name: 'Egypt',            flag: '🇪🇬', region: 'North' },
  { iso2: 'GQ', iso3: 'GNQ', name: 'Equatorial Guinea',flag: '🇬🇶', region: 'Central' },
  { iso2: 'ER', iso3: 'ERI', name: 'Eritrea',          flag: '🇪🇷', region: 'East' },
  { iso2: 'SZ', iso3: 'SWZ', name: 'Eswatini',         flag: '🇸🇿', region: 'Southern', aliases: ['Swaziland'] },
  { iso2: 'ET', iso3: 'ETH', name: 'Ethiopia',         flag: '🇪🇹', region: 'East' },
  { iso2: 'GA', iso3: 'GAB', name: 'Gabon',            flag: '🇬🇦', region: 'Central' },
  { iso2: 'GM', iso3: 'GMB', name: 'Gambia',           flag: '🇬🇲', region: 'West', aliases: ['The Gambia'] },
  { iso2: 'GH', iso3: 'GHA', name: 'Ghana',            flag: '🇬🇭', region: 'West' },
  { iso2: 'GN', iso3: 'GIN', name: 'Guinea',           flag: '🇬🇳', region: 'West' },
  { iso2: 'GW', iso3: 'GNB', name: 'Guinea-Bissau',    flag: '🇬🇼', region: 'West' },
  { iso2: 'KE', iso3: 'KEN', name: 'Kenya',            flag: '🇰🇪', region: 'East' },
  { iso2: 'LS', iso3: 'LSO', name: 'Lesotho',          flag: '🇱🇸', region: 'Southern' },
  { iso2: 'LR', iso3: 'LBR', name: 'Liberia',          flag: '🇱🇷', region: 'West' },
  { iso2: 'LY', iso3: 'LBY', name: 'Libya',            flag: '🇱🇾', region: 'North' },
  { iso2: 'MG', iso3: 'MDG', name: 'Madagascar',       flag: '🇲🇬', region: 'Southern' },
  { iso2: 'MW', iso3: 'MWI', name: 'Malawi',           flag: '🇲🇼', region: 'Southern' },
  { iso2: 'ML', iso3: 'MLI', name: 'Mali',             flag: '🇲🇱', region: 'West' },
  { iso2: 'MR', iso3: 'MRT', name: 'Mauritania',       flag: '🇲🇷', region: 'West' },
  { iso2: 'MU', iso3: 'MUS', name: 'Mauritius',        flag: '🇲🇺', region: 'East' },
  { iso2: 'MA', iso3: 'MAR', name: 'Morocco',          flag: '🇲🇦', region: 'North' },
  { iso2: 'MZ', iso3: 'MOZ', name: 'Mozambique',       flag: '🇲🇿', region: 'Southern' },
  { iso2: 'NA', iso3: 'NAM', name: 'Namibia',          flag: '🇳🇦', region: 'Southern' },
  { iso2: 'NE', iso3: 'NER', name: 'Niger',            flag: '🇳🇪', region: 'West' },
  { iso2: 'NG', iso3: 'NGA', name: 'Nigeria',          flag: '🇳🇬', region: 'West' },
  { iso2: 'RW', iso3: 'RWA', name: 'Rwanda',           flag: '🇷🇼', region: 'East' },
  { iso2: 'ST', iso3: 'STP', name: 'São Tomé and Príncipe', flag: '🇸🇹', region: 'Central', aliases: ['Sao Tome and Principe'] },
  { iso2: 'SN', iso3: 'SEN', name: 'Senegal',          flag: '🇸🇳', region: 'West' },
  { iso2: 'SC', iso3: 'SYC', name: 'Seychelles',       flag: '🇸🇨', region: 'East' },
  { iso2: 'SL', iso3: 'SLE', name: 'Sierra Leone',     flag: '🇸🇱', region: 'West' },
  { iso2: 'SO', iso3: 'SOM', name: 'Somalia',          flag: '🇸🇴', region: 'East' },
  { iso2: 'ZA', iso3: 'ZAF', name: 'South Africa',     flag: '🇿🇦', region: 'Southern' },
  { iso2: 'SS', iso3: 'SSD', name: 'South Sudan',      flag: '🇸🇸', region: 'East' },
  { iso2: 'SD', iso3: 'SDN', name: 'Sudan',            flag: '🇸🇩', region: 'East' },
  { iso2: 'TZ', iso3: 'TZA', name: 'Tanzania',         flag: '🇹🇿', region: 'East', aliases: ['United Republic of Tanzania'] },
  { iso2: 'TG', iso3: 'TGO', name: 'Togo',             flag: '🇹🇬', region: 'West' },
  { iso2: 'TN', iso3: 'TUN', name: 'Tunisia',          flag: '🇹🇳', region: 'North' },
  { iso2: 'UG', iso3: 'UGA', name: 'Uganda',           flag: '🇺🇬', region: 'East' },
  { iso2: 'ZM', iso3: 'ZMB', name: 'Zambia',           flag: '🇿🇲', region: 'Southern' },
  { iso2: 'ZW', iso3: 'ZWE', name: 'Zimbabwe',         flag: '🇿🇼', region: 'Southern' },
];

/* ─────────── lookup indices ─────────── */

const BY_ISO2 = new Map<string, CountryRef>();
const BY_ISO3 = new Map<string, CountryRef>();
const BY_NAME = new Map<string, CountryRef>();

for (const c of AFRICAN_COUNTRIES) {
  BY_ISO2.set(c.iso2.toUpperCase(), c);
  BY_ISO3.set(c.iso3.toUpperCase(), c);
  BY_NAME.set(c.name.toLowerCase(), c);
  for (const alias of c.aliases ?? []) {
    BY_NAME.set(alias.toLowerCase(), c);
  }
}

/** Resolve any country identifier to its canonical ISO2 code. */
export function resolveIso2(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const up = s.toUpperCase();
  if (BY_ISO2.has(up)) return up;
  const iso3 = BY_ISO3.get(up);
  if (iso3) return iso3.iso2;
  const named = BY_NAME.get(s.toLowerCase());
  if (named) return named.iso2;
  return null;
}

/** Does this GeoJSON feature belong to any of the selected ISO2 codes? */
export function featureMatchesCountries(
  props: Record<string, unknown> | null | undefined,
  selectedIso2: string[],
): boolean {
  if (!selectedIso2.length) return true;
  if (!props) return false;

  // Try every plausible property the source might use
  const candidates = [
    props.iso2,
    props.iso_a2,
    props.ISO_A2,
    props.country_code,
    props.iso3,
    props.iso_a3,
    props.ISO_A3,
    props.country,
    props.country_long,
    props.country_name,
    props.ADMIN,
    props.NAME,
    props.name,
  ];

  for (const candidate of candidates) {
    const iso2 = resolveIso2(candidate);
    if (iso2 && selectedIso2.includes(iso2)) return true;
  }
  return false;
}

export const ALL_AFRICAN_ISO2 = AFRICAN_COUNTRIES.map((c) => c.iso2);

/** Flag emoji lookup that works with whatever identifier the UI has. */
export function flagFor(raw: unknown): string {
  const iso2 = resolveIso2(raw);
  if (!iso2) return '🏳️';
  const c = BY_ISO2.get(iso2);
  return c?.flag ?? '🏳️';
}

/** Human-readable name lookup that works with whatever identifier the UI has. */
export function nameFor(raw: unknown): string | null {
  const iso2 = resolveIso2(raw);
  if (!iso2) return null;
  return BY_ISO2.get(iso2)?.name ?? null;
}