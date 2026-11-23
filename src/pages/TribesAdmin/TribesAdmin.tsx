import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Check,
  Flag,
  GraduationCap,
  Pencil,
  Plus,
  Save,
  Settings,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Navigate, useParams } from "react-router-dom";
import { halaqatApi, studentsApi } from "@/lib/api";
import type { Student } from "@/lib/api/types";
import { useAuth } from "@/context/authContext";
import { ErrorState, LoadingState } from "@/shared/QueryState";
import {
  awardBadgeToTribe,
  badgesService,
  deleteBadge,
  deleteTribe,
  tribeStudentsService,
  tribeFlagSettingsService,
  tribesService,
} from "@/services/tribesService";
import type {
  Badge,
  Tribe,
  TribeFlagRule,
  TribeFlagSettings,
} from "@/types/tribes";

type Tab = "tribes" | "badges" | "students" | "award" | "settings";
type TribeFields = Omit<Tribe, "id">;
type BadgeFields = Omit<Badge, "id">;
type AwardFields = { tribeId: number | ""; badgeId: number | ""; note: string };
type SettingsChanges = Partial<Omit<TribeFlagSettings, "id">>;

const emptyTribe: TribeFields = {
  name: "",
  score: 0,
  theme_color: "#15803d",
  bg_image_url: "",
};

const emptyBadge: BadgeFields = {
  title: "",
  required_flags: 1,
  icon_url: "",
  description: "",
};

const tabs: { id: Tab; label: string; icon: typeof Flag }[] = [
  { id: "tribes", label: "إدارة القبائل", icon: Flag },
  { id: "badges", label: "الدروع والمهام", icon: Shield },
  { id: "students", label: "توزيع الطلاب", icon: Users },
  { id: "award", label: "منح درع لقبيلة", icon: Award },
  { id: "settings", label: "إعدادات الرايات", icon: Settings },
];

const flagSettingFields: { key: TribeFlagRule; label: string }[] = [
  { key: "student_attendance", label: "حضور الطالب" },
  { key: "excellent_page", label: "صفحة ممتاز" },
  { key: "good_page", label: "صفحة جيد" },
  { key: "medium_page", label: "صفحة وسط" },
  { key: "assignment_completion", label: "إنجاز مقرر" },
  { key: "awqaf_certificate", label: "شهادة أوقاف" },
];

async function fetchAllActiveStudents(): Promise<Student[]> {
  const students: Student[] = [];
  let offset = 0;
  let total = 0;

  do {
    const page = await studentsApi.list({
      status: "active",
      limit: 200,
      offset,
    });
    students.push(...page.data);
    total = page.meta.total;
    offset += page.meta.limit;
  } while (offset < total);

  return students;
}

export default function TribesAdmin() {
  const queryClient = useQueryClient();
  const { canManageUsers, isSuperAdmin, isTeacher, user } = useAuth();
  const { lang = "ar" } = useParams();
  const isGeneralManager = canManageUsers && isSuperAdmin;
  const teacherHalaqatQuery = useQuery({
    queryKey: ["tribes-admin", "teacher-halaqat"],
    queryFn: () => halaqatApi.list({ mine: true }),
    enabled: isTeacher,
  });
  const canTeacherAward =
    isTeacher &&
    (teacherHalaqatQuery.data?.data ?? []).some(
      (halaqa) =>
        halaqa.stage === "middle_high" || halaqa.stage === "intensive",
    );
  const canUsePage = isGeneralManager || canTeacherAward;
  const visibleTabs = isGeneralManager
    ? tabs
    : tabs.filter((tab) => tab.id === "award");
  const [activeTab, setActiveTab] = useState<Tab>(
    isGeneralManager ? "tribes" : "award",
  );
  const [editingTribe, setEditingTribe] = useState<Tribe | null>(null);
  const [tribeForm, setTribeForm] = useState<TribeFields>(emptyTribe);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [badgeForm, setBadgeForm] = useState<BadgeFields>(emptyBadge);
  const [studentTribes, setStudentTribes] = useState<
    Record<number, number | "">
  >({});
  const [awardForm, setAwardForm] = useState<AwardFields>({
    tribeId: "",
    badgeId: "",
    note: "",
  });
  const [settingsChanges, setSettingsChanges] = useState<SettingsChanges>({});

  const tribesQuery = useQuery({
    queryKey: ["tribes-admin", "tribes"],
    queryFn: () => tribesService.list(),
    enabled: canUsePage,
  });
  const badgesQuery = useQuery({
    queryKey: ["tribes-admin", "badges"],
    queryFn: () => badgesService.list(),
    enabled: canUsePage,
  });
  const studentsQuery = useQuery({
    queryKey: ["tribes-admin", "students"],
    queryFn: fetchAllActiveStudents,
    enabled: isGeneralManager,
  });
  const assignmentsQuery = useQuery({
    queryKey: ["tribes-admin", "student-assignments"],
    queryFn: () => tribeStudentsService.list(),
    enabled: isGeneralManager,
  });
  const flagSettingsQuery = useQuery({
    queryKey: ["tribes-admin", "flag-settings"],
    queryFn: () => tribeFlagSettingsService.get(),
    enabled: isGeneralManager,
  });

  const saveTribe = useMutation({
    mutationFn: ({ id, values }: { id: number | null; values: TribeFields }) =>
      id === null
        ? tribesService.create(values)
        : tribesService.update(id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tribes-admin", "tribes"],
      });
      setEditingTribe(null);
      setTribeForm(emptyTribe);
    },
  });

  const saveBadge = useMutation({
    mutationFn: ({ id, values }: { id: number | null; values: BadgeFields }) =>
      id === null
        ? badgesService.create(values)
        : badgesService.update(id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tribes-admin", "badges"],
      });
      setEditingBadge(null);
      setBadgeForm(emptyBadge);
    },
  });

  const awardBadge = useMutation({
    mutationFn: (values: AwardFields) => {
      if (values.tribeId === "" || values.badgeId === "") {
        throw new Error("اختر القبيلة والدرع أولاً.");
      }
      return awardBadgeToTribe(
        values.tribeId,
        values.badgeId,
        values.note,
        user?.name ?? "إدارة القبائل",
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tribes-admin", "tribes"] }),
        queryClient.invalidateQueries({
          queryKey: ["tribes-admin", "tribe-badges"],
        }),
        queryClient.invalidateQueries({ queryKey: ["tribes-public", "logs"] }),
      ]);
      setAwardForm({ tribeId: "", badgeId: "", note: "" });
    },
  });

  const saveFlagSettings = useMutation({
    mutationFn: (changes: SettingsChanges) =>
      tribeFlagSettingsService.update(changes),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tribes-admin", "flag-settings"],
      });
      setSettingsChanges({});
    },
  });

  const removeTribe = useMutation({
    mutationFn: (id: number) => deleteTribe(id),
    onSuccess: async (_result, id) => {
      await queryClient.invalidateQueries({
        queryKey: ["tribes-admin", "tribes"],
      });
      if (editingTribe?.id === id) {
        setEditingTribe(null);
        setTribeForm(emptyTribe);
      }
    },
  });

  const removeBadge = useMutation({
    mutationFn: (id: number) => deleteBadge(id),
    onSuccess: async (_result, id) => {
      await queryClient.invalidateQueries({
        queryKey: ["tribes-admin", "badges"],
      });
      if (editingBadge?.id === id) {
        setEditingBadge(null);
        setBadgeForm(emptyBadge);
      }
    },
  });

  const saveAssignments = useMutation({
    mutationFn: async (
      changes: { studentId: number; tribeId: number | "" }[],
    ) => {
      await Promise.all(
        changes.map(({ studentId, tribeId }) =>
          tribeId === ""
            ? tribeStudentsService.unassign(studentId)
            : tribeStudentsService.assign(studentId, tribeId),
        ),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tribes-admin", "student-assignments"],
      });
      setStudentTribes({});
    },
    onError: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tribes-admin", "student-assignments"],
      });
      setStudentTribes({});
    },
  });

  const tribes = tribesQuery.data ?? [];
  const badges = badgesQuery.data ?? [];
  const students = studentsQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const assignmentByStudent = new Map(
    assignments.map((assignment) => [
      assignment.student_id,
      assignment.tribe_id,
    ]),
  );
  const selectedTribeFor = (studentId: number): number | "" =>
    Object.hasOwn(studentTribes, studentId)
      ? (studentTribes[studentId] ?? "")
      : (assignmentByStudent.get(studentId) ?? "");
  const changedAssignments = students
    .filter(
      (student) =>
        selectedTribeFor(student.id) !==
        (assignmentByStudent.get(student.id) ?? ""),
    )
    .map((student) => ({
      studentId: student.id,
      tribeId: selectedTribeFor(student.id),
    }));
  const selectedAwardBadge = badges.find(
    (badge) => badge.id === awardForm.badgeId,
  );
  const settingValue = (key: TribeFlagRule) =>
    settingsChanges[key] ?? flagSettingsQuery.data?.[key] ?? 0;

  if (isTeacher && teacherHalaqatQuery.isPending) return <LoadingState />;
  if (isTeacher && teacherHalaqatQuery.isError) {
    return (
      <ErrorState
        error={teacherHalaqatQuery.error}
        onRetry={() => void teacherHalaqatQuery.refetch()}
      />
    );
  }
  if (!canUsePage) return <Navigate to={`/${lang}`} replace />;

  const startEditingTribe = (tribe: Tribe) => {
    setEditingTribe(tribe);
    setTribeForm({
      name: tribe.name,
      score: tribe.score,
      theme_color: tribe.theme_color ?? "#15803d",
      bg_image_url: tribe.bg_image_url ?? "",
    });
  };

  const startEditingBadge = (badge: Badge) => {
    setEditingBadge(badge);
    setBadgeForm({
      title: badge.title,
      required_flags: badge.required_flags,
      icon_url: badge.icon_url ?? "",
      description: badge.description ?? "",
    });
  };

  const cancelTribeEdit = () => {
    setEditingTribe(null);
    setTribeForm(emptyTribe);
    saveTribe.reset();
  };

  const cancelBadgeEdit = () => {
    setEditingBadge(null);
    setBadgeForm(emptyBadge);
    saveBadge.reset();
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-50 pb-12 pt-20 text-slate-800 dark:bg-dark-light dark:text-gray-100 md:pt-24"
    >
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-10">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 dark:border-gray-700 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
              <Flag size={17} /> نظام القبائل
            </p>
            <h1 className="text-2xl font-black tracking-normal md:text-3xl">
              {isGeneralManager ? "لوحة إدارة القبائل" : "منح درع لقبيلة"}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-gray-400">
              {isGeneralManager
                ? "إدارة القبائل والأوسمة وتوزيع الطلاب من مكان واحد."
                : "اختر قبيلة ودرعاً لتسجيل الإنجاز وإضافة الرايات."}
            </p>
          </div>
          {isGeneralManager && (
            <div className="grid grid-cols-2 gap-2 sm:min-w-64">
              <Stat label="القبائل" value={tribes.length} icon={Flag} />
              <Stat
                label="الطلاب النشطون"
                value={students.length}
                icon={Users}
              />
            </div>
          )}
        </header>

        <nav
          role="tablist"
          aria-label="أقسام إدارة القبائل"
          className="flex gap-2 overflow-x-auto border-b border-slate-200 dark:border-gray-700"
        >
          {visibleTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`tribes-tab-${id}`}
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={`tribes-panel-${id}`}
              onClick={() => setActiveTab(id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${
                activeTab === id
                  ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        <section
          id={`tribes-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tribes-tab-${activeTab}`}
          className="grid gap-6 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.7fr)]"
        >
          {activeTab === "tribes" && (
            <>
              <form
                className="h-fit space-y-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-dark"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveTribe.mutate({
                    id: editingTribe?.id ?? null,
                    values: tribeForm,
                  });
                }}
              >
                <FormHeading
                  title={editingTribe ? "تعديل قبيلة" : "إضافة قبيلة"}
                />
                <Field label="اسم القبيلة" htmlFor="tribe-name">
                  <input
                    id="tribe-name"
                    required
                    value={tribeForm.name}
                    onChange={(event) =>
                      setTribeForm({ ...tribeForm, name: event.target.value })
                    }
                    className={inputClass}
                    placeholder="مثال: قبيلة النور"
                  />
                </Field>
                <Field label="رصيد الرايات" htmlFor="tribe-score">
                  <input
                    id="tribe-score"
                    type="number"
                    min="0"
                    required
                    value={tribeForm.score}
                    onChange={(event) =>
                      setTribeForm({
                        ...tribeForm,
                        score: Number(event.target.value),
                      })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="لون القبيلة" htmlFor="tribe-color">
                  <div className="flex items-center gap-3">
                    <input
                      id="tribe-color"
                      type="color"
                      value={tribeForm.theme_color || "#15803d"}
                      onChange={(event) =>
                        setTribeForm({
                          ...tribeForm,
                          theme_color: event.target.value,
                        })
                      }
                      className="size-11 cursor-pointer rounded border border-slate-300 bg-white p-1 dark:border-gray-600 dark:bg-dark"
                    />
                    <span
                      className="font-mono text-sm text-slate-500"
                      dir="ltr"
                    >
                      {tribeForm.theme_color}
                    </span>
                  </div>
                </Field>
                <Field label="رابط صورة الخلفية" htmlFor="tribe-background">
                  <input
                    id="tribe-background"
                    type="url"
                    value={tribeForm.bg_image_url ?? ""}
                    onChange={(event) =>
                      setTribeForm({
                        ...tribeForm,
                        bg_image_url: event.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="https://..."
                    dir="ltr"
                  />
                </Field>
                <FormActions
                  editing={Boolean(editingTribe)}
                  saving={saveTribe.isPending}
                  onCancel={cancelTribeEdit}
                />
                {saveTribe.isError && <InlineError error={saveTribe.error} />}
              </form>

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-gray-700 dark:bg-dark">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-gray-700">
                  <h2 className="font-bold">القبائل المسجلة</h2>
                  <span className="text-sm text-slate-500">
                    {tribes.length} قبائل
                  </span>
                </div>
                <DataState
                  loading={tribesQuery.isPending}
                  error={tribesQuery.error}
                  onRetry={() => void tribesQuery.refetch()}
                  empty={tribes.length === 0}
                />
                {removeTribe.isError && (
                  <div className="px-5 pb-3">
                    <InlineError error={removeTribe.error} />
                  </div>
                )}
                {tribes.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-140 text-right text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-gray-800 dark:text-gray-300">
                        <tr>
                          <th className="px-5 py-3 font-semibold">القبيلة</th>
                          <th className="px-5 py-3 font-semibold">الرايات</th>
                          <th className="px-5 py-3 font-semibold">الخلفية</th>
                          <th className="px-5 py-3 font-semibold">إجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                        {tribes.map((tribe) => (
                          <tr key={tribe.id}>
                            <td className="px-5 py-3">
                              <span className="flex items-center gap-2 font-bold">
                                <span
                                  className="size-3 rounded-full"
                                  style={{
                                    backgroundColor:
                                      tribe.theme_color ?? "#94a3b8",
                                  }}
                                />
                                {tribe.name}
                              </span>
                            </td>
                            <td className="px-5 py-3 tabular-nums">
                              {tribe.score}
                            </td>
                            <td
                              className="max-w-40 truncate px-5 py-3 text-slate-500"
                              dir="ltr"
                            >
                              {tribe.bg_image_url || "—"}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  title={`تعديل ${tribe.name}`}
                                  onClick={() => startEditingTribe(tribe)}
                                  className={iconButtonClass}
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  type="button"
                                  title={`حذف ${tribe.name}`}
                                  aria-label={`حذف ${tribe.name}`}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `هل تريد حذف قبيلة «${tribe.name}»؟`,
                                      )
                                    ) {
                                      removeTribe.mutate(tribe.id);
                                    }
                                  }}
                                  className="inline-flex size-9 items-center justify-center rounded-md text-red-600 transition hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "badges" && (
            <>
              <form
                className="h-fit space-y-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-dark"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveBadge.mutate({
                    id: editingBadge?.id ?? null,
                    values: badgeForm,
                  });
                }}
              >
                <FormHeading
                  title={editingBadge ? "تعديل وسام" : "إضافة وسام"}
                />
                <Field label="اسم الوسام" htmlFor="badge-title">
                  <input
                    id="badge-title"
                    required
                    value={badgeForm.title}
                    onChange={(event) =>
                      setBadgeForm({ ...badgeForm, title: event.target.value })
                    }
                    className={inputClass}
                    placeholder="مثال: درع التميز"
                  />
                </Field>
                <Field label="الرايات المطلوبة" htmlFor="badge-flags">
                  <input
                    id="badge-flags"
                    type="number"
                    min="1"
                    required
                    value={badgeForm.required_flags}
                    onChange={(event) =>
                      setBadgeForm({
                        ...badgeForm,
                        required_flags: Number(event.target.value),
                      })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="رابط الأيقونة" htmlFor="badge-icon">
                  <input
                    id="badge-icon"
                    type="url"
                    value={badgeForm.icon_url ?? ""}
                    onChange={(event) =>
                      setBadgeForm({
                        ...badgeForm,
                        icon_url: event.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="https://..."
                    dir="ltr"
                  />
                </Field>
                <Field label="شرح ومهام الدرع" htmlFor="badge-description">
                  <textarea
                    id="badge-description"
                    rows={4}
                    value={badgeForm.description ?? ""}
                    onChange={(event) =>
                      setBadgeForm({
                        ...badgeForm,
                        description: event.target.value,
                      })
                    }
                    className={`${inputClass} resize-y`}
                    placeholder="اشرح للطلاب طريقة الحصول على هذا الدرع..."
                  />
                </Field>
                <FormActions
                  editing={Boolean(editingBadge)}
                  saving={saveBadge.isPending}
                  onCancel={cancelBadgeEdit}
                />
                {saveBadge.isError && <InlineError error={saveBadge.error} />}
              </form>

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-gray-700 dark:bg-dark">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-gray-700">
                  <h2 className="font-bold">الأوسمة والدروع</h2>
                  <span className="text-sm text-slate-500">
                    {badges.length} أوسمة
                  </span>
                </div>
                <DataState
                  loading={badgesQuery.isPending}
                  error={badgesQuery.error}
                  onRetry={() => void badgesQuery.refetch()}
                  empty={badges.length === 0}
                />
                {removeBadge.isError && (
                  <div className="px-5 pb-3">
                    <InlineError error={removeBadge.error} />
                  </div>
                )}
                {badges.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-125 text-right text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-gray-800 dark:text-gray-300">
                        <tr>
                          <th className="px-5 py-3 font-semibold">الوسام</th>
                          <th className="px-5 py-3 font-semibold">
                            الرايات المطلوبة
                          </th>
                          <th className="px-5 py-3 font-semibold">الأيقونة</th>
                          <th className="px-5 py-3 font-semibold">إجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                        {badges.map((badge) => (
                          <tr key={badge.id}>
                            <td className="px-5 py-3">
                              <p className="font-bold">{badge.title}</p>
                              {badge.description && (
                                <p className="mt-1 max-w-sm whitespace-pre-line text-xs font-normal text-slate-500 dark:text-gray-400">
                                  {badge.description}
                                </p>
                              )}
                            </td>
                            <td className="px-5 py-3 tabular-nums">
                              {badge.required_flags}
                            </td>
                            <td
                              className="max-w-40 truncate px-5 py-3 text-slate-500"
                              dir="ltr"
                            >
                              {badge.icon_url || "—"}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  title={`تعديل ${badge.title}`}
                                  onClick={() => startEditingBadge(badge)}
                                  className={iconButtonClass}
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  type="button"
                                  title={`حذف ${badge.title}`}
                                  aria-label={`حذف ${badge.title}`}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `هل تريد حذف الدرع «${badge.title}»؟`,
                                      )
                                    ) {
                                      removeBadge.mutate(badge.id);
                                    }
                                  }}
                                  className="inline-flex size-9 items-center justify-center rounded-md text-red-600 transition hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "students" && (
            <div className="xl:col-span-2 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-gray-700 dark:bg-dark">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-bold">توزيع الطلاب على القبائل</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                    يظهر الطلاب النشطون فقط.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={
                    changedAssignments.length === 0 ||
                    saveAssignments.isPending ||
                    tribes.length === 0
                  }
                  onClick={() => saveAssignments.mutate(changedAssignments)}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saveAssignments.isPending ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <Save size={16} />
                  )}
                  حفظ التوزيع
                  {changedAssignments.length > 0
                    ? ` (${changedAssignments.length})`
                    : ""}
                </button>
              </div>

              {saveAssignments.isSuccess && (
                <div
                  role="status"
                  className="flex items-center gap-2 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                >
                  <Check size={17} /> تم حفظ توزيع الطلاب.
                </div>
              )}
              {saveAssignments.isError && (
                <div className="px-5 pt-4">
                  <InlineError error={saveAssignments.error} />
                </div>
              )}
              <DataState
                loading={
                  studentsQuery.isPending ||
                  assignmentsQuery.isPending ||
                  tribesQuery.isPending
                }
                error={
                  studentsQuery.error ??
                  assignmentsQuery.error ??
                  tribesQuery.error
                }
                onRetry={() => {
                  void studentsQuery.refetch();
                  void assignmentsQuery.refetch();
                  void tribesQuery.refetch();
                }}
                empty={students.length === 0}
                emptyLabel="لا يوجد طلاب نشطون لعرضهم."
              />
              {students.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-155 text-right text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-gray-800 dark:text-gray-300">
                      <tr>
                        <th className="px-5 py-3 font-semibold">الطالب</th>
                        <th className="px-5 py-3 font-semibold">الحلقة</th>
                        <th className="px-5 py-3 font-semibold">القبيلة</th>
                        <th className="px-5 py-3 font-semibold">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                      {students.map((student) => {
                        const selected = selectedTribeFor(student.id);
                        const changed =
                          selected !==
                          (assignmentByStudent.get(student.id) ?? "");
                        return (
                          <tr key={student.id}>
                            <td className="px-5 py-3">
                              <span className="block font-bold">
                                {student.name}
                              </span>
                              <span className="text-xs text-slate-500">
                                {student.code}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-slate-600 dark:text-gray-300">
                              {student.halaqa || "—"}
                            </td>
                            <td className="px-5 py-3">
                              <select
                                aria-label={`قبيلة الطالب ${student.name}`}
                                value={selected}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setStudentTribes((current) => ({
                                    ...current,
                                    [student.id]:
                                      value === "" ? "" : Number(value),
                                  }));
                                  saveAssignments.reset();
                                }}
                                className={`${inputClass} max-w-xs`}
                              >
                                <option value="">بلا قبيلة</option>
                                {tribes.map((tribe) => (
                                  <option key={tribe.id} value={tribe.id}>
                                    {tribe.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-5 py-3">
                              {changed ? (
                                <span className="rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                  غير محفوظ
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  محفوظ
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {!tribesQuery.isPending &&
                tribes.length === 0 &&
                !tribesQuery.isError && (
                  <p className="border-t border-slate-100 px-5 py-4 text-sm text-amber-800 dark:border-gray-700 dark:text-amber-300">
                    أضف قبيلة أولاً حتى تتمكن من توزيع الطلاب.
                  </p>
                )}
            </div>
          )}

          {activeTab === "award" && (
            <div className="xl:col-span-2 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
              <form
                className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-dark"
                onSubmit={(event) => {
                  event.preventDefault();
                  awardBadge.mutate(awardForm);
                }}
              >
                <FormHeading title="منح درع لقبيلة" />
                <Field label="القبيلة" htmlFor="award-tribe">
                  <select
                    id="award-tribe"
                    required
                    value={awardForm.tribeId}
                    onChange={(event) =>
                      setAwardForm({
                        ...awardForm,
                        tribeId:
                          event.target.value === ""
                            ? ""
                            : Number(event.target.value),
                      })
                    }
                    className={inputClass}
                  >
                    <option value="">اختر القبيلة</option>
                    {tribes.map((tribe) => (
                      <option key={tribe.id} value={tribe.id}>
                        {tribe.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="الدرع" htmlFor="award-badge">
                  <select
                    id="award-badge"
                    required
                    value={awardForm.badgeId}
                    onChange={(event) =>
                      setAwardForm({
                        ...awardForm,
                        badgeId:
                          event.target.value === ""
                            ? ""
                            : Number(event.target.value),
                      })
                    }
                    className={inputClass}
                  >
                    <option value="">اختر الدرع</option>
                    {badges.map((badge) => (
                      <option key={badge.id} value={badge.id}>
                        {badge.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="ملاحظة المنح" htmlFor="award-note">
                  <textarea
                    id="award-note"
                    required
                    rows={3}
                    value={awardForm.note}
                    onChange={(event) =>
                      setAwardForm({ ...awardForm, note: event.target.value })
                    }
                    className={`${inputClass} resize-y`}
                    placeholder="اكتب سبب منح الدرع..."
                  />
                </Field>
                {selectedAwardBadge && (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                    سيضاف {selectedAwardBadge.required_flags} راية إلى رصيد
                    القبيلة.
                  </p>
                )}
                {awardBadge.isSuccess && (
                  <p
                    role="status"
                    className="text-sm font-semibold text-emerald-700 dark:text-emerald-300"
                  >
                    تم منح الدرع وتحديث رصيد القبيلة.
                  </p>
                )}
                {awardBadge.isError && <InlineError error={awardBadge.error} />}
                <button
                  type="submit"
                  disabled={
                    awardBadge.isPending ||
                    tribes.length === 0 ||
                    badges.length === 0 ||
                    !awardForm.note.trim()
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Award size={17} />
                  {awardBadge.isPending
                    ? "جارٍ تسجيل المنح..."
                    : "تأكيد منح الدرع"}
                </button>
              </form>

              <aside className="h-fit rounded-lg border border-amber-300/15 bg-amber-300/4 p-5 dark:bg-amber-300/3">
                <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-200">
                  <GraduationCap size={19} /> سجل المنح
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-gray-300">
                  يمنح الدرع كامل عدد الرايات المحدد له، ويسجل اسم مانح الدرع
                  والملاحظة ضمن الأحداث.
                </p>
              </aside>
            </div>
          )}

          {activeTab === "settings" && isGeneralManager && (
            <div className="xl:col-span-2">
              {flagSettingsQuery.isPending ? (
                <LoadingState />
              ) : flagSettingsQuery.isError ? (
                <ErrorState
                  error={flagSettingsQuery.error}
                  onRetry={() => void flagSettingsQuery.refetch()}
                />
              ) : (
                <form
                  className="max-w-3xl space-y-5 rounded-lg border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-dark"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveFlagSettings.mutate(settingsChanges);
                  }}
                >
                  <FormHeading title="إعدادات الرايات" />
                  <p className="text-sm text-slate-500 dark:text-gray-400">
                    تعدّل القيم المستخدمة عند تسجيل الحضور والتسميع وإنجاز
                    المقررات.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {flagSettingFields.map(({ key, label }) => (
                      <Field
                        key={key}
                        label={label}
                        htmlFor={`flag-rule-${key}`}
                      >
                        <input
                          id={`flag-rule-${key}`}
                          type="number"
                          min="0"
                          step="1"
                          required
                          value={settingValue(key)}
                          onChange={(event) =>
                            setSettingsChanges((current) => ({
                              ...current,
                              [key]: Number(event.target.value),
                            }))
                          }
                          className={inputClass}
                        />
                      </Field>
                    ))}
                  </div>
                  {saveFlagSettings.isSuccess && (
                    <p
                      role="status"
                      className="text-sm font-semibold text-emerald-700 dark:text-emerald-300"
                    >
                      تم حفظ إعدادات الرايات.
                    </p>
                  )}
                  {saveFlagSettings.isError && (
                    <InlineError error={saveFlagSettings.error} />
                  )}
                  <button
                    type="submit"
                    disabled={
                      saveFlagSettings.isPending ||
                      Object.keys(settingsChanges).length === 0
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save size={16} />
                    {saveFlagSettings.isPending
                      ? "جارٍ الحفظ..."
                      : "حفظ الإعدادات"}
                  </button>
                </form>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 dark:border-gray-600 dark:bg-gray-800 dark:text-white";
const iconButtonClass =
  "inline-flex size-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-emerald-300";

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Flag;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-dark">
      <span className="flex size-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        <Icon size={17} />
      </span>
      <div>
        <p className="text-lg font-black leading-5 tabular-nums">{value}</p>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-gray-400">
          {label}
        </p>
      </div>
    </div>
  );
}

function FormHeading({ title }: { title: string }) {
  return (
    <h2 className="flex items-center gap-2 border-b border-slate-100 pb-3 font-bold dark:border-gray-700">
      <Plus size={17} className="text-emerald-700 dark:text-emerald-400" />
      {title}
    </h2>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1.5">
      <span className="text-sm font-semibold text-slate-700 dark:text-gray-200">
        {label}
      </span>
      {children}
    </label>
  );
}

function FormActions({
  editing,
  saving,
  onCancel,
}: {
  editing: boolean;
  saving: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <button
        type="submit"
        disabled={saving}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60"
      >
        {editing ? <Save size={16} /> : <Plus size={16} />}
        {saving ? "جارٍ الحفظ..." : editing ? "حفظ التعديلات" : "إضافة"}
      </button>
      {editing && (
        <button
          type="button"
          onClick={onCancel}
          title="إلغاء التعديل"
          className="inline-flex size-10 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <X size={17} />
        </button>
      )}
    </div>
  );
}

function DataState({
  loading,
  error,
  onRetry,
  empty,
  emptyLabel = "لا توجد بيانات بعد.",
}: {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  empty: boolean;
  emptyLabel?: string;
}) {
  if (loading)
    return (
      <p className="px-5 py-10 text-center text-sm text-slate-500">
        جارٍ تحميل البيانات...
      </p>
    );
  if (error) {
    return (
      <div className="space-y-2 px-5 py-8 text-center">
        <InlineError error={error} />
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-bold text-emerald-700 underline dark:text-emerald-300"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }
  if (empty)
    return (
      <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-gray-400">
        {emptyLabel}
      </p>
    );
  return null;
}

function InlineError({ error }: { error: unknown }) {
  return (
    <p
      role="alert"
      className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
    >
      {error instanceof Error ? error.message : "تعذر إكمال العملية."}
    </p>
  );
}
