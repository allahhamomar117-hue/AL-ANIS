import type { Department } from "./api/types";

/**
 * القيمة التي تُرسل إلى الخادم في حقل القسم.
 *
 * تُعيد \`undefined\` لمدير القسم — أي «لا تُرسل الحقل أصلاً»، فيملؤه
 * الخادم من قسم المُنفِّذ (resolveDepartment في routes/users.ts و
 * halaqat.ts). وهذا مقصود: إرسال قسمه صراحةً يعمل اليوم، لكنه يجعل
 * الواجهة تدّعي قراراً ليس لها — ولو نُقل الحساب يوماً إلى قسم آخر
 * لأرسلت الواجهة قسماً قديماً بدل أن تسكت.
 *
 * والفرق بين \`undefined\` و \`null\` هنا فرقٌ في المعنى لا في الشكل:
 * \`undefined\` = «القسم ليس قراري»، و \`null\` = «بلا قسم» صراحةً —
 * وهي قيمة لا يقبلها الخادم إلا من المدير العام.
 */
export function departmentToSend(
  value: Department | "",
  isSuperAdmin: boolean
): Department | null | undefined {
  if (!isSuperAdmin) return undefined;
  return value === "" ? null : value;
}
