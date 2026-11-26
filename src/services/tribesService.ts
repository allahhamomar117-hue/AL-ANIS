import type {
  Badge,
  Tribe,
  TribeBadge,
  TribeFlagSettings,
  TribeFlagRule,
  TribeLog,
  TribeStudent,
} from "@/types/tribes";
import { studentsApi } from "@/lib/api";
import { handleDemoTableRequest } from "@/demo/demoApi";
import { isDemoMode } from "@/demo/demoStore";

type NewRecord<T extends { id: number }> = Omit<T, "id">;
type RecordChanges<T extends { id: number }> = Partial<NewRecord<T>>;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function request<T>(
  table: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  params: Record<string, string> = {},
  body?: unknown,
  prefer = "return=representation",
): Promise<T> {
  if (isDemoMode()) {
    return handleDemoTableRequest<T>(table, method, params, body);
  }

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  const search = new URLSearchParams({ select: "*", ...params });
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${search}`, {
    method,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      ...(body ? { "Content-Type": "application/json", Prefer: prefer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${details}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function createTableService<T extends { id: number }>(table: string) {
  return {
    list: () => request<T[]>(table, "GET"),
    get: async (id: number) => {
      const rows = await request<T[]>(table, "GET", { id: `eq.${id}` });
      return rows[0] ?? null;
    },
    create: async (record: NewRecord<T>) => {
      const rows = await request<T[]>(table, "POST", {}, record);
      if (!rows[0]) throw new Error(`Supabase did not return the created ${table} record.`);
      return rows[0];
    },
    update: async (id: number, changes: RecordChanges<T>) => {
      const rows = await request<T[]>(table, "PATCH", { id: `eq.${id}` }, changes);
      if (!rows[0]) throw new Error(`No ${table} record found with id ${id}.`);
      return rows[0];
    },
  };
}

export const tribesService = createTableService<Tribe>("tribes");
export const badgesService = createTableService<Badge>("badges");
export const tribeBadgesService = createTableService<TribeBadge>("tribe_badges");
export const tribeFlagSettingsService = {
  get: async () => {
    const rows = await request<TribeFlagSettings[]>("tribe_flag_settings", "GET", {
      id: "eq.1",
    });
    if (!rows[0]) throw new Error("Tribe flag settings (id=1) were not found.");
    return rows[0];
  },
  update: async (changes: Partial<Omit<TribeFlagSettings, "id">>) => {
    const rows = await request<TribeFlagSettings[]>(
      "tribe_flag_settings",
      "PATCH",
      { id: "eq.1" },
      changes,
    );
    if (!rows[0]) throw new Error("Tribe flag settings (id=1) were not updated.");
    return rows[0];
  },
};

export const deleteTribe = (id: number) =>
  request<void>("tribes", "DELETE", { id: `eq.${id}` });

export const deleteBadge = (id: number) =>
  request<void>("badges", "DELETE", { id: `eq.${id}` });

export const tribeStudentsService = {
  list: () => request<TribeStudent[]>("tribe_students", "GET"),
  assign: async (studentId: number, tribeId: number) => {
    const rows = await request<TribeStudent[]>(
      "tribe_students",
      "POST",
      { on_conflict: "student_id" },
      { student_id: studentId, tribe_id: tribeId },
      "resolution=merge-duplicates,return=representation",
    );
    if (!rows[0]) throw new Error("Supabase did not return the saved tribe assignment.");
    return rows[0];
  },
  unassign: (studentId: number) =>
    request<void>("tribe_students", "DELETE", { student_id: `eq.${studentId}` }),
};

export const tribeLogsService = {
  list: (tribeId?: number) =>
    request<TribeLog[]>("tribe_logs", "GET", {
      ...(tribeId === undefined ? {} : { tribe_id: `eq.${tribeId}` }),
      order: "created_at.desc",
      limit: "50",
    }),
  create: async (record: Omit<TribeLog, "id" | "created_at"> & { created_at?: string }) => {
    const rows = await request<TribeLog[]>("tribe_logs", "POST", {}, record);
    if (!rows[0]) throw new Error("Supabase did not return the created tribe log.");
    return rows[0];
  },
};

async function changeTribeScore(tribeId: number, delta: number): Promise<Tribe> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const tribe = await tribesService.get(tribeId);
    if (!tribe) throw new Error(`No tribe found with id ${tribeId}.`);

    const rows = await request<Tribe[]>(
      "tribes",
      "PATCH",
      { id: `eq.${tribeId}`, score: `eq.${tribe.score}` },
      { score: tribe.score + delta },
    );
    if (rows[0]) return rows[0];
  }

  throw new Error("Could not update the tribe score after repeated concurrent changes.");
}

export async function awardBadgeToTribe(
  tribeId: number,
  badgeId: number,
  note: string,
  actorName: string,
): Promise<TribeLog> {
  const [tribe, badge, existingAwards] = await Promise.all([
    tribesService.get(tribeId),
    badgesService.get(badgeId),
    request<TribeBadge[]>("tribe_badges", "GET", {
      tribe_id: `eq.${tribeId}`,
      badge_id: `eq.${badgeId}`,
      limit: "1",
    }),
  ]);
  if (!tribe) throw new Error("The selected tribe was not found.");
  if (!badge) throw new Error("The selected badge was not found.");
  if (existingAwards.length > 0) {
    throw new Error("This tribe has already earned that badge.");
  }

  const tribeBadge = await tribeBadgesService.create({
    tribe_id: tribeId,
    badge_id: badgeId,
    earned_at: new Date().toISOString(),
  });
  let scoreChanged = false;

  try {
    await changeTribeScore(tribeId, badge.required_flags);
    scoreChanged = true;
    const trimmedNote = note.trim();
    return await tribeLogsService.create({
      tribe_id: tribeId,
      student_id: null,
      student_name: actorName,
      flags_added: badge.required_flags,
      reason: `منح درع «${badge.title}» لقبيلة «${tribe.name}»${trimmedNote ? `: ${trimmedNote}` : ""}`,
    });
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    if (scoreChanged) {
      try {
        await changeTribeScore(tribeId, -badge.required_flags);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    try {
      await request<void>("tribe_badges", "DELETE", {
        id: `eq.${tribeBadge.id}`,
      });
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }
    if (rollbackErrors.length > 0) {
      throw new Error(
        "Badge award failed and could not be fully rolled back; manual reconciliation is required.",
      );
    }
    throw error;
  }
}

/**
 * Adds flags to the student's assigned tribe and records the event.
 * Call after recitationsApi.create succeeds in RecitationRegistration; to keep
 * saving the recitation independent, run it in the background, for example:
 * `void awardTribeFlags(String(studentId), "حفظ تسميع", 1).catch(console.error);`
 */
export async function awardTribeFlags(
  studentId: string,
  actionText: string,
  flagsCount: number,
): Promise<TribeLog | null> {
  const parsedStudentId = Number(studentId);
  if (!Number.isSafeInteger(parsedStudentId) || parsedStudentId <= 0) {
    throw new Error("A valid numeric student id is required to award tribe flags.");
  }
  if (!Number.isSafeInteger(flagsCount) || flagsCount <= 0) {
    throw new Error("The flags count must be a positive integer.");
  }
  if (!actionText.trim()) throw new Error("An event reason is required to award tribe flags.");

  const assignments = await request<TribeStudent[]>("tribe_students", "GET", {
    student_id: `eq.${parsedStudentId}`,
    limit: "1",
  });
  const assignment = assignments[0];
  if (!assignment) return null;
  const studentResult = await studentsApi.get(parsedStudentId);

  await changeTribeScore(assignment.tribe_id, flagsCount);

  try {
    return await tribeLogsService.create({
      tribe_id: assignment.tribe_id,
      student_id: parsedStudentId,
      student_name: studentResult.data.name,
      flags_added: flagsCount,
      reason: actionText.trim(),
    });
  } catch (error) {
    try {
      await changeTribeScore(assignment.tribe_id, -flagsCount);
    } catch {
      throw new Error("The tribe log failed and the score could not be rolled back; manual reconciliation is required.");
    }
    throw error;
  }
}

export async function awardTribeFlagsForEvent(
  studentIds: number[],
  rule: TribeFlagRule,
  multiplier: number,
  actionText: string,
): Promise<void> {
  if (studentIds.length === 0 || multiplier === 0) return;
  if (!Number.isSafeInteger(multiplier) || multiplier < 0) {
    throw new Error("The flag multiplier must be a non-negative integer.");
  }

  const settings = await tribeFlagSettingsService.get();
  const flagsCount = settings[rule] * multiplier;
  if (!Number.isSafeInteger(flagsCount) || flagsCount < 0) {
    throw new Error(`The configured value for ${rule} must be a non-negative integer.`);
  }
  if (flagsCount === 0) return;

  const results = await Promise.allSettled(
    studentIds.map((studentId) =>
      awardTribeFlags(String(studentId), actionText, flagsCount),
    ),
  );
  const failedAwards = results.filter((result) => result.status === "rejected").length;
  if (failedAwards > 0) {
    throw new Error(`Could not record tribe flags for ${failedAwards} student(s).`);
  }
}