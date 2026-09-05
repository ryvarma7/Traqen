export type JobApplication = {
  id: string;
  user_id: string;
  company: string;
  role_type: string | null;
  status: string;
  stage_detail: string | null;
  priority: string;
  location_mode: string | null;
  start_date: string | null;
  end_date: string | null;
  deadline: string | null;
  applied_date: string | null;
  follow_up_date: string | null;
  application_link: string | null;
  source: string | null;
  contact_person: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Hackathon = {
  id: string;
  user_id: string;
  hackathon_name: string;
  organizing_company: string | null;
  type: string | null;
  purpose: string | null;
  theme_track: string | null;
  track_details: string | null;
  mode: string | null;
  team_size: number | null;
  team_members: string | null;
  status: string;
  round_detail: string | null;
  priority: string;
  start_date: string | null;
  end_date: string | null;
  deadline: string | null;
  applied_date: string | null;
  follow_up_date: string | null;
  application_link: string | null;
  source: string | null;
  result_rank: string | null;
  project_link: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  notes: string | null;
  status: "To do" | "In progress" | "Done";
  priority: string;
  due_date: string | null;
  category: string | null;
  related_type: "job" | "hackathon" | null;
  related_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Note = {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  pinned: boolean;
  color: string;
  created_at: string;
  updated_at: string;
};

export type DropdownOption = {
  id: string;
  user_id: string;
  section: "jobs" | "hackathons";
  field_name: string;
  value: string;
  created_at: string;
};

export const JOB_STATUSES = [
  "Saved",
  "Applied",
  "Interview",
  "Shortlisted",
  "Offer",
  "Rejected",
  "Withdrawn",
] as const;

export const HACKATHON_STATUSES = [
  "Saved",
  "Applied",
  "Shortlisted",
  "In progress",
  "Winner",
  "Not selected",
  "Withdrawn",
] as const;

export const PRIORITIES = ["High", "Medium", "Low"] as const;

export const TASK_STATUSES = ["To do", "In progress", "Done"] as const;

/** Statuses that still count as "active" for the hub card counts. */
export const ACTIVE_JOB_STATUSES = new Set([
  "Saved",
  "Applied",
  "Interview",
  "Shortlisted",
  "Offer",
]);

export const ACTIVE_HACKATHON_STATUSES = new Set([
  "Saved",
  "Applied",
  "Shortlisted",
  "In progress",
  "Winner",
]);
