import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCreateStudent, useHalaqat } from "../../lib/api/hooks";
import { useAuth } from "../../context/authContext";
import { phoneAcceptable } from "../../lib/phone";
import { useToast } from "../../shared/toast/toastContext";

type AddStudentPopupProps = {
  onClose: () => void;
  /** الحلقة المختارة مسبقاً (عند الإضافة من داخل حلقة). */
  defaultHalaqaId?: number;
};

export function PopupAddStudent({ onClose, defaultHalaqaId }: AddStudentPopupProps) {
  const { t } = useTranslation();
  const { data: halaqat = [] } = useHalaqat();
  const createStudent = useCreateStudent();
  const { notify } = useToast();
  const { isSuperAdmin } = useAuth();

  /*
   * ── الحلقة إلزامية لكل من يضيف طالباً — المدير العام معه ──────────
   *
   * كانت مُعفاة عنه بحجّة أن الطالب بلا حلقة يبقى في نطاقه فيُسنده لاحقاً.
   * وهي حجّة صحيحة نظرياً ومكلفة عملياً: لا شيء في الواجهة يعرض «طلاباً
   * بلا حلقة»، فالطالب الذي يُنشأ هكذا لا يظهر في قوائم الحلقات ولا في
   * الحضور ولا في التسميع — يوجد في القاعدة ولا يُرى، ولا شيء يذكّر
   * بإسناده.
   *
   * انتماء الطالب إلى قسمٍ يمرّ بحلقته وحدها (لا عمود قسم في students)،
   * فالحلقة ليست حقلاً إضافياً بل موضعُ الطالب في النظام كلّه.
   *
   * isSuperAdmin ما زال يُقرأ: القائمة الفارغة تعني لمدير القسم شيئاً
   * آخر (راجع رسالة noHalaqatInDepartment أدناه).
   */

  const [name, setName] = useState("");
  const [halaqaId, setHalaqaId] = useState<number | "">(defaultHalaqaId ?? "");
  const [birthDate, setBirthDate] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");

  /*
   * الحقلان اختياريان، فالفراغ يمرّ. ما يُمنع هو رقم كُتب فعلاً ولا يطابق
   * النمط — نفس قاعدة phoneInput على الخادم، مكرّرةً هنا كي تُقال قبل
   * الإرسال لا بعد ردّ 400.
   */
  const studentPhoneOk = phoneAcceptable(studentPhone);
  const parentPhoneOk = phoneAcceptable(parentPhone);

  /** الشرط الحاكم (راجع الشرح أعلى الملف). */
  const halaqaMissing = halaqaId === "";

  const valid =
    name.trim().length > 0 &&
    !halaqaMissing &&
    studentPhoneOk &&
    parentPhoneOk;

  /*
   * زرّ الإضافة يبقى قابلاً للضغط حين تنقص الحلقة، ويردّ بتنبيه.
   *
   * تعطيله كان يمنع الإضافة فعلاً لكنه لا يقول لماذا: يضغط المستخدم فلا
   * يحدث شيء، ولا شيء يربط الجمود بالحقل الناقص. والتنبيه يسمّي النقص.
   */
  const handleAdd = async () => {
    if (halaqaMissing) {
      notify(t("popupAddStudent.halaqaMissing"), "error");
      return;
    }
    if (!valid) return;

    try {
      await createStudent.mutateAsync({
        name: name.trim(),
        halaqa_id: halaqaId,
        birth_date: birthDate || null,
        student_phone: studentPhone || null,
        parent_phone: parentPhone || null,
      });
    } catch {
      // الرسالة تظهر من createStudent.error أسفل النموذج
      return;
    }

    notify(t("toast.studentAdded"));
    onClose();
  };

  const inputClass =
    "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-light text-gray-800 dark:text-white rounded-xl p-3 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark rounded-2xl p-6 w-11/12 max-w-md space-y-4 shadow-lg border dark:border-gray-600 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-emerald-700 dark:text-emerald-400 text-center">
          {t("popupAddStudent.title")}
        </h2>

        <div>
          <label className="text-sm font-semibold mb-1 block text-gray-700 dark:text-gray-300">
            {t("popupAddStudent.name")}
          </label>
          <input type="text" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="text-sm font-semibold mb-1 block text-gray-700 dark:text-gray-300">
            {t("popupAddStudent.birthDate")}
          </label>
          <input
            type="date"
            className={inputClass}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </div>

        {/* الحلقة تُختار من الحلقات الموجودة فعلاً في الخادم */}
        <div>
          <label className="text-sm font-semibold mb-1 block text-gray-700 dark:text-gray-300">
            {t("popupAddStudent.halaqa")}
          </label>
          <select
            className={inputClass}
            value={halaqaId}
            onChange={(e) => setHalaqaId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">{t("popupAddStudent.selectHalaqa")}</option>
            {halaqat.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          {/*
            قائمة فارغة لمدير قسمٍ ليست «لا حلقات بعد»: حلقات قسمه قد تكون
            موجودة لكن بلا قسم مُسنَد (halaqat.department = NULL لكل حلقة
            سابقة للترقية 012)، فلا تدخل نطاقه. الرسالة تدلّ على الإصلاح.
          */}
          {!isSuperAdmin && halaqat.length === 0 ? (
            <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">
              {t("popupAddStudent.noHalaqatInDepartment")}
            </p>
          ) : (
            halaqaMissing && (
              <p className="mt-1 text-xs text-gray-400">
                {t("popupAddStudent.halaqaRequired")}
              </p>
            )
          )}
        </div>

        <div>
          <label className="text-sm font-semibold mb-1 block text-gray-700 dark:text-gray-300">
            {t("popupAddStudent.parentPhone")}
          </label>
          <input
            type="tel"
            className={inputClass}
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
          />
          {!parentPhoneOk && (
            <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">
              {t("validation.phone")}
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-semibold mb-1 block text-gray-700 dark:text-gray-300">
            {t("popupAddStudent.studentPhone")}
          </label>
          <input
            type="tel"
            className={inputClass}
            value={studentPhone}
            onChange={(e) => setStudentPhone(e.target.value)}
          />
          {!studentPhoneOk && (
            <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">
              {t("validation.phone")}
            </p>
          )}
        </div>

        {!name.trim() && (
          <p className="text-xs text-gray-400">{t("popupAddStudent.nameRequired")}</p>
        )}

        {createStudent.isError && (
          <p className="text-sm font-bold text-red-600 dark:text-red-400">
            {createStudent.error instanceof Error ? createStudent.error.message : t("state.error")}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={createStudent.isPending}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50"
          >
            {t("popupAddStudent.cancel")}
          </button>

          <button
            onClick={handleAdd}
            // نقصُ الحلقة لا يعطّل الزرّ — handleAdd يردّ عليه بتنبيه
            disabled={(!valid && !halaqaMissing) || createStudent.isPending}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {createStudent.isPending ? t("popupAddStudent.saving") : t("popupAddStudent.add")}
          </button>
        </div>
      </div>
    </div>
  );
}
