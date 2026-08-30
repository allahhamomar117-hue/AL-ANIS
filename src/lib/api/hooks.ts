/**
 * Custom Hooks للاتصال بخادم الأنيس المحلي (مجلد server).
 * كلها مبنية على TanStack Query: تخزين مؤقت، إعادة جلب، وإبطال تلقائي بعد التعديل.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { awqafApi, halaqatApi, statisticsApi, studentsApi, usersApi } from "./index";
import { qk } from "./queryKeys";
import type { AwqafStatus, Halaqa, HalaqaStudent, Role, Student } from "./types";

/* ==================== الحلقات ==================== */

export function useHalaqat(params?: { mine?: boolean; active?: boolean }) {
  return useQuery({
    queryKey: qk.halaqat.list(params),
    queryFn: () => halaqatApi.list(params),
    select: (res) => res.data,
  });
}

export function useHalaqa(id: number | undefined) {
  return useQuery({
    queryKey: qk.halaqat.detail(id!),
    queryFn: () => halaqatApi.get(id!),
    select: (res) => res.data,
    enabled: Number.isFinite(id),
  });
}

/** طلاب حلقة واحدة مع آخر تسميع — يغذّي شبكة بطاقات الطلاب. */
export function useHalaqaStudents(id: number | undefined) {
  return useQuery({
    queryKey: qk.halaqat.students(id!),
    queryFn: () => halaqatApi.students(id!),
    select: (res) => res.data,
    enabled: Number.isFinite(id),
  });
}

export function useCreateHalaqa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof halaqatApi.create>[0]) => halaqatApi.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.halaqat.all });
    },
  });
}

export function useUpdateHalaqa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Parameters<typeof halaqatApi.update>[1]) =>
      halaqatApi.update(id, body),
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: qk.halaqat.all });
      void qc.invalidateQueries({ queryKey: qk.halaqat.detail(vars.id) });
    },
  });
}

export function useDeleteHalaqa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reassignTo }: { id: number; reassignTo?: number }) =>
      halaqatApi.remove(id, reassignTo ? { reassignTo } : undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.halaqat.all });
      void qc.invalidateQueries({ queryKey: qk.students.all });
    },
  });
}

/* ==================== الطلاب ==================== */

export function useStudents(params?: {
  halaqaId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: qk.students.list(params),
    queryFn: () => studentsApi.list(params),
  });
}

export function useStudent(id: number | undefined) {
  return useQuery({
    queryKey: qk.students.detail(id!),
    queryFn: () => studentsApi.get(id!),
    enabled: Number.isFinite(id),
  });
}

export function useStudentPoints(id: number | undefined) {
  return useQuery({
    queryKey: qk.students.points(id!),
    queryFn: () => studentsApi.points(id!),
    enabled: Number.isFinite(id),
  });
}

/** يبطل كل ما يتأثر بتغيّر بيانات طالب: القوائم، عدد طلاب الحلقة، والتقارير. */
function invalidateStudent(qc: ReturnType<typeof useQueryClient>, id?: number) {
  void qc.invalidateQueries({ queryKey: qk.students.all });
  void qc.invalidateQueries({ queryKey: qk.halaqat.all });
  void qc.invalidateQueries({ queryKey: qk.reports.all });
  if (id !== undefined) {
    void qc.invalidateQueries({ queryKey: qk.students.detail(id) });
    void qc.invalidateQueries({ queryKey: qk.students.points(id) });
  }
}

/** رفع صورة الطالب. يبطل نفس ما يبطله تعديل بياناته فتظهر في كل القوائم. */
export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: string }) =>
      studentsApi.uploadAvatar(id, data),
    onSuccess: (_res, vars) => invalidateStudent(qc, vars.id),
  });
}

export function useRemoveAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number }) => studentsApi.removeAvatar(id),
    onSuccess: (_res, vars) => invalidateStudent(qc, vars.id),
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof studentsApi.create>[0]) => studentsApi.create(body),
    onSuccess: () => invalidateStudent(qc),
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Parameters<typeof studentsApi.update>[1]) =>
      studentsApi.update(id, body),
    onSuccess: (_res, vars) => invalidateStudent(qc, vars.id),
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, hard }: { id: number; hard?: boolean }) => studentsApi.remove(id, hard),
    onSuccess: (_res, vars) => invalidateStudent(qc, vars.id),
  });
}

export function useTransferStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, halaqaId }: { id: number; halaqaId: number }) =>
      studentsApi.transfer(id, halaqaId),
    onSuccess: (_res, vars) => invalidateStudent(qc, vars.id),
  });
}

/* ==================== النقاط ==================== */

export function useAddPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount, reason }: { id: number; amount: number; reason?: string }) =>
      studentsApi.addPoints(id, amount, reason),
    onSuccess: (_res, vars) => invalidateStudent(qc, vars.id),
  });
}

export function useDeductPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount, reason }: { id: number; amount: number; reason?: string }) =>
      studentsApi.deductPoints(id, amount, reason),
    onSuccess: (_res, vars) => invalidateStudent(qc, vars.id),
  });
}

/* ==================== الكادر (أساتذة ومشرفون) ==================== */

/**
 * دليل الكادر. المسار محصور بالمدير على الخادم، فنعطّل الاستعلام لغيره
 * بدل إرسال طلب يُردّ بـ403.
 */
export function useStaff(params?: { role?: Role; includeInactive?: boolean }, enabled = true) {
  return useQuery({
    queryKey: qk.users.list(params),
    queryFn: () => usersApi.list(params),
    select: (res) => res.data,
    enabled,
  });
}

/** الأساتذة فقط — لقوائم اختيار أستاذ الحلقة. */
export function useTeachers(enabled = true) {
  return useStaff({ role: "TEACHER" }, enabled);
}

/**
 * الحلقات المسندة إلى مستخدم — تُقرأ عند فتح نافذة التعديل لتُملأ بها
 * الرقاقات؛ بدونها كانت تبدأ فارغة فيمحو أول تعديل بقية الإسنادات.
 */
export function useUserHalaqat(id: number | undefined) {
  return useQuery({
    queryKey: qk.users.halaqat(id!),
    queryFn: () => usersApi.halaqat(id!),
    select: (res) => res.data,
    enabled: Number.isFinite(id),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof usersApi.create>[0]) => usersApi.create(body),
    onSuccess: () => invalidateStaff(qc),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Parameters<typeof usersApi.update>[1]) =>
      usersApi.update(id, body),
    onSuccess: () => invalidateStaff(qc),
  });
}

/** تعيين كلمة مرور جديدة لحساب كادر (المدير وحده). */
export function useSetUserPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      usersApi.setPassword(id, password),
    onSuccess: () => invalidateStaff(qc),
  });
}

/** تعطيل حساب (بلا حذف). */
export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => usersApi.deactivate(id),
    onSuccess: () => invalidateStaff(qc),
  });
}

/**
 * حذف نهائي لحساب كادر — لا رجعة فيه.
 *
 * الحضور والتسميع والنقاط تبقى مسجّلة بلا صاحب، والحلقة تصبح بلا أستاذ،
 * فتُبطَل ذواكر الطلاب والتقارير أيضاً لا الكادر وحده.
 */
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: () => {
      invalidateStaff(qc);
      void qc.invalidateQueries({ queryKey: qk.attendance.all });
      void qc.invalidateQueries({ queryKey: qk.reports.all });
    },
  });
}

/** إسناد حلقات إلى مستخدم. */
export function useAssignHalaqat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, halaqaIds }: { userId: number; halaqaIds: number[] }) =>
      usersApi.assignHalaqat(userId, halaqaIds),
    onSuccess: () => invalidateStaff(qc),
  });
}

/** تغيّر الكادر يمسّ الحلقات أيضاً (أستاذ الحلقة وعدد حلقاته). */
function invalidateStaff(qc: ReturnType<typeof useQueryClient>) {
  // qk.users.all يشمل قوائم الكادر وحلقات كل مستخدم (users/:id/halaqat)
  void qc.invalidateQueries({ queryKey: qk.users.all });
  void qc.invalidateQueries({ queryKey: qk.halaqat.all });
}

/* ==================== شهادات وسبر الأوقاف ==================== */

/**
 * سجلّات سبر الأوقاف. المسار محصور بالمدير على الخادم، فيُعطَّل الاستعلام
 * لغيره بدل إرسال طلب يُردّ بـ403 (نفس نهج useStaff).
 */
export function useAwqafRecords(
  params?: { month?: string; status?: AwqafStatus; halaqaId?: number },
  enabled = true
) {
  return useQuery({
    queryKey: qk.awqaf.list(params),
    queryFn: () => awqafApi.list(params),
    enabled,
  });
}

export function useCreateAwqafRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof awqafApi.create>[0]) => awqafApi.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.awqaf.all });
    },
  });
}

export function useUpdateAwqafRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Parameters<typeof awqafApi.update>[1]) =>
      awqafApi.update(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.awqaf.all });
    },
  });
}

export function useDeleteAwqafRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => awqafApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.awqaf.all });
    },
  });
}

/* ==================== لوحة الإحصاءات ==================== */

/**
 * تجميعات الإحصاءات الشاملة. المسار محصور بالمدير على الخادم، فيُعطَّل
 * الاستعلام لغيره بدل إرسال طلب يُردّ بـ403 (نفس نهج useStaff).
 */
export function useStatistics(enabled = true) {
  return useQuery({
    queryKey: qk.statistics.dashboard,
    queryFn: () => statisticsApi.dashboard(),
    select: (res) => res.data,
    enabled,
  });
}

/* ==================== مساعدات العرض ==================== */

/** الحروف الأولى من الاسم — تُستخدم في الصور الرمزية. */
export function initialsOf(name: string, count = 2): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, count)
    .map((part) => part[0])
    .join(" ");
}

export type { Halaqa, HalaqaStudent, Student };
