/** Real Delhi institution names for each response team — office/role
 * structure, never a fabricated individual's name, matching
 * backend/data/directory.json. */
export const TEAM_OFFICE: Record<string, { office: string; role: string }> = {
  "Fire & Rescue Unit": { office: "Delhi Fire Service — Station Hauz Khas", role: "Duty Officer" },
  "Rapid Action Team": { office: "MCD South Zone — Disaster Management Cell", role: "Control Room Duty Officer" },
  "Medical/Ambulance Unit": { office: "CATS Ambulance Control Room", role: "Dispatch Officer" },
  "NDRF Response Team": { office: "NDRF — 8th Battalion (Delhi NCR)", role: "Response Team Lead" },
  "Emergency Operations Center": { office: "DCP South West District Control Room", role: "Escalation Officer" },
};
