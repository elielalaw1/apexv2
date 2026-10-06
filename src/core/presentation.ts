// Translate built-in legacy labels for display only. Stored definitions and events stay immutable.
const legacy: Record<string, string> = {
  "Intervaller · morgon": "Intervals · morning",
  "Uthållighet · test": "Endurance · test",
  "Intervaller · uppföljning": "Intervals · follow-up",
  "Teknik · återhämtning": "Technique · recovery",
  "Belastning & återhämtning": "Workload & recovery",
  "Verifierat upplägg": "Verified view",
  "Hjärtfrekvens & RR": "Heart rate & RR",
  "Jämför hjärtfrekvens": "Compare heart rate",
  Telefonrörelse: "Phone movement",
  Intervallpass: "Interval session",
  Arbete: "Work",
  Återhämtning: "Recovery",
  Avbrott: "Interruption",
  "Tempo förändrat": "Pace changed",
  "Upplevd ansträngning": "Perceived exertion",
  Beredskap: "Readiness",
};
export function displayText(text: string): string {
  return legacy[text] ?? text;
}
