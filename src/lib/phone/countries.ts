/* -------------------------------------------------------------------------- */
/*  countries — the number field's countries (founder 2026-10-28, backend     */
/*  N230): the flag, the calling code and how many digits a number has         */
/*  there, so the field can pick the country from a pasted number, drop a     */
/*  leading 0 and light Send code only when the number is long enough.        */
/*                                                                            */
/*  The list opens with Poland, then the United States, then A to Z; Poland   */
/*  is chosen at the start for everyone.                                      */
/* -------------------------------------------------------------------------- */

export interface Country {
  iso: string;
  name: string;
  dial: string;
  /** Digits after the calling code, without a leading 0. */
  min: number;
  max: number;
  /** Other names people search by ("uk", "usa"). */
  alias: string;
}

/** iso, name, dial, min, max, alias. Lengths are the national number's;
 *  where a country has several, the range covers mobiles. */
const ROWS: [string, string, string, number, number, string?][] = [
  ["AF", "Afghanistan", "93", 9, 9], ["AL", "Albania", "355", 8, 9], ["DZ", "Algeria", "213", 9, 9],
  ["AD", "Andorra", "376", 6, 9], ["AO", "Angola", "244", 9, 9], ["AG", "Antigua and Barbuda", "1", 10, 10],
  ["AR", "Argentina", "54", 10, 11], ["AM", "Armenia", "374", 8, 8], ["AU", "Australia", "61", 9, 9],
  ["AT", "Austria", "43", 7, 13], ["AZ", "Azerbaijan", "994", 9, 9], ["BS", "Bahamas", "1", 10, 10],
  ["BH", "Bahrain", "973", 8, 8], ["BD", "Bangladesh", "880", 10, 10], ["BB", "Barbados", "1", 10, 10],
  ["BY", "Belarus", "375", 9, 9], ["BE", "Belgium", "32", 8, 9], ["BZ", "Belize", "501", 7, 7],
  ["BJ", "Benin", "229", 8, 10], ["BT", "Bhutan", "975", 8, 8], ["BO", "Bolivia", "591", 8, 8],
  ["BA", "Bosnia and Herzegovina", "387", 8, 9, "bosnia"], ["BW", "Botswana", "267", 7, 8],
  ["BR", "Brazil", "55", 10, 11, "brasil"], ["BN", "Brunei", "673", 7, 7], ["BG", "Bulgaria", "359", 8, 9],
  ["BF", "Burkina Faso", "226", 8, 8], ["BI", "Burundi", "257", 8, 8], ["KH", "Cambodia", "855", 8, 9],
  ["CM", "Cameroon", "237", 9, 9], ["CA", "Canada", "1", 10, 10], ["CV", "Cape Verde", "238", 7, 7],
  ["CF", "Central African Republic", "236", 8, 8], ["TD", "Chad", "235", 8, 8], ["CL", "Chile", "56", 9, 9],
  ["CN", "China", "86", 11, 11], ["CO", "Colombia", "57", 10, 10], ["KM", "Comoros", "269", 7, 7],
  ["CG", "Congo", "242", 9, 9], ["CD", "Congo (DRC)", "243", 9, 9, "drc"], ["CR", "Costa Rica", "506", 8, 8],
  ["CI", "Côte d'Ivoire", "225", 10, 10, "ivory coast"], ["HR", "Croatia", "385", 8, 9, "hrvatska"],
  ["CU", "Cuba", "53", 8, 8], ["CY", "Cyprus", "357", 8, 8], ["CZ", "Czechia", "420", 9, 9, "czech republic"],
  ["DK", "Denmark", "45", 8, 8], ["DJ", "Djibouti", "253", 8, 8], ["DM", "Dominica", "1", 10, 10],
  ["DO", "Dominican Republic", "1", 10, 10], ["EC", "Ecuador", "593", 9, 9], ["EG", "Egypt", "20", 10, 10],
  ["SV", "El Salvador", "503", 8, 8], ["GQ", "Equatorial Guinea", "240", 9, 9], ["ER", "Eritrea", "291", 7, 7],
  ["EE", "Estonia", "372", 7, 8], ["SZ", "Eswatini", "268", 8, 8, "swaziland"], ["ET", "Ethiopia", "251", 9, 9],
  ["FJ", "Fiji", "679", 7, 7], ["FI", "Finland", "358", 6, 10, "suomi"], ["FR", "France", "33", 9, 9],
  ["GA", "Gabon", "241", 7, 8], ["GM", "Gambia", "220", 7, 7], ["GE", "Georgia", "995", 9, 9],
  ["DE", "Germany", "49", 10, 11, "deutschland"], ["GH", "Ghana", "233", 9, 9], ["GR", "Greece", "30", 10, 10],
  ["GD", "Grenada", "1", 10, 10], ["GT", "Guatemala", "502", 8, 8], ["GN", "Guinea", "224", 9, 9],
  ["GW", "Guinea-Bissau", "245", 7, 9], ["GY", "Guyana", "592", 7, 7], ["HT", "Haiti", "509", 8, 8],
  ["HN", "Honduras", "504", 8, 8], ["HK", "Hong Kong", "852", 8, 8], ["HU", "Hungary", "36", 9, 9],
  ["IS", "Iceland", "354", 7, 7], ["IN", "India", "91", 10, 10], ["ID", "Indonesia", "62", 9, 12],
  ["IR", "Iran", "98", 10, 10], ["IQ", "Iraq", "964", 10, 10], ["IE", "Ireland", "353", 9, 9],
  ["IL", "Israel", "972", 9, 9], ["IT", "Italy", "39", 9, 10, "italia"], ["JM", "Jamaica", "1", 10, 10],
  ["JP", "Japan", "81", 10, 10], ["JO", "Jordan", "962", 9, 9], ["KZ", "Kazakhstan", "7", 10, 10],
  ["KE", "Kenya", "254", 9, 9], ["KI", "Kiribati", "686", 8, 8], ["XK", "Kosovo", "383", 8, 8],
  ["KW", "Kuwait", "965", 8, 8], ["KG", "Kyrgyzstan", "996", 9, 9], ["LA", "Laos", "856", 9, 10],
  ["LV", "Latvia", "371", 8, 8], ["LB", "Lebanon", "961", 7, 8], ["LS", "Lesotho", "266", 8, 8],
  ["LR", "Liberia", "231", 8, 9], ["LY", "Libya", "218", 9, 9], ["LI", "Liechtenstein", "423", 7, 9],
  ["LT", "Lithuania", "370", 8, 8], ["LU", "Luxembourg", "352", 9, 9], ["MO", "Macao", "853", 8, 8, "macau"],
  ["MG", "Madagascar", "261", 9, 9], ["MW", "Malawi", "265", 9, 9], ["MY", "Malaysia", "60", 9, 10],
  ["MV", "Maldives", "960", 7, 7], ["ML", "Mali", "223", 8, 8], ["MT", "Malta", "356", 8, 8],
  ["MH", "Marshall Islands", "692", 7, 7], ["MR", "Mauritania", "222", 8, 8], ["MU", "Mauritius", "230", 8, 8],
  ["MX", "Mexico", "52", 10, 10, "méxico"], ["FM", "Micronesia", "691", 7, 7], ["MD", "Moldova", "373", 8, 8],
  ["MC", "Monaco", "377", 8, 9], ["MN", "Mongolia", "976", 8, 8], ["ME", "Montenegro", "382", 8, 8],
  ["MA", "Morocco", "212", 9, 9], ["MZ", "Mozambique", "258", 9, 9], ["MM", "Myanmar", "95", 8, 10, "burma"],
  ["NA", "Namibia", "264", 9, 9], ["NR", "Nauru", "674", 7, 7], ["NP", "Nepal", "977", 10, 10],
  ["NL", "Netherlands", "31", 9, 9, "holland nederland"], ["NZ", "New Zealand", "64", 8, 10],
  ["NI", "Nicaragua", "505", 8, 8], ["NE", "Niger", "227", 8, 8], ["NG", "Nigeria", "234", 10, 10],
  ["KP", "North Korea", "850", 8, 10], ["MK", "North Macedonia", "389", 8, 8, "macedonia"],
  ["NO", "Norway", "47", 8, 8, "norge"], ["OM", "Oman", "968", 8, 8], ["PK", "Pakistan", "92", 10, 10],
  ["PW", "Palau", "680", 7, 7], ["PS", "Palestine", "970", 9, 9], ["PA", "Panama", "507", 8, 8],
  ["PG", "Papua New Guinea", "675", 8, 8], ["PY", "Paraguay", "595", 9, 9], ["PE", "Peru", "51", 9, 9],
  ["PH", "Philippines", "63", 10, 10], ["PL", "Poland", "48", 9, 9, "polska"], ["PT", "Portugal", "351", 9, 9],
  ["PR", "Puerto Rico", "1", 10, 10], ["QA", "Qatar", "974", 8, 8], ["RO", "Romania", "40", 9, 9],
  ["RU", "Russia", "7", 10, 10], ["RW", "Rwanda", "250", 9, 9], ["KN", "Saint Kitts and Nevis", "1", 10, 10],
  ["LC", "Saint Lucia", "1", 10, 10], ["VC", "Saint Vincent and the Grenadines", "1", 10, 10],
  ["WS", "Samoa", "685", 7, 7], ["SM", "San Marino", "378", 8, 10], ["ST", "São Tomé and Príncipe", "239", 7, 7],
  ["SA", "Saudi Arabia", "966", 9, 9, "ksa"], ["SN", "Senegal", "221", 9, 9], ["RS", "Serbia", "381", 8, 9, "srbija"],
  ["SC", "Seychelles", "248", 7, 7], ["SL", "Sierra Leone", "232", 8, 8], ["SG", "Singapore", "65", 8, 8],
  ["SK", "Slovakia", "421", 9, 9], ["SI", "Slovenia", "386", 8, 8], ["SB", "Solomon Islands", "677", 7, 7],
  ["SO", "Somalia", "252", 8, 9], ["ZA", "South Africa", "27", 9, 9], ["KR", "South Korea", "82", 9, 10, "korea"],
  ["SS", "South Sudan", "211", 9, 9], ["ES", "Spain", "34", 9, 9, "españa espana"], ["LK", "Sri Lanka", "94", 9, 9],
  ["SD", "Sudan", "249", 9, 9], ["SR", "Suriname", "597", 7, 7], ["SE", "Sweden", "46", 7, 9, "sverige"],
  ["CH", "Switzerland", "41", 9, 9, "schweiz suisse svizzera"], ["SY", "Syria", "963", 9, 9],
  ["TW", "Taiwan", "886", 9, 9], ["TJ", "Tajikistan", "992", 9, 9], ["TZ", "Tanzania", "255", 9, 9],
  ["TH", "Thailand", "66", 9, 9], ["TL", "Timor-Leste", "670", 7, 8, "east timor"], ["TG", "Togo", "228", 8, 8],
  ["TO", "Tonga", "676", 5, 7], ["TT", "Trinidad and Tobago", "1", 10, 10], ["TN", "Tunisia", "216", 8, 8],
  ["TR", "Türkiye", "90", 10, 10, "turkey turkiye"], ["TM", "Turkmenistan", "993", 8, 8], ["TV", "Tuvalu", "688", 5, 6],
  ["UG", "Uganda", "256", 9, 9], ["UA", "Ukraine", "380", 9, 9, "ukraina"],
  ["AE", "United Arab Emirates", "971", 9, 9, "uae emirates dubai"],
  ["GB", "United Kingdom", "44", 10, 10, "uk britain great england scotland wales"],
  ["US", "United States", "1", 10, 10, "usa us america"], ["UY", "Uruguay", "598", 8, 8],
  ["UZ", "Uzbekistan", "998", 9, 9], ["VU", "Vanuatu", "678", 7, 7], ["VA", "Vatican City", "39", 9, 10],
  ["VE", "Venezuela", "58", 10, 10], ["VN", "Vietnam", "84", 9, 10], ["YE", "Yemen", "967", 9, 9],
  ["ZM", "Zambia", "260", 9, 9], ["ZW", "Zimbabwe", "263", 9, 9],
];

export const COUNTRIES: Country[] = ROWS
  .map(([iso, name, dial, min, max, alias]) => ({ iso, name, dial, min, max, alias: alias ?? "" }))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));
export const countryByIso = (iso: string): Country => BY_ISO.get(iso) ?? BY_ISO.get("PL")!;

/** Chosen at the start, for everyone (N230). */
export const START_COUNTRY = "PL";
/** The top of the list, in this order; then A to Z. */
export const FIRST_COUNTRIES = ["PL", "US"];

/** Where one calling code has several countries, the one a pasted number
 *  gets unless the chosen country already shares the code. */
const MAIN_FOR_DIAL: Record<string, string> = { "1": "US", "7": "RU", "39": "IT" };

export function flag(iso: string): string {
  return iso.toUpperCase().replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));
}

export function digitsOf(text: string): string {
  return text.replace(/\D/g, "");
}

/** The number after the country code: digits only, a leading 0 dropped
 *  (the UK's 07700, Poland's rare 0). */
export function nationalDigits(text: string): string {
  return digitsOf(text).replace(/^0+/, "");
}

/** Spaces every 3 digits, the last group up to 4, so the number reads at a
 *  glance ("600 100 200", "7700 900 123"). */
export function grouped(digits: string): string {
  const parts: string[] = [];
  let i = 0;
  while (digits.length - i > 4) {
    parts.push(digits.slice(i, i + 3));
    i += 3;
  }
  if (i < digits.length) parts.push(digits.slice(i));
  return parts.join(" ");
}

/** The country of a full number typed or pasted with + or 00 (digits after
 *  them): the longest calling code that starts it. `current` wins when it
 *  shares the code (a Canadian keeps Canada). */
export function countryOfFull(digits: string, current: Country): Country | null {
  if (digits.startsWith(current.dial)) {
    const longer = COUNTRIES.some((c) => c.dial.length > current.dial.length && digits.startsWith(c.dial));
    if (!longer) return current;
  }
  let best: Country | null = null;
  for (const c of COUNTRIES) {
    if (digits.startsWith(c.dial) && (!best || c.dial.length > best.dial.length)) best = c;
  }
  if (!best) return null;
  const main = MAIN_FOR_DIAL[best.dial];
  return main ? countryByIso(main) : best;
}

/** Long enough, and not too long, for its country. */
export function fits(country: Country, national: string): boolean {
  return national.length >= country.min && national.length <= country.max;
}

/** The number as one clean international string ("+48600100200"). */
export function e164(country: Country, national: string): string {
  return `+${country.dial}${national}`;
}

/** Accents off, lower case: "espana" finds España, "turkiye" Türkiye. */
function plain(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** The list for a search: Poland, the United States, then A to Z when it is
 *  empty; otherwise the matches, by name, code (+44 or 44) or short name. */
export function searchCountries(query: string): Country[] {
  const q = plain(query.trim());
  if (!q) {
    const first = FIRST_COUNTRIES.map(countryByIso);
    return [...first, ...COUNTRIES.filter((c) => !FIRST_COUNTRIES.includes(c.iso))];
  }
  const code = q.replace(/^\+/, "");
  if (/^\d+$/.test(code)) {
    return COUNTRIES.filter((c) => c.dial.startsWith(code))
      .sort((a, b) => a.dial.length - b.dial.length || a.name.localeCompare(b.name, "en"));
  }
  // An exact short name ("uk", "usa") first, then names that start with
  // the search, then other names that start with it, then the rest.
  const rank = (c: Country): number => {
    const aliases = plain(c.alias).split(" ").filter(Boolean);
    if (c.iso.toLowerCase() === q || aliases.includes(q)) return 0;
    if (plain(c.name).startsWith(q)) return 1;
    if (aliases.some((a) => a.startsWith(q))) return 2;
    return plain(c.name).includes(q) ? 3 : 4;
  };
  return COUNTRIES.filter((c) => rank(c) < 4).sort((a, b) => rank(a) - rank(b));
}
