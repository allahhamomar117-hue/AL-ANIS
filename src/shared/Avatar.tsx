import { useState } from "react";
import { initialsOf } from "../lib/api/hooks";
import { assetUrl } from "../lib/api/client";

interface Props {
  name: string;
  url?: string | null;
  /** أصناف الحجم (size-10 مثلاً) — يحدّدها الموضع لا المكوّن. */
  className?: string;
  /** حجم خط الحرفين عند غياب الصورة. */
  textClassName?: string;
}

/**
 * صورة الطالب، أو الحرفان الأولان من اسمه إن لم تكن له صورة.
 *
 * مكوّن واحد لكل المواضع (الجدول، البطاقات، الملف الشخصي، نافذة التعديل)
 * حتى لا يتكرر منطق "صورة وإلا حرفان" في كل صفحة على حدة.
 *
 * إن فشل تحميل الصورة (ملف محذوف أو رابط معطوب) نعود إلى الحرفين بدل
 * إظهار أيقونة صورة مكسورة.
 */
export default function Avatar({ name, url, className = "size-10", textClassName }: Props) {
  const [failed, setFailed] = useState(false);

  const base = `${className} shrink-0 rounded-full object-cover`;

  if (url && !failed) {
    return (
      <img
        src={assetUrl(url)}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${base} bg-emerald-50 dark:bg-emerald-800`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`${base} flex items-center justify-center bg-emerald-50 font-bold
        text-emerald-600 dark:bg-emerald-700 dark:text-emerald-50 ${textClassName ?? "text-sm"}`}
    >
      {initialsOf(name)}
    </div>
  );
}
