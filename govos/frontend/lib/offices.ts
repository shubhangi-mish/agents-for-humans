/** Real Delhi institution names for each response team, plus a fictional
 * duty-officer name for "who's actually sitting at that desk". The office
 * is real; the person is a placeholder character for the simulation —
 * never a real official's name. */
export const TEAM_OFFICE: Record<string, { office: string; role: string; officer: string }> = {
  "Fire & Rescue Unit": { office: "Delhi Fire Service — Station Hauz Khas", role: "Duty Officer", officer: "Station Officer K. Rawat" },
  "Rapid Action Team": { office: "MCD South Zone — Disaster Management Cell", role: "Control Room Duty Officer", officer: "Duty Officer P. Singh" },
  "Medical/Ambulance Unit": { office: "CATS Ambulance Control Room", role: "Dispatch Officer", officer: "Dispatch Officer N. Gupta" },
  "NDRF Response Team": { office: "NDRF — 8th Battalion (Delhi NCR)", role: "Response Team Lead", officer: "Team Lead V. Menon" },
  "Emergency Operations Center": { office: "DCP South West District Control Room", role: "Escalation Officer", officer: "Escalation Officer D. Kaur" },
};
