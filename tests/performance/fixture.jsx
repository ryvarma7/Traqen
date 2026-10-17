import * as React from "react";
import { createRoot } from "react-dom/client";
import { MotionProvider } from "../../components/shared/motion-provider";
import { ApplicationsView } from "../../components/applications/applications-view";
import { TasksView } from "../../components/tasks/tasks-view";
import { NotesView } from "../../components/notes/notes-view";
import { CalendarView } from "../../components/calendar/calendar-view";
import { TracksView } from "../../components/tracks/tracks-view";
import { TrackDetailView } from "../../components/tracks/track-detail-view";
import { AuthBackground } from "../../components/auth/auth-background";
import { TasksPanel } from "../../components/hub/tasks-panel";
import { NotesCarousel } from "../../components/hub/notes-carousel";
import { CalendarTimeline } from "../../components/hub/calendar-timeline";
import { NavLoader, beginNav } from "../../components/shell/nav-loader";

const count = 120;
const notes = Array.from({ length: count }, (_, i) => ({
  id: `note-${i}`, title: `Synthetic note ${i}`, content: `Synthetic preview ${i}\nSecond line`,
  private: i === 1, color: "gray", pinned: false, updated_at: "2026-10-17T12:00:00Z",
}));
const tasks = Array.from({ length: count }, (_, i) => ({
  id: `task-${i}`, title: `Synthetic task ${i}`, description: "Synthetic task body",
  status: "To do", priority: "Medium", due_date: null, notes: null,
}));
const jobs = Array.from({ length: count }, (_, i) => ({
  id: `job-${i}`, company: `Synthetic company ${i}`, status: "Applied", priority: "Medium",
  deadline: null, follow_up_date: null, notes: null,
}));
const tracks = Array.from({ length: 30 }, (_, i) => ({
  id: `track-${i}`, title: `Synthetic track ${i}`, description: "Synthetic plan",
  start_date: "2026-10-17", status: "In progress", done: 4, total: 10, created_at: "2026-10-17",
}));
const phases = [{ id: "phase-0", track_id: "track-0", title: "Synthetic phase", description: null, position: 0 }];
const items = Array.from({ length: 20 }, (_, i) => ({ id: `step-${i}`, phase_id: "phase-0", track_id: "track-0",
  title: `Synthetic step ${i}`, description: null, position: i, status: "To do", target_date: null, resource_url: null }));
const date = new Date();
const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const eventsByDate = { [today]: [{ id: "event", title: "Synthetic event", meta: "Test", source: "task", href: "/tasks", done: false }] };

function Fixture() {
  const section = new URLSearchParams(location.search).get("section") || "notes";
  React.useEffect(() => { window.fixtureReady = true; }, []);
  return <MotionProvider><main className="app-scene p-4">
    {section === "notes" && <NotesView notes={notes} />}
    {section === "tasks" && <TasksView tasks={tasks} />}
    {section === "applications" && <ApplicationsView jobs={jobs} hackathons={[]} dropdownOptions={[]} />}
    {section === "calendar" && <CalendarView eventsByDate={eventsByDate} />}
    {section === "tracks" && <TracksView tracks={tracks} />}
    {section === "track-detail" && <TrackDetailView track={tracks[0]} phases={phases} items={items} />}
    {section === "auth" && <AuthBackground />}
    {section === "hub" && <div><TasksPanel tasks={tasks.slice(0, 5)} /><NotesCarousel notes={notes.slice(0, 24)} /><CalendarTimeline eventsByDate={eventsByDate} /></div>}
    {section === "shell" && <div className="relative" style={{ width: "100%", height: 5000 }}><button onClick={beginNav}>Start navigation</button><NavLoader /></div>}
  </main></MotionProvider>;
}
createRoot(document.getElementById("root")).render(<Fixture />);
