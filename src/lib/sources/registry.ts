import type { SourceDefinition } from "../types";

/**
 * Every procurement source the app knows about. Only "api" and "feed" kinds are
 * ever searched; "manual" sources are listed with a link so nobody is misled
 * into thinking they were queried. Under the Procurement Act 2023 notices from
 * the manual portals below must also be published on Find a Tender, so they
 * are still captured — the portal is where the documents live.
 */
export const SOURCES: SourceDefinition[] = [
  {
    id: "fts",
    label: "Find a Tender",
    kind: "api",
    website: "https://www.find-tender.service.gov.uk/",
    description: "UK central platform. Official OCDS API searched automatically.",
    allowedHosts: ["find-tender.service.gov.uk"],
  },
  {
    id: "contractsfinder",
    label: "Contracts Finder",
    kind: "api",
    website: "https://www.contractsfinder.service.gov.uk/",
    description: "England lower-value and legacy-regime notices. Official OCDS API searched automatically.",
    allowedHosts: ["contractsfinder.service.gov.uk"],
  },
  {
    id: "sell2wales",
    label: "Sell2Wales",
    kind: "api",
    website: "https://www.sell2wales.gov.wales/",
    description: "Welsh public sector portal. Official OCDS API (api.sell2wales.gov.wales) searched automatically by month and notice type.",
    allowedHosts: ["sell2wales.gov.wales", "api-sell2wales.klickstream.com"],
  },
  {
    id: "pcs",
    label: "Public Contracts Scotland",
    kind: "api",
    website: "https://www.publiccontractsscotland.gov.uk/",
    description: "Scottish portal. Official OCDS API (api.publiccontractsscotland.gov.uk) searched automatically by month and notice type.",
    allowedHosts: ["publiccontractsscotland.gov.uk"],
  },
  {
    id: "etendersni",
    label: "eTendersNI",
    kind: "feed",
    website: "https://etendersni.gov.uk/",
    description: "Northern Ireland portal. Public notice feed if available (URL set in Settings).",
    allowedHosts: ["etendersni.gov.uk"],
  },
  { id: "ccs", label: "Crown Commercial Service", kind: "manual", website: "https://www.crowncommercial.gov.uk/agreements/upcoming", description: "Framework pipeline. Tenders are published on Find a Tender; check the CCS pipeline page for upcoming agreements.", allowedHosts: [] },
  { id: "nhssc", label: "NHS Supply Chain", kind: "manual", website: "https://www.supplychain.nhs.uk/suppliers/", description: "Supplier portal, no public search API. Notices are published on Find a Tender.", allowedHosts: [] },
  { id: "nhssbs", label: "NHS Shared Business Services", kind: "manual", website: "https://www.sbs.nhs.uk/procurement/", description: "Framework provider. Notices on Find a Tender; documents on its portal.", allowedHosts: [] },
  { id: "atamis", label: "NHS England / Atamis", kind: "manual", website: "https://health-family.force.com/s/Welcome", description: "Health Family eSourcing portal (Atamis). Registration required; no public API.", allowedHosts: [] },
  { id: "bluelight", label: "BlueLight Commercial", kind: "manual", website: "https://bluelightcommercial.police.uk/", description: "Police and fire procurement. Notices on Find a Tender; tender packs on its portal.", allowedHosts: [] },
  { id: "yortender", label: "YORtender", kind: "manual", website: "https://yortender.eu-supply.com/", description: "Yorkshire and Humber portal (EU-Supply). Registration required; no public API.", allowedHosts: [] },
  { id: "procontract", label: "ProContract (Proactis)", kind: "manual", website: "https://procontract.due-north.com/", description: "Used by many councils. Registration required; no public API.", allowedHosts: [] },
  { id: "intend", label: "In-Tend", kind: "manual", website: "https://in-tendhost.co.uk/", description: "Per-organisation portals. Registration required; no public API.", allowedHosts: [] },
  { id: "delta", label: "Delta eSourcing", kind: "manual", website: "https://www.delta-esourcing.com/", description: "Registration required; no public API.", allowedHosts: [] },
  { id: "jaggaer", label: "Jaggaer", kind: "manual", website: "https://www.jaggaer.com/", description: "Per-organisation portals. No public API.", allowedHosts: [] },
  { id: "mercell", label: "Mercell", kind: "manual", website: "https://www.mercell.com/en-gb/", description: "Per-organisation portals. No public API.", allowedHosts: [] },
  { id: "espo", label: "ESPO", kind: "manual", website: "https://www.espo.org/", description: "Buying organisation. Framework tenders are on Find a Tender.", allowedHosts: [] },
  { id: "ypo", label: "YPO", kind: "manual", website: "https://www.ypo.co.uk/", description: "Buying organisation. Framework tenders are on Find a Tender.", allowedHosts: [] },
  { id: "nepo", label: "NEPO", kind: "manual", website: "https://www.nepo.org/", description: "North East buying organisation. Framework tenders are on Find a Tender.", allowedHosts: [] },
  { id: "universities", label: "University procurement portals", kind: "manual", website: "https://www.hepcw.ac.uk/", description: "HEPCW (Wales), LUPC, NWUPC, SUPC consortia. Tenders are on Find a Tender.", allowedHosts: [] },
  { id: "housing", label: "Housing procurement portals", kind: "manual", website: "https://www.procurementforhousing.co.uk/", description: "Procurement for Housing and individual associations. Tenders on Find a Tender.", allowedHosts: [] },
];

export const SEARCHABLE_SOURCES = SOURCES.filter((s) => s.kind !== "manual");
export const sourceById = (id: string) => SOURCES.find((s) => s.id === id) || null;
