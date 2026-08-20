/**
 * schools.country_en(영문 국가명) → 국기 이모지. Unicode Regional Indicator Symbol
 * 조합(ISO 3166-1 alpha-2)으로 만든다. "Other"처럼 특정 국가가 아닌 값은 매핑하지 않는다.
 */
const COUNTRY_ISO2 = {
  'Australia': 'AU', 'Austria': 'AT', 'Belgium': 'BE', 'Canada': 'CA', 'China': 'CN',
  'Denmark': 'DK', 'Finland': 'FI', 'France': 'FR', 'Germany': 'DE', 'Hong Kong': 'HK',
  'Ireland': 'IE', 'Italy': 'IT', 'Japan': 'JP', 'Lithuania': 'LT', 'Malaysia': 'MY',
  'Mexico': 'MX', 'Netherlands': 'NL', 'New Zealand': 'NZ', 'Norway': 'NO', 'Poland': 'PL',
  'Russia': 'RU', 'Singapore': 'SG', 'Spain': 'ES', 'Sweden': 'SE', 'Switzerland': 'CH',
  'Taiwan': 'TW', 'Thailand': 'TH', 'Turkey': 'TR', 'United Kingdom': 'GB',
  'United States': 'US', 'Vietnam': 'VN'
};

function countryFlag(countryEn) {
  const iso2 = COUNTRY_ISO2[countryEn];
  if (!iso2) return '';
  return String.fromCodePoint(...[...iso2].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}
