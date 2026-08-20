import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaCamera, FaTrash } from "react-icons/fa";
import { useHalaqat, useRemoveAvatar, useUpdateStudent, useUploadAvatar } from "../../lib/api/hooks";
import { useToast } from "../../shared/toast/toastContext";
import Avatar from "../../shared/Avatar";
import { ACCEPTED_TYPES, resizeImage } from "../../lib/image/resize";
import type { Student } from "../../lib/api/types";

type EditStudentPopupProps = {
  student: Student;
  onClose: () => void;
};

export function PopupEditStudent({ student, onClose }: EditStudentPopupProps) {
  const { t } = useTranslation();
  const { data: halaqat = [] } = useHalaqat();
  const updateStudent = useUpdateStudent();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();
  const { notify } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(student.name);
  const [halaqaId, setHalaqaId] = useState<number | "">(student.halaqaId ?? "");
  const [birthDate, setBirthDate] = useState(student.birthDate ?? "");
  const [studentPhone, setStudentPhone] = useState(student.studentPhone ?? "");
  const [parentPhone, setParentPhone] = useState(student.parentPhone ?? "");

  /**
   * الصورة تُدار محلياً حتى الحفظ:
   * - pendingPhoto: صورة مختارة مصغَّرة، تُرفع عند "حفظ".
   * - clearPhoto: طلب إزالة الصورة الحالية.
   * هكذا يبقى "إلغاء" إلغاءً حقيقياً ولا تتغيّر بيانات الطالب قبل تأكيده.
   */
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [clearPhoto, setClearPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");

  const shownPhoto = pendingPhoto ?? (clearPhoto ? null : student.avatarUrl);

  const handlePickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError("");

    try {
      // التصغير في المتصفح: صور الهواتف بالميغابايتات وتُعرض هنا بحجم 100px
      setPendingPhoto(await resizeImage(file));
      setClearPhoto(false);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : t("popupEditStudent.photoFailed"));
    }
  };

  const saving = updateStudent.isPending || uploadAvatar.isPending || removeAvatar.isPending;
  const saveError = updateStudent.error ?? uploadAvatar.error ?? removeAvatar.error;

  const handleSave = async () => {
    if (!name.trim()) return;

    await updateStudent.mutateAsync({
      id: student.id,
      name: name.trim(),
      halaqa_id: halaqaId === "" ? null : halaqaId,
      birth_date: birthDate || null,
      student_phone: studentPhone || null,
      parent_phone: parentPhone || null,
    });

    // الصورة بعد بيانات الطالب: فشل رفعها لا يضيّع بقية التعديلات
    if (pendingPhoto) {
      await uploadAvatar.mutateAsync({ id: student.id, data: pendingPhoto });
    } else if (clearPhoto && student.avatarUrl) {
      await removeAvatar.mutateAsync({ id: student.id });
    }

    notify(t("toast.studentUpdated"));

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark rounded-2xl p-6 w-11/12 max-w-md space-y-3 shadow-lg border dark:border-gray-600 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-emerald-500 mb-2 text-center">
          {t("popupEditStudent.title")}
        </h2>

        {/* ===== الصورة الشخصية ===== */}
        <div className="flex flex-col items-center gap-2 pb-2">
          <div className="relative">
            <Avatar
              name={name || student.name}
              url={shownPhoto}
              className="size-24"
              textClassName="text-2xl"
            />

            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              aria-label={t("popupEditStudent.changePhoto")}
              className="absolute bottom-0 end-0 flex size-8 items-center justify-center rounded-full
                bg-emerald-500 text-white shadow-md transition hover:bg-emerald-600 active:scale-95"
            >
              <FaCamera className="text-xs" />
            </button>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={(e) => {
              void handlePickPhoto(e.target.files?.[0]);
              // تصفير القيمة: اختيار الملف نفسه مرة أخرى يجب أن يُطلق الحدث
              e.target.value = "";
            }}
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="text-xs font-bold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              {shownPhoto ? t("popupEditStudent.changePhoto") : t("popupEditStudent.choosePhoto")}
            </button>

            {shownPhoto && (
              <button
                type="button"
                onClick={() => {
                  setPendingPhoto(null);
                  setClearPhoto(true);
                  setPhotoError("");
                }}
                className="flex items-center gap-1 text-xs font-bold text-red-600 hover:underline dark:text-red-400"
              >
                <FaTrash className="text-[10px]" />
                {t("popupEditStudent.removePhoto")}
              </button>
            )}
          </div>

          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            {t("popupEditStudent.photoHint")}
          </p>

          {photoError && (
            <p className="text-xs font-bold text-red-600 dark:text-red-400">{photoError}</p>
          )}
        </div>

        <InputField label={t("popupEditStudent.name")} value={name} onChange={setName} />

        <InputField
          label={t("popupEditStudent.birthDate")}
          value={birthDate}
          onChange={setBirthDate}
          type="date"
        />

        {/* الحلقة تُختار من الحلقات الموجودة فعلاً — تعديلها ينقل الطالب */}
        <div>
          <label className="text-base font-semibold mb-1 block text-gray-800 dark:text-gray-100">
            {t("popupEditStudent.halaqa")}
          </label>
          <select
            className={FIELD_CLASS}
            value={halaqaId}
            onChange={(e) => setHalaqaId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">{t("popupEditStudent.noHalaqa")}</option>
            {halaqat.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        <InputField
          label={t("popupEditStudent.parentPhone")}
          value={parentPhone}
          onChange={setParentPhone}
          type="tel"
        />

        <InputField
          label={t("popupEditStudent.studentPhone")}
          value={studentPhone}
          onChange={setStudentPhone}
          type="tel"
        />

        {saveError && (
          <p className="text-sm font-bold text-red-600 dark:text-red-400">
            {/* 403 هنا يعني أن الحساب مدرّس؛ رسالة الخادم العامة لا تشرح ذلك */}
            {(saveError as { status?: number })?.status === 403
              ? t("popupEditStudent.forbidden")
              : saveError instanceof Error
                ? saveError.message
                : t("state.error")}
          </p>
        )}

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50"
          >
            {t("popupEditStudent.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition disabled:opacity-50"
          >
            {uploadAvatar.isPending
              ? t("popupEditStudent.photoUploading")
              : saving
                ? t("popupEditStudent.saving")
                : t("popupEditStudent.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

const FIELD_CLASS =
  "w-full border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-right dark:text-white bg-white dark:bg-dark focus:outline-none focus:ring-2 focus:ring-emerald-400";

/* ===== Reusable Input Component ===== */
function InputField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-base font-semibold mb-1 block text-gray-800 dark:text-gray-100">
        {label}
      </label>
      <input
        type={type}
        className={FIELD_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
