import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FaMinus, FaPlus, FaStar } from "react-icons/fa";
import { useAuth } from "../context/authContext";
import { useAddPoints, useDeductPoints, useHalaqat, useStudents } from "../lib/api/hooks";

type Operation = "add" | "deduct";

/**
 * أسباب جاهزة تُعبَّأ بنقرة واحدة، لكل عملية أسبابها.
 *
 * ثابتة في الكود لا عبر i18n، لأن t مع returnObjects كان يعيد المفتاح
 * كنص فلا تظهر الرقاقات إطلاقاً.
 */
const REASON_PRESETS: Record<Operation, string[]> = {
  add: ["مكافأة بالدرس", "إتقان التسميع", "حسن الخلق"],
  deduct: ["خروج من الدرس", "مشاغبة", "كثرة الكلام"],
};

/**
 * نافذة النقاط السريعة: اختيار طالب من حلقات المستخدم ثم إضافة أو خصم نقاط
 * دون مغادرة الصفحة الحالية. الخادم يقصر قائمة الطلاب على نطاق المستخدم،
 * فالمدرّس لا يرى إلا طلاب حلقاته.
 */
export default function QuickPointsModal({
  onClose,
  defaultHalaqaId,
  defaultStudentId,
}: {
  onClose: () => void;
  defaultHalaqaId?: number;
  defaultStudentId?: number;
}) {
  const { t } = useTranslation();
  const { isTeacher } = useAuth();

  const [operation, setOperation] = useState<Operation>("add");
  const [halaqaId, setHalaqaId] = useState<number | "">(defaultHalaqaId ?? "");
  const [studentId, setStudentId] = useState<number | "">(defaultStudentId ?? "");
  const [amount, setAmount] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<string | null>(null);

  // المدرّس لا يختار حلقة: الخادم يقصر /students على حلقاته أصلاً
  // (‏applyScope في services/scope.ts)، فترك المرشّح فارغاً يعطيه طلاب
  // حلقاته كلها ولا شيء سواها — ويصحّ للأستاذ ذي الحلقتين كما للواحدة.
  const { data: allHalaqat = [] } = useHalaqat();
  const halaqat = isTeacher ? [] : Array.isArray(allHalaqat) ? allHalaqat : [];
  const students = useStudents({
    halaqaId: isTeacher || halaqaId === "" ? undefined : halaqaId,
    limit: 200,
  });

  const addPoints = useAddPoints();
  const deductPoints = useDeductPoints();
  const pending = addPoints.isPending || deductPoints.isPending;
  const error = addPoints.error ?? deductPoints.error;

  const list = Array.isArray(students.data?.data) ? students.data.data : [];
  const selected = list.find((s) => s.id === studentId);

  const positive = typeof amount === "number" && amount > 0;
  const tooMuch =
    operation === "deduct" && positive && selected ? amount > selected.points : false;
  const valid = studentId !== "" && positive && !tooMuch;

  /**
   * تبديل نوع العملية. السبب المُختار من رقاقات العملية السابقة يُمسح،
   * وإلا بقي "إتقان التسميع" مكتوباً في خصم — وهو أسوأ من حقل فارغ.
   */
  const switchOperation = (next: Operation) => {
    setOperation(next);
    if (REASON_PRESETS[operation].includes(reason)) setReason("");
  };

  const submit = async () => {
    if (!valid || !selected) return;

    const mutation = operation === "add" ? addPoints : deductPoints;
    const result = await mutation.mutateAsync({
      id: selected.id,
      amount: amount as number,
      reason: reason.trim() || undefined,
    });

    // نبقى في النافذة ونعرض النتيجة، ليتمكّن المدرّس من تسجيل طالب آخر فوراً
    setDone(
      t("quickPoints.done", {
        name: selected.name,
        delta: result.data.delta > 0 ? `+${result.data.delta}` : result.data.delta,
        balance: result.data.balance,
      })
    );
    setAmount("");
    setReason("");
    setStudentId("");
  };

  const fieldClass =
    "w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-light px-4 py-3 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400";

  // عبر بوابة إلى body: شريط التنقّل يستخدم backdrop-blur، وأي عنصر بمرشّح
  // يصبح الحاوية المرجعية لأبنائه fixed، فتُحسب inset-0 داخله بدل الشاشة.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-600 dark:bg-dark max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="flex items-center justify-center gap-2 text-xl font-bold text-emerald-700 dark:text-emerald-400">
          <FaStar />
          {t("quickPoints.title")}
        </h2>

        {/* إضافة أو خصم */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1 dark:bg-dark-light">
          <button
            onClick={() => switchOperation("add")}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 font-bold transition ${
              operation === "add"
                ? "bg-emerald-500 text-white shadow"
                : "text-gray-600 dark:text-gray-300"
            }`}
          >
            <FaPlus size={12} />
            {t("quickPoints.add")}
          </button>
          <button
            onClick={() => switchOperation("deduct")}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 font-bold transition ${
              operation === "deduct"
                ? "bg-red-500 text-white shadow"
                : "text-gray-600 dark:text-gray-300"
            }`}
          >
            <FaMinus size={12} />
            {t("quickPoints.deduct")}
          </button>
        </div>

        {/*
          الحلقة — للمدير والمشرف وحدهما.
          الحارس `!isTeacher` خارجيّ ووحيد عمداً: أي شرط إضافي بجانبه يجعل
          إخفاء الحقل عن المدرّس رهيناً بشرط آخر قد يتغيّر لاحقاً.
        */}
        {!isTeacher && (
          <>
            {halaqat.length > 1 && (
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {t("quickPoints.halaqa")}
                </label>
                <select
                  value={halaqaId}
                  onChange={(e) => {
                    setHalaqaId(e.target.value === "" ? "" : Number(e.target.value));
                    setStudentId("");
                  }}
                  className={fieldClass}
                >
                  <option value="">{t("quickPoints.allHalaqat")}</option>
                  {halaqat.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {/* الطالب */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t("quickPoints.student")}
          </label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value === "" ? "" : Number(e.target.value))}
            className={fieldClass}
            disabled={students.isPending}
          >
            <option value="">
              {students.isPending ? t("state.loading") : t("quickPoints.selectStudent")}
            </option>
            {list.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {!students.isPending && list.length === 0 && (
            <p className="mt-1 text-xs text-gray-400">{t("quickPoints.noStudents")}</p>
          )}
        </div>

        {/* المقدار */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t("quickPoints.amount")}
          </label>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
            className={fieldClass}
          />

          {/* اختصارات شائعة تختصر الكتابة اليومية */}
          <div className="mt-2 flex gap-2">
            {[5, 10, 20, 50].map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(preset)}
                className="flex-1 rounded-lg bg-gray-100 py-1.5 text-sm font-bold text-gray-700 transition hover:bg-emerald-100 dark:bg-dark-light dark:text-gray-200 dark:hover:bg-emerald-900/40"
              >
                {preset}
              </button>
            ))}
          </div>

          {tooMuch && (
            <p className="mt-2 text-xs font-bold text-red-600 dark:text-red-400">
              {t("popupDeductPoints.tooMuch")}
            </p>
          )}

          {selected && positive && !tooMuch && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {selected.points} {operation === "add" ? "+" : "−"} {amount} ={" "}
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {operation === "add" ? selected.points + amount : selected.points - amount}
              </span>
            </p>
          )}
        </div>

        {/* السبب */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t("quickPoints.reason")}
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("quickPoints.reasonPlaceholder")}
            className={fieldClass}
          />

          {/* اقتراحات سريعة تملأ الحقل بنقرة واحدة */}
          <div className="mt-2 flex flex-wrap gap-2">
            {REASON_PRESETS[operation].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReason(preset)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  reason === preset
                    ? "bg-emerald-500 text-white shadow"
                    : "bg-gray-100 text-gray-700 hover:bg-emerald-100 dark:bg-dark-light dark:text-gray-200 dark:hover:bg-emerald-900/40"
                }`}
              >
                + {preset}
              </button>
            ))}
          </div>
        </div>

        {done && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
            {done}
          </p>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error instanceof Error ? error.message : t("state.error")}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={pending}
            className="rounded-xl bg-gray-200 px-4 py-2 text-gray-800 transition hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
          >
            {t("quickPoints.close")}
          </button>

          <button
            onClick={submit}
            disabled={!valid || pending}
            className={`rounded-xl px-5 py-2 font-bold text-white transition disabled:opacity-50 ${
              operation === "add"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {pending ? t("state.saving") : t("quickPoints.save")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
