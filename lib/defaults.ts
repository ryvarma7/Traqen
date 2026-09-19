/** Built-in dropdown defaults shown to every user.
 *  Users can extend these per-field via "+ Add new" (stored in dropdown_options);
 *  those extras are appended after the defaults, deduped. Keys must match the
 *  allowedFields set in lib/actions/applications.ts. */
export const DEFAULT_OPTIONS: Record<string, Record<string, string[]>> = {
  jobs: {
    role_type: [
      "Frontend Intern",
      "Backend Intern",
      "Full-stack Intern",
      "SDE Intern",
      "Data Analyst Intern",
      "ML Intern",
      "New Grad",
    ],
    location_mode: ["Remote", "Hybrid", "On-site"],
    source: ["LinkedIn", "Company website", "Referral", "Job board", "Campus placement"],
  },
  hackathons: {
    type: ["Hackathon", "Buildathon", "Datathon", "Designathon"],
    purpose: ["Learning", "Prize money", "Networking", "Portfolio project", "Recruiting"],
    theme_track: [
      "AI/ML",
      "FinTech",
      "HealthTech",
      "EdTech",
      "Web3",
      "Sustainability",
      "Open innovation",
    ],
    mode: ["Online", "In-person", "Hybrid"],
    source: ["Devpost", "Unstop", "MLH", "Instagram", "College notice board"],
  },
};

/** Defaults for one section+field, with user-added extras appended (deduped). */
export function optionsForField(
  section: "jobs" | "hackathons",
  fieldName: string,
  userValues: string[]
): string[] {
  const defaults = DEFAULT_OPTIONS[section]?.[fieldName] ?? [];
  const seen = new Set(defaults.map((v) => v.toLowerCase()));
  return [...defaults, ...userValues.filter((v) => !seen.has(v.toLowerCase()))];
}
