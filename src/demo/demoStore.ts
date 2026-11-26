import type { AuthUser } from "../lib/api/types";
import {
  createInitialDemoData,
  toDemoUser,
  type DemoData,
  type DemoRole,
} from "./mockData";

const STORAGE_KEY = "anis.demo";
const DATA_VERSION = 3;

export interface DemoSnapshot {
  dataVersion: number;
  isDemoMode: boolean;
  demoRole: DemoRole;
  data: DemoData;
}

const listeners = new Set<() => void>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDemoData(value: unknown): value is DemoData {
  if (!isRecord(value)) return false;
  return [
    "students",
    "halaqat",
    "attendanceSessions",
    "pointTransactions",
    "assignments",
    "recitations",
    "staff",
    "tribes",
    "badges",
    "tribeBadges",
    "tribeStudents",
    "tribeLogs",
    "recentActivity",
  ].every((key) => Array.isArray(value[key])) && isRecord(value.tribeFlagSettings);
}

function readStoredSnapshot(): DemoSnapshot {
  const defaults = createInitialDemoData();
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!isRecord(stored)) return { dataVersion: DATA_VERSION, isDemoMode: false, demoRole: "ADMIN", data: defaults };

    const role = stored.demoRole;
    const demoRole: DemoRole = role === "TEACHER" || role === "SUPERVISOR" ? role : "ADMIN";
    const isDemoMode = stored.isDemoMode === true;
    if (stored.dataVersion !== DATA_VERSION) {
      return { dataVersion: DATA_VERSION, isDemoMode, demoRole, data: defaults };
    }
    return {
      dataVersion: DATA_VERSION,
      isDemoMode,
      demoRole,
      data: isDemoData(stored.data) ? stored.data : defaults,
    };
  } catch {
    return { dataVersion: DATA_VERSION, isDemoMode: false, demoRole: "ADMIN", data: defaults };
  }
}

let snapshot = readStoredSnapshot();

function publish(next: DemoSnapshot): void {
  snapshot = next;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Private browsing or a full storage quota: keep the current session usable.
    }
  }
  listeners.forEach((listener) => listener());
}

export function getDemoSnapshot(): DemoSnapshot {
  return snapshot;
}

export function subscribeDemoStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isDemoMode(): boolean {
  return snapshot.isDemoMode;
}

export function getDemoRole(): DemoRole {
  return snapshot.demoRole;
}

export function getDemoUser(): AuthUser | null {
  return snapshot.isDemoMode ? toDemoUser(snapshot.demoRole) : null;
}

export function activateDemoMode(role: DemoRole = "ADMIN"): void {
  try {
    localStorage.removeItem("anis.token");
  } catch {
    // Demo mode does not depend on authentication storage.
  }
  publish({ ...snapshot, isDemoMode: true, demoRole: role });
}

export function setDemoRole(role: DemoRole): void {
  if (snapshot.isDemoMode) publish({ ...snapshot, demoRole: role });
}

export function updateDemoData(update: (data: DemoData) => void): void {
  if (!snapshot.isDemoMode) throw new Error("Demo mode is not active.");
  const data = structuredClone(snapshot.data);
  update(data);
  publish({ ...snapshot, data });
}

export function resetDemoData(): void {
  if (!snapshot.isDemoMode) return;
  publish({ ...snapshot, data: createInitialDemoData() });
}

export function exitDemoMode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("anis.token");
  } catch {
    // The in-memory state is still cleared if storage is unavailable.
  }
  snapshot = { dataVersion: DATA_VERSION, isDemoMode: false, demoRole: "ADMIN", data: createInitialDemoData() };
  listeners.forEach((listener) => listener());
}

export function initializeDemoFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.get("demo") !== "true") return;
  activateDemoMode("ADMIN");
  url.searchParams.delete("demo");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export { type DemoRole } from "./mockData";