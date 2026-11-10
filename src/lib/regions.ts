import type { RegionId } from "./types";

export const REGIONS: { id: RegionId; label: string }[] = [
  { id: "wales", label: "Wales" },
  { id: "southwest", label: "South West" },
  { id: "midlands", label: "Midlands" },
  { id: "northwest", label: "North West" },
  { id: "england", label: "England (other)" },
  { id: "scotland", label: "Scotland" },
  { id: "northernireland", label: "Northern Ireland" },
  { id: "uk", label: "UK Wide" },
];

export const REGION_LABEL: Record<string, string> = Object.fromEntries(REGIONS.map((r) => [r.id, r.label]));
REGION_LABEL.unknown = "Not stated";

/** ITL / NUTS level-1 prefixes (UKL = Wales etc.) */
const ITL_MAP: Record<string, RegionId> = {
  UKL: "wales",
  UKK: "southwest",
  UKG: "midlands", // West Midlands
  UKF: "midlands", // East Midlands
  UKD: "northwest",
  UKM: "scotland",
  UKN: "northernireland",
  UKC: "england",
  UKE: "england",
  UKH: "england",
  UKI: "england",
  UKJ: "england",
};

const PLACE_PATTERNS: { id: RegionId; re: RegExp }[] = [
  {
    id: "wales",
    re: /\b(wales|cymru|welsh|cardiff|caerdydd|swansea|abertawe|newport|casnewydd|wrexham|wrecsam|gwynedd|powys|ceredigion|pembrokeshire|sir benfro|carmarthen|caerfyrddin|conwy|denbighshire|sir ddinbych|flintshire|sir y fflint|monmouthshire|sir fynwy|torfaen|caerphilly|caerffili|merthyr|rhondda|cynon|taf|neath|castell-nedd|port talbot|bridgend|pen-y-bont|blaenau gwent|anglesey|ynys m[oô]n|vale of glamorgan|bro morgannwg|llanelli|aberystwyth|bangor|hywel dda|betsi cadwaladr|aneurin bevan|cwm taf|cardiff and vale|swansea bay|powys teaching|velindre|digital health and care wales|nhs wales|natural resources wales|gig cymru|senedd|llywodraeth cymru)\b/i,
  },
  {
    id: "southwest",
    re: /\b(south west|bristol|somerset|devon|cornwall|kernow|dorset|gloucester|gloucestershire|wiltshire|bath|plymouth|exeter|torbay|swindon|bournemouth|poole|taunton|cheltenham|truro|isles of scilly|bristol and weston|royal devon|university hospitals plymouth)\b/i,
  },
  {
    id: "midlands",
    re: /\b(midlands|birmingham|coventry|wolverhampton|dudley|sandwell|walsall|solihull|warwick|warwickshire|worcester|worcestershire|hereford|herefordshire|shropshire|shrewsbury|telford|staffordshire|stoke|derby|derbyshire|nottingham|nottinghamshire|leicester|leicestershire|northampton|northamptonshire|lincoln|lincolnshire|rutland)\b/i,
  },
  {
    id: "northwest",
    re: /\b(north west|manchester|liverpool|lancashire|cheshire|cumbria|merseyside|bolton|stockport|salford|wigan|warrington|preston|blackpool|blackburn|oldham|rochdale|tameside|trafford|bury|sefton|wirral|knowsley|st helens|carlisle|chester|crewe|lancaster)\b/i,
  },
  {
    id: "scotland",
    re: /\b(scotland|scottish|edinburgh|glasgow|aberdeen|dundee|inverness|stirling|perth|fife|highland|lothian|lanarkshire|ayrshire|renfrewshire|dumfries|borders|orkney|shetland|western isles|nhs scotland)\b/i,
  },
  {
    id: "northernireland",
    re: /\b(northern ireland|belfast|derry|londonderry|antrim|armagh|down|fermanagh|tyrone|lisburn|newry|hsc ni|hscni)\b/i,
  },
];

/** UK postcode areas by region (outward code letters). */
const POSTCODE_AREAS: Record<string, RegionId> = {
  CF: "wales", SA: "wales", NP: "wales", LL: "wales", LD: "wales", SY: "wales", CH: "wales", HR: "midlands",
  BS: "southwest", BA: "southwest", TA: "southwest", EX: "southwest", PL: "southwest", TQ: "southwest", TR: "southwest",
  DT: "southwest", BH: "southwest", SP: "southwest", SN: "southwest", GL: "southwest",
  B: "midlands", CV: "midlands", WS: "midlands", WV: "midlands", DY: "midlands", WR: "midlands", TF: "midlands",
  ST: "midlands", DE: "midlands", NG: "midlands", LE: "midlands", NN: "midlands", LN: "midlands",
  M: "northwest", L: "northwest", WA: "northwest", WN: "northwest", BL: "northwest", OL: "northwest", SK: "northwest",
  PR: "northwest", FY: "northwest", BB: "northwest", LA: "northwest", CA: "northwest", CW: "northwest",
  EH: "scotland", G: "scotland", AB: "scotland", DD: "scotland", IV: "scotland", FK: "scotland", PH: "scotland",
  KY: "scotland", KA: "scotland", PA: "scotland", ML: "scotland", DG: "scotland", TD: "scotland", KW: "scotland",
  HS: "scotland", ZE: "scotland",
  BT: "northernireland",
};

export function regionFromPostcode(pc: string | null | undefined): RegionId | null {
  if (!pc) return null;
  const m = String(pc).trim().toUpperCase().match(/^([A-Z]{1,2})\d/);
  if (!m) return null;
  const two = m[1];
  if (POSTCODE_AREAS[two]) return POSTCODE_AREAS[two];
  if (POSTCODE_AREAS[two[0]] && two.length === 1) return POSTCODE_AREAS[two[0]];
  // Any other valid UK postcode area is England
  return "england";
}

/**
 * Determine the region of a notice from structured codes first, then postcode,
 * then place names in buyer/location text.
 */
export function detectRegion(input: {
  regionCodes: string[];
  postcode?: string | null;
  buyer: string;
  locationText: string;
  title?: string;
}): RegionId | "unknown" {
  const found = new Set<RegionId>();
  for (const code of input.regionCodes) {
    const c = String(code).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (c === "UK" || c === "GB") {
      found.add("uk");
      continue;
    }
    const p = c.slice(0, 3);
    if (ITL_MAP[p]) found.add(ITL_MAP[p]);
  }
  // Two or more different home nations / regions = UK wide
  const specific = [...found].filter((r) => r !== "uk");
  if (specific.length >= 2) return "uk";
  if (specific.length === 1) return specific[0];
  if (found.has("uk")) return "uk";

  const pcRegion = regionFromPostcode(input.postcode);
  if (pcRegion) return pcRegion;

  const text = `${input.buyer} ${input.locationText}`;
  for (const p of PLACE_PATTERNS) if (p.re.test(text)) return p.id;
  if (/\b(uk wide|united kingdom|nationwide|national|all regions|england and wales|great britain)\b/i.test(text)) return "uk";
  if (/\b(england|london|yorkshire|north east|east anglia|south east|kent|essex|surrey|sussex|hampshire|oxford|cambridge|leeds|sheffield|newcastle|hull|norwich)\b/i.test(text)) return "england";
  return "unknown";
}

/** Buyer classification used for the "preferred buyer" score. */
export const BUYER_TYPES: { id: string; label: string; re: RegExp }[] = [
  { id: "nhs", label: "NHS / Health", re: /\b(nhs|health board|hospital|hospitals|nhs trust|foundation trust|integrated care|icb\b|clinical commissioning|ambulance service|primary care|health and care|hsc\b|health service|velindre|public health)\b/i },
  { id: "welshgov", label: "Welsh Government", re: /\b(welsh government|llywodraeth cymru|senedd|welsh revenue|natural resources wales|transport for wales|social care wales|estyn|careers wales|qualifications wales)\b/i },
  { id: "ukgov", label: "UK Government", re: /\b(department for|department of|ministry of|home office|cabinet office|hm treasury|hmrc|hm revenue|dwp|defra|dvla|dvsa|crown commercial|executive agency|office for|environment agency|ordnance survey|ons\b|met office|companies house|land registry|uk research|ukri|arm's length|government)\b/i },
  { id: "council", label: "Local Authority", re: /\b(council|borough|county|district|city of|metropolitan|unitary|london borough|combined authority|corporation of|cyngor|parish|town hall)\b/i },
  { id: "housing", label: "Housing Association", re: /\b(housing|homes|housing association|housing group|housing trust|registered provider|cartrefi|tai\b|almshouse)\b/i },
  { id: "bluelight", label: "Police / Fire / Blue Light", re: /\b(police|constabulary|fire and rescue|fire & rescue|fire service|fire authority|bluelight|blue light|ambulance|coastguard|crime commissioner|pcc\b)\b/i },
  { id: "university", label: "University / HE", re: /\b(university|prifysgol|higher education|russell group|jisc|university hospital)\b/i },
  { id: "college", label: "College / FE", re: /\b(college|coleg|further education|sixth form|institute of technology)\b/i },
  { id: "school", label: "School / Education", re: /\b(school|academy|academies|academy trust|multi academy|mat\b|education|ysgol|primary|secondary|nursery|early years)\b/i },
  { id: "publicbody", label: "Public Body", re: /\b(authority|agency|commission|commissioner|board|trust|ndpb|non departmental|public body|national park|library|museum|arts council|sport|bbc|channel 4|ofsted|ofcom|ofgem|ofwat|regulator|nhs property|network rail|transport for)\b/i },
  { id: "charity", label: "Charity / Third Sector", re: /\b(charity|charitable|foundation|trust|society|association|voluntary|cic\b|community interest|not for profit|non-profit|hospice)\b/i },
];

export function classifyBuyer(name: string, classification?: string | null): string {
  const s = `${name} ${classification || ""}`;
  for (const t of BUYER_TYPES) if (t.re.test(s)) return t.id;
  return "other";
}

export const BUYER_TYPE_LABEL: Record<string, string> = Object.fromEntries(BUYER_TYPES.map((b) => [b.id, b.label]));
BUYER_TYPE_LABEL.other = "Other / Private";

export const DEFAULT_BUYER_POINTS: Record<string, number> = {
  nhs: 10,
  welshgov: 10,
  ukgov: 8,
  council: 9,
  housing: 8,
  bluelight: 9,
  university: 8,
  college: 8,
  school: 7,
  publicbody: 7,
  charity: 6,
  other: 2,
};
