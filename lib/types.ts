export type JobApplication = {
  id: string;
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
};

export type Hackathon = {
  id: string;
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
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  status: "To do" | "In progress" | "Done";
  priority: string;
  due_date: string | null;
  category: string | null;
  related_type: "job" | "hackathon" | null;
  related_name: string | null;
};

export type Note = {
  id: string;
  title: string;
  content: string | null;
  pinned: boolean;
  color: string;
  private: boolean;
  updated_at: string;
};

/** Columns needed to render and mutate the notes list without loading row metadata. */
export type NoteListItem = Pick<
  Note,
  "id" | "title" | "content" | "pinned" | "color" | "private" | "updated_at"
>;

export type DropdownOption = {
  id: string;
  section: "jobs" | "hackathons";
  field_name: string;
  value: string;
};

export type LearningTrack = {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  status: "In progress" | "Completed" | "On hold";
  created_at: string;
};

export type TrackPhase = {
  id: string;
  track_id: string;
  position: number;
  title: string;
  description: string | null;
};

export type TrackItem = {
  id: string;
  track_id: string;
  phase_id: string;
  position: number;
  title: string;
  description: string | null;
  resource_url: string | null;
  target_date: string | null;
  status: "To do" | "In progress" | "Done";
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
