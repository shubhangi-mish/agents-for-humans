export interface Persona {
  id: string;
  name: string;
  role: string;
  jurisdiction: string;
  initials: string;
  /** Only one persona is wired up for this demo — the CM. The list exists
   * so adding a District Magistrate or Police Commissioner login later is
   * a data change, not a rebuild: flip `enabled` and CURRENT_PERSONA picks
   * up whichever comes first, same as a real role switch would. */
  enabled: boolean;
}

export const PERSONAS: Persona[] = [
  {
    id: "cm",
    name: "Chief Minister",
    role: "Government of NCT of Delhi",
    jurisdiction: "City-wide",
    initials: "CM",
    enabled: true,
  },
  {
    id: "dm-south",
    name: "District Magistrate",
    role: "South District",
    jurisdiction: "South Delhi",
    initials: "DM",
    enabled: false,
  },
  {
    id: "cp",
    name: "Commissioner of Police",
    role: "Delhi Police",
    jurisdiction: "City-wide",
    initials: "CP",
    enabled: false,
  },
];

export const CURRENT_PERSONA: Persona = PERSONAS.find((p) => p.enabled) ?? PERSONAS[0];

/** The string sent to the backend as the override `actor` and shown
 * anywhere an action needs to be attributed to whoever is signed in. */
export const CURRENT_ACTOR = `${CURRENT_PERSONA.name}, ${CURRENT_PERSONA.role}`;
