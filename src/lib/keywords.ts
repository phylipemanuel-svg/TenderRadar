import type { KeywordGroup } from "./types";

/**
 * Default keyword engine. Every group is a set of synonyms. Matching is
 * case-insensitive and word-boundary aware (see matching.ts). These are the
 * defaults only; the live list is stored in the database and edited in Settings.
 */
export const DEFAULT_KEYWORD_GROUPS: KeywordGroup[] = [
  {
    id: "telecoms",
    label: "Telecoms & Voice",
    terms: [
      "telecommunications", "telecom", "telecoms", "telephony", "telephone system", "telephone services",
      "voice services", "voice", "VoIP", "SIP", "SIP trunk", "SIP trunks", "SIP trunking",
      "hosted telephony", "hosted voice", "cloud telephony", "cloud voice", "unified communications", "UC",
      "UCaaS", "Webex", "Webex Calling", "Cisco Webex", "Teams Phone", "Microsoft Teams Phone", "Teams calling",
      "Operator Connect", "Direct Routing", "PSTN", "PSTN switch off", "PSTN replacement", "WLR", "WLR replacement",
      "analogue line", "analogue replacement", "ISDN", "ISDN replacement", "PBX", "IP telephony",
      "telephony migration", "call recording", "lines and calls", "mobile phones", "mobile telephony",
      "business mobile", "mobile contract",
    ],
  },
  {
    id: "connectivity",
    label: "Connectivity",
    terms: [
      "leased line", "leased lines", "ethernet", "internet connectivity", "internet connection", "internet access",
      "broadband", "FTTP", "FTTC", "SOGEA", "full fibre", "fibre broadband", "SD-WAN", "SDWAN", "WAN",
      "wide area network", "4G", "5G", "backup connectivity", "resilient connectivity", "connectivity services",
      "data connectivity", "internet service provider", "ISP", "point to point", "dark fibre", "MPLS",
      "site to site", "circuits", "data circuits", "network connectivity",
    ],
  },
  {
    id: "managedit",
    label: "Managed IT",
    terms: [
      "managed IT", "managed IT services", "managed service provider", "MSP", "ICT managed service",
      "ICT managed services", "IT managed service", "IT support", "ICT support", "service desk", "helpdesk",
      "help desk", "IT outsourcing", "ICT outsourcing", "outsourced IT", "IT services", "ICT services",
      "technical support", "end user support", "desktop support", "IT infrastructure", "ICT infrastructure",
      "infrastructure support", "device management", "endpoint management", "IT consultancy", "ICT strategy",
      "digital transformation", "IT partner", "technology partner",
    ],
  },
  {
    id: "microsoft",
    label: "Microsoft",
    terms: [
      "Microsoft 365", "M365", "Office 365", "O365", "Microsoft Teams", "SharePoint", "Exchange Online",
      "Azure", "Microsoft Azure", "Entra", "Intune", "Microsoft Dynamics", "Dynamics 365", "Dynamics CE",
      "Power Platform", "Power Apps", "Power Automate", "Power BI", "Copilot", "Microsoft licensing",
      "Microsoft partner", "Windows 11", "Windows Server", "Active Directory", "Microsoft Defender",
    ],
  },
  {
    id: "networking",
    label: "Networking",
    terms: [
      "LAN", "local area network", "network infrastructure", "network refresh", "network replacement",
      "network upgrade", "network equipment", "network hardware", "Cisco", "Meraki", "Aruba", "HPE", "HP Enterprise",
      "UniFi", "Ubiquiti", "Fortinet", "Juniper", "Extreme Networks", "Wi-Fi", "WiFi", "wireless network",
      "wireless LAN", "WLAN", "wireless access points", "access points", "switching", "network switches",
      "switches", "routing", "routers", "firewall", "firewalls", "network management", "network monitoring",
      "network services", "network support", "core network", "campus network", "data centre network",
    ],
  },
  {
    id: "cyber",
    label: "Cyber Security",
    terms: [
      "cyber security", "cybersecurity", "cyber", "information security", "managed security", "security services",
      "penetration test", "penetration testing", "pen test", "pen testing", "IT health check", "ITHC", "PSN",
      "Cyber Essentials", "Cyber Essentials Plus", "security consultancy", "SOC", "security operations centre",
      "SIEM", "SASE", "zero trust", "vulnerability", "vulnerability scanning", "vulnerability assessment",
      "endpoint security", "EDR", "MDR", "XDR", "email security", "phishing", "security awareness",
      "ISO 27001", "NCSC", "CHECK", "CREST", "DSPT", "data security", "identity and access", "MFA",
      "backup and recovery", "disaster recovery", "business continuity", "cyber resilience",
    ],
  },
  {
    id: "cabling",
    label: "Cabling & Fibre",
    terms: [
      "structured cabling", "data cabling", "network cabling", "cabling", "cabling infrastructure", "Cat6",
      "Cat6A", "Cat 6", "Cat 6A", "Cat5e", "fibre", "fiber", "fibre optic", "fiber optic", "optical fibre",
      "fibre installation", "fibre termination", "fibre splicing", "passive network", "passive infrastructure",
      "comms room", "communications room", "comms rooms", "communications cabinet", "comms cabinet",
      "cabinet installation", "server room", "containment", "patch panel", "cable installation", "cable laying",
    ],
  },
  {
    id: "cctv",
    label: "CCTV & Security Systems",
    terms: [
      "CCTV", "IP CCTV", "video surveillance", "surveillance", "security cameras", "cameras", "access control",
      "door access", "door entry", "intercom", "intruder alarm", "security systems", "ANPR", "body worn",
      "video management", "VMS", "physical security",
    ],
  },
  {
    id: "av",
    label: "Audio Visual",
    terms: [
      "audio visual", "audio-visual", "AV", "AV equipment", "AV installation", "digital signage", "display screens",
      "video conferencing", "meeting room technology", "meeting rooms", "conference room", "projectors",
      "interactive displays", "smart boards", "lecture capture", "hybrid meeting",
    ],
  },
  {
    id: "cloud",
    label: "Cloud",
    terms: [
      "cloud services", "cloud", "cloud migration", "cloud hosting", "application hosting", "hosting services",
      "managed cloud", "public cloud", "private cloud", "hybrid cloud", "IaaS", "PaaS", "SaaS", "data centre",
      "datacentre", "server hosting", "virtualisation", "virtualization", "VMware", "Hyper-V", "server refresh",
      "storage", "backup", "colocation",
    ],
  },
  {
    id: "contactcentre",
    label: "Contact Centre",
    terms: [
      "contact centre", "contact center", "call centre", "call center", "CCaaS", "omnichannel", "IVR",
      "customer contact", "customer service platform", "telephony platform", "call handling", "call management",
      "queue management", "agent desktop", "Genesys", "Five9", "Anywhere365", "NICE", "8x8", "RingCentral",
    ],
  },
];

/** Terms that indicate a notice is NOT for Flotek even if IT words appear. Editable in Settings. */
export const DEFAULT_EXCLUDE_KEYWORDS: string[] = [
  "catering", "cleaning services", "grounds maintenance", "medical devices", "pharmaceutical", "vehicle hire",
  "vehicle fleet", "furniture", "stationery", "temporary staff", "agency staff", "recruitment agency",
  "construction of new", "highways maintenance", "waste collection", "social care placements", "translation services",
];
