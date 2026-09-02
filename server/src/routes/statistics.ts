/**
 * لوحة الإحصاءات الشاملة — أرقام المركز كلّه عبر كامل عمره، لا يوم واحد.
 *
 * تختلف عن /api/reports/dashboard: تلك بطاقات يومٍ واحد، وهذه تجميعات
 * تاريخية. الوصول محصور بالمدير (requireStudentManager = ADMIN) على مستوى
 * الراوتر لا على كل مسار، حتى لا يُنسى مع أي مسار يُضاف لاحقاً.
 *
 * ── قيد النطاق ───────────────────────────────────────────────────────
 * كان الملف بلا قيد نطاق داخل الاستعلامات، بحجّة أن المدير يرى كل
 * الحلقات أصلاً. أبطلت الأقسامُ هذه الحجّة: مدير القسم مدير أيضاً، ولو
 * بقيت التجميعات مطلقة لقرأ من صفحة واحدة أرقامَ المعهد كلّه — وهي أشدّ
 * كشفاً من قائمة، لأنها تفصح عن حجم الأقسام الأخرى ونشاطها دفعةً واحدة.
 *
 * فكل تجميعة هنا مقيَّدة الآن بـ applyScope (أو applyStudentScope حيث لا
 * halaqa_id). والقيد يعيد `null` للمدير العام فيبقى استعلامه كما كان
 * حرفياً — لا كلفة عليه ولا تغيّر في أرقامه.
 *
 * القيد مكتوب بلغة النطاق العامّة لا بلغة الأقسام: لو فُتحت الصفحة يوماً
 * للمدرّس (راجع denySupervisor في middleware/auth) لقُيّدت أرقامه بحلقاته
 * تلقائياً بلا سطر إضافي هنا.
 *
 * كل التجميعات تتم في القاعدة لا في جافاسكربت: جلب كل التلاوات لجمعها في
 * الذاكرة يكبر مع عمر المركز بلا سقف.
 */
import { Router } from "express";
import { z } from "zod";
import { db, type SqlParam } from "../db/index.js";
import { monthOf } from "../db/sqlfn.js";
import { asyncHandler, logSqlError, parse } from "../lib/http.js";
import { departmentInput } from "../lib/schemas.js";
import { requireStudentManager } from "../middleware/auth.js";
import { recitationPagesExpr } from "../services/recitationSql.js";
import { applyScope, applyStudentScope, viewAsDepartment } from "../services/scope.js";
import { visibleStudent } from "../services/studentSql.js";

export const statisticsRouter = Router();

statisticsRouter.use(requireStudentManager);

/**
 * فلتر القسم الاختياري — لا أثر له إلا للمدير العام (راجع viewAsDepartment).
 *
 * غيابه أو "" يعني «كل الأقسام»، أي السلوك السابق حرفياً: بلا قيد للمدير
 * العام، وبقيد قسمه لمدير القسم.
 */
const scopeQuery = z.object({ department: departmentInput.optional() });

/** `WHERE …` أو نصّ فارغ — حتى يبقى الاستعلام غير المقيَّد كما كان حرفياً. */
function whereOf(conds: string[]): string {
  return conds.length ? `WHERE ${conds.join(" AND ")}` : "";
}

/** الشهر التالي لـ 'YYYY-MM' — لتوليد سلسلة الأشهر المتصلة. */
function nextMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return m === 12
    ? `${year + 1}-01`
    : `${year}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * يملأ الأشهر الخالية بين أول شهر وآخره بأصفار.
 *
 * الأشهر التي لا سجلّ فيها لا تعيدها القاعدة أصلاً، فيصل المخطّط الخطّي
 * صفر شهر آذار بصفر أيار مباشرةً — فيبدو أن نيسان لم يوجد، لا أنه كان
 * فارغاً. التسلسل الزمني يجب أن يكون متّصلاً ليقرأ الخطُّ صحيحاً.
 */
function fillMonths<T extends { month: string }>(
  rows: T[],
  empty: (month: string) => T
): T[] {
  if (rows.length === 0) return [];

  const byMonth = new Map(rows.map((row) => [row.month, row]));
  const months = rows.map((r) => r.month).sort();
  const last = months[months.length - 1];

  const filled: T[] = [];
  for (let m = months[0]; m <= last; m = nextMonth(m)) {
    filled.push(byMonth.get(m) ?? empty(m));
  }
  return filled;
}

/**
 * GET /api/statistics/dashboard — تجميعات الإحصاءات الشاملة.
 *
 * الأسماء بأسلوب camelCase كبقية ردود الـ API في المشروع، لا snake_case.
 */
statisticsRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    try {
      /*
       * الفلتر يُطوى في المستخدم قبل بناء أي قيد، فتَرِثه التجميعات الستّ
       * كلّها دون أن يُذكر القسم في استعلام واحد منها.
       */
      const { department } = parse(scopeQuery, req.query);
      const user = viewAsDepartment(req.user!, department);

      /*
       * قيود النطاق تُبنى مرّة وتُعاد على كل تجميعة من نفس الجدول: بناؤها
       * داخل كل استعلام يعني استعلام حلقات لكل تجميعة (ستة) بلا فائدة.
       */
      const recitWhere: string[] = [];
      const recitParams: SqlParam[] = [];
      await applyScope(user, "r.halaqa_id", recitWhere, recitParams);

      const sessionWhere: string[] = [];
      const sessionParams: SqlParam[] = [];
      await applyScope(user, "s.halaqa_id", sessionWhere, sessionParams);

      // الأوقاف لا halaqa_id فيها — الانتماء يمرّ بالطالب
      const awqafWhere: string[] = [];
      const awqafParams: SqlParam[] = [];
      await applyStudentScope(user, "a.student_id", awqafWhere, awqafParams);

      const studentWhere: string[] = [visibleStudent("")];
      const studentParams: SqlParam[] = [];
      await applyScope(user, "halaqa_id", studentWhere, studentParams);

      const halaqaWhere: string[] = ["is_active = TRUE"];
      const halaqaParams: SqlParam[] = [];
      await applyScope(user, "id", halaqaWhere, halaqaParams);
      /*
       * الصفحات تُحسب بنفس تعبير لوحة الصدارة (recitationPagesExpr): السورة
       * بوزنها من جزء عمّ ونصف الصفحة 0.5. لو جُمعت هنا بـ COUNT(*) لظهر
       * رقمان مختلفان لنفس الحقيقة في صفحتين متجاورتين.
       *
       * CAST إلى numeric: ROUND ذات المنزلتين لا تقبل double في Postgres،
       * والمجموع كسريّ.
       */
      const pagesRow = await db().get<{ pages: number | null; count: number }>(
        `SELECT ROUND(CAST(COALESCE(SUM(${recitationPagesExpr()}), 0) AS numeric), 2) AS pages,
                COUNT(*) AS count
         FROM recitations r ${whereOf(recitWhere)}`,
        recitParams
      );

      // يوم دوام = يوم سُجّلت فيه جلسة حضور واحدة على الأقل، لا مجموع
      // الجلسات: خمس حلقات في يوم واحد تبقى يوم دوام واحداً.
      const attendanceRow = await db().get<{ days: number; sessions: number }>(
        `SELECT COUNT(DISTINCT s.date) AS days, COUNT(*) AS sessions
         FROM attendance_sessions s ${whereOf(sessionWhere)}`,
        sessionParams
      );

      const awqafRow = await db().get<{ passed: number; total: number }>(
        `SELECT SUM(CASE WHEN a.status = 'passed' THEN 1 ELSE 0 END) AS passed,
                COUNT(*) AS total
         FROM awqaf_records a ${whereOf(awqafWhere)}`,
        awqafParams
      );

      const studentsRow = await db().get<{ students: number }>(
        /*
         * «طلاب فعّالون» بطاقةُ حاضرٍ لا تاريخ، فالمؤرشف خارجها.
         *
         * وهذا الاستعلام الوحيد في الملف الذي يمسّ جدول students أصلاً:
         * بقيّة التجميعات (الصفحات، أيام الدوام، الأوقاف، السلاسل
         * الشهرية) تقرأ من recitations و attendance_sessions و
         * awqaf_records مباشرةً بلا وصلٍ بالطالب — فالأرشفة لا تنقص منها
         * شيئاً، والتاريخ يبقى كاملاً.
         */
        `SELECT COUNT(*) AS students FROM students ${whereOf(studentWhere)}`,
        studentParams
      );
      const halaqatRow = await db().get<{ halaqat: number }>(
        `SELECT COUNT(*) AS halaqat FROM halaqat ${whereOf(halaqaWhere)}`,
        halaqaParams
      );

      // ── التسميع الشهري ────────────────────────────────────────────
      const monthlyRows = await db().all<{
        month: string;
        pages: number;
        count: number;
      }>(
        `SELECT ${monthOf("r.recited_at")} AS month,
                ROUND(CAST(SUM(${recitationPagesExpr()}) AS numeric), 2) AS pages,
                COUNT(*) AS count
         FROM recitations r ${whereOf(recitWhere)}
         GROUP BY ${monthOf("r.recited_at")}
         ORDER BY month`,
        recitParams
      );

      // ── الأوقاف شهرياً وسنوياً ────────────────────────────────────
      /*
       * exam_month نصّ 'YYYY-MM' في اللهجتين (لا عمود تاريخ)، فالسنة تُقتطع
       * بـ substr مباشرةً — وهي قياسية تعمل في الاثنين، فلا حاجة إلى
       * مساعد لهجة هنا خلافاً لـ recited_at.
       */
      const awqafByMonth = await db().all<{
        month: string;
        passed: number;
        nominated: number;
        failed: number;
        total: number;
      }>(
        `SELECT a.exam_month AS month,
                SUM(CASE WHEN a.status = 'passed'    THEN 1 ELSE 0 END) AS passed,
                SUM(CASE WHEN a.status = 'nominated' THEN 1 ELSE 0 END) AS nominated,
                SUM(CASE WHEN a.status = 'failed'    THEN 1 ELSE 0 END) AS failed,
                COUNT(*) AS total
         FROM awqaf_records a ${whereOf(awqafWhere)}
         GROUP BY a.exam_month
         ORDER BY month`,
        awqafParams
      );

      const awqafByYear = await db().all<{
        year: string;
        passed: number;
        nominated: number;
        failed: number;
        total: number;
      }>(
        `SELECT substr(a.exam_month, 1, 4) AS year,
                SUM(CASE WHEN a.status = 'passed'    THEN 1 ELSE 0 END) AS passed,
                SUM(CASE WHEN a.status = 'nominated' THEN 1 ELSE 0 END) AS nominated,
                SUM(CASE WHEN a.status = 'failed'    THEN 1 ELSE 0 END) AS failed,
                COUNT(*) AS total
         FROM awqaf_records a ${whereOf(awqafWhere)}
         GROUP BY substr(a.exam_month, 1, 4)
         ORDER BY year`,
        awqafParams
      );

      res.json({
        data: {
          totals: {
            recitationPages: Number(pagesRow?.pages ?? 0),
            recitationCount: Number(pagesRow?.count ?? 0),
            attendanceDays: Number(attendanceRow?.days ?? 0),
            attendanceSessions: Number(attendanceRow?.sessions ?? 0),
            // SUM على جدول فارغ يعيد NULL لا صفراً
            awqafPassed: Number(awqafRow?.passed ?? 0),
            awqafTotal: Number(awqafRow?.total ?? 0),
            students: Number(studentsRow?.students ?? 0),
            halaqat: Number(halaqatRow?.halaqat ?? 0),
          },
          monthlyRecitation: fillMonths(
            monthlyRows.map((row) => ({
              month: row.month,
              pages: Number(row.pages),
              count: Number(row.count),
            })),
            (month) => ({ month, pages: 0, count: 0 })
          ),
          /*
           * أشهر الأوقاف لا تُملأ بالأصفار خلافاً للتسميع.
           *
           * السبر واقعة متقطّعة لا نشاط مستمرّ: دورتان في السنة تعنيان أن
           * بقية الأشهر لا سبر فيها أصلاً — لا أنها أشهر سبرٍ نتيجتها صفر.
           * ملؤها يغرق العمودين الحقيقيين بين خمسة عشر عموداً فارغاً.
           */
          awqafStats: {
            byMonth: awqafByMonth.map((row) => ({
              month: row.month,
              passed: Number(row.passed),
              nominated: Number(row.nominated),
              failed: Number(row.failed),
              total: Number(row.total),
            })),
            byYear: awqafByYear.map((row) => ({
              year: row.year,
              passed: Number(row.passed),
              nominated: Number(row.nominated),
              failed: Number(row.failed),
              total: Number(row.total),
            })),
          },
        },
      });
    } catch (error) {
      logSqlError("GET /api/statistics/dashboard", error);
      throw error;
    }
  })
);
