import * as React from "react";

// Only network/router boundaries are replaced. React, Motion, UI and CSS are real.
export default function Link({ children, ...props }) { return <a {...props}>{children}</a>; }
export const useRouter = () => ({ push() {}, refresh() {} });
export const usePathname = () => "/notes";
export const useSearchParams = () => new URLSearchParams();
export function useCreateShortcut() {}
export function usePendingCreate() {}
export const toast = Object.assign(() => {}, { success() {}, error() {}, dismiss() {} });
export const setTaskStatus = async () => ({});
export const saveNote = async () => ({});
export const deleteNote = async () => ({});
export const updateNotePrivacy = async () => window.__privacyFail ? { error: "Synthetic write failure" } : {};
export const saveHackathonNotes = async () => ({});
export const saveJobApplicationNotes = async () => ({});
export const deleteTrack = async () => ({});
export const createTrack = async () => ({});
export const importTrack = async () => ({});
export const setTrackItemStatus = async () => ({});
export const setTrackStatus = async () => ({});
export const rescheduleTrack = async () => ({});
export const rescheduleTrackItems = async () => ({});
export const saveTask = async () => ({});
export const deleteTask = async () => ({});
export const saveTaskNotes = async () => ({});
export const saveJobApplication = async () => ({});
export const deleteJobApplication = async () => ({});
export const saveHackathon = async () => ({});
export const deleteHackathon = async () => ({});
export const addDropdownOption = async () => ({});
