import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FaTimes, FaUsers } from "react-icons/fa";
import { useCreateHalaqa, useTeachers, useUpdateHalaqa } from "../../lib/api/hooks";
import type { Department, Halaqa, HalaqaStage } from "../../lib/api/types";
import { HALAQA_STAGES } from "../../lib/api/types";
import { useAuth } from "../../context/authContext";
import { departmentToSend } from "../../lib/department";
import DepartmentField from "../../shared/DepartmentField";
import { useToast } from "../../shared/toast/toastContext";

/** إضافة حلقة أو تعديل بياناتها — للمدير وحده (الخادم يرد 403 لغيره). */
export default function PopupHalaqaForm({
  editing,
  onClose,
}: {
  editing?: Halaqa;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { notify } = useToast();

  const isEdit = Boolean(editing);
  const [name, setName] = useState(editing?.name ?? "");
  const [teacherId, setTeacherId] = useState<number | "">(editing?.teacherId ?? "");
  const [stage, setStage] = useState<HalaqaStage | "">(editing?.stage ?? "");
  const [department, setDepartment] = useState<Department | "">(
    editing?.department ?? ""
  );

  const { isSuperAdmin } = useAuth();
  const teachers = useTeachers();
  const create = useCreateHalaqa();
  const update = useUpdateHalaqa();

  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;
  const valid = name.trim().length >= 2;

  const submit = async () => {
    if (!valid || pending) return;

    // مدير القسم لا يرسل الحقل — الخادم يملؤه من قسمه (راجع DepartmentField)
    const dept = departmentToSend(department, isSuperAdmin);

    const body = {
      name: name.trim(),
      teacher_id: teacherId === "" ? null : teacherId,
      stage: stage === "" ? null : stage,
      ...(dept !== undefined ? { department: dept } : {}),
    };

    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...body });
        notify(t("halaqatAdmin.updated"));
      } else {
        await create.mutateAsync(body);
        notify(t("halaqatAdmin.created"));
      }
      onClose();
    } catch {
      // الرسالة تظهر من كائن الخطأ أسفل النموذج
    }
  };

  const fieldClass =
    "w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-light px-4 py-3 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400";
  const labelClass = "mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-600 dark:bg-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-700 dark:text-emerald-400">
            <FaUsers />
            {isEdit ? t("halaqatAdmin.editTitle") : t("halaqatAdmin.addTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-dark-light"
          >
            <FaTimes />
          </button>
        </div>

        {/* الاسم */}
        <div>
          <label className={labelClass}>{t("halaqatAdmin.name")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("halaqatAdmin.namePlaceholder")}
            className={fieldClass}
          />
        </div>

        {/* الأستاذ — القائمة مجلوبة من الكادر لا ثابتة */}
        <div>
          <label className={labelClass}>{t("halaqatAdmin.teacher")}</label>
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value === "" ? "" : Number(e.target.value))}
            className={fieldClass}
          >
            <option value="">{t("halaqatAdmin.noTeacher")}</option>
            {(teachers.data ?? []).map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
        </div>

        {/* المرحلة الدراسية */}
        <div>
          <label className={labelClass}>{t("halaqatAdmin.stage")}</label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value === "" ? "" : (e.target.value as HalaqaStage))}
            className={fieldClass}
          >
            <option value="">{t("halaqatAdmin.noStage")}</option>
            {HALAQA_STAGES.map((option) => (
              <option key={option} value={option}>
                {t(`halaqaStages.${option}`)}
              </option>
            ))}
          </select>
        </div>

        {/*
          القسم بعد المرحلة عمداً وإن تشابها في الشكل: المرحلة وصفٌ
          للحلقة، والقسم يقرّر من يراها — فترتيبُه بعدها يمنع قراءتهما
          حقلين لمعنى واحد.
        */}
        <DepartmentField
          value={department}
          onChange={setDepartment}
          label={t("halaqatAdmin.department")}
          emptyLabel={t("halaqatAdmin.noDepartment")}
          lockedHint={t("halaqatAdmin.departmentLocked")}
          className={fieldClass}
        />

        {/*
          تحذير الحلقة بلا قسم — للمدير العام وحده، فهو الوحيد القادر على
          تركها فارغة. الحلقة بلا قسم لا يراها إلا هو (راجع scope.ts):
          تُنشأ اليوم فتختفي غداً عن مدير قسمها، بلا خطأ يفسّر الاختفاء.
        */}
        {isSuperAdmin && department === "" && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            {t("halaqatAdmin.noDepartmentWarning")}
          </p>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error instanceof Error ? error.message : t("state.error")}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-300 px-5 py-2.5 font-bold text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-dark-light"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!valid || pending}
            className="rounded-xl bg-emerald-600 px-6 py-2.5 font-bold text-white shadow transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending ? t("halaqatAdmin.saving") : t("halaqatAdmin.save")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
