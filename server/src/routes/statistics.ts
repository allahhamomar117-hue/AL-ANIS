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
import { dayOf, monthOf } from "../db/sqlfn.js";
import { asyncHandler, logSqlError, parse } from "../lib/http.js";
import { departmentInput } from "../lib/schemas.js";
import { requireStudentManager } from "../middleware/auth.js";
import { recitationPagesExpr } from "../services/recitationSql.js";
import { countedSession } from "../services/attendanceSql.js";
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
const scopeQuery = z.object({
  department: departmentInput.optional(),
  /*
   * حبيبة سلسلة التسميع. غيابها = 'monthly'، أي السلوك السابق حرفياً —
   * فالنداءات القديمة تبقى صحيحة بلا تعديل.
   */
  period: z.enum(["monthly", "daily"]).default("monthly"),
});

/**
 * نافذة العرض اليومي بالأيام.
 *
 * الشهري يغطّي عمر المركز كلّه لأن أشهره عشرات، أمّا اليومي فأيامه آلاف:
 * رسمها كلّها يعطي خطّاً لا يُقرأ وصفّاً لكل يوم في الرد. والقراءة
 * المقصودة من العرض اليومي قريبة أصلاً — "كيف كان هذا الشهر؟" لا "كيف
 * كان عام ٢٠٢٣؟"، وللثانية العرضُ الشهري.
 */
const DAILY_WINDOW_DAYS = 90;

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

/** أول يوم في نافذة العرض اليومي، بصيغة 'YYYY-MM-DD'. */
function windowStart(days: number): string {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start.toISOString().slice(0, 10);
}

/**
 * يملأ الفجوات بين أول مفتاح وآخره بأصفار.
 *
 * المفاتيح التي لا سجلّ فيها لا تعيدها القاعدة أصلاً، فيصل المخطّط الخطّي
 * صفر آذار بصفر أيار مباشرةً — فيبدو أن نيسان لم يوجد، لا أنه كان
 * فارغاً. التسلسل الزمني يجب أن يكون متّصلاً ليقرأ الخطُّ صحيحاً.
 *
 * و`next` معاملٌ لا شرطُ حبيبةٍ داخل الحلقة: الملء واحد للشهر واليوم،
 * وما يختلف بينهما خطوةُ التقدّم وحدها.
 */
function fillGaps<T extends { bucket: string }>(
  rows: T[],
  next: (bucket: string) => string,
  empty: (bucket: string) => T
): T[] {
  if (rows.length === 0) return [];

  const byBucket = new Map(rows.map((row) => [row.bucket, row]));
  const buckets = rows.map((r) => r.bucket).sort();
  const last = buckets[buckets.length - 1];

  const filled: T[] = [];
  for (let b = buckets[0]; b <= last; b = next(b)) {
    filled.push(byBucket.get(b) ?? empty(b));
  }
  return filled;
}

/**
 * يحاذي سلسلةً يومية على محورٍ من الأيام المعطاة، ويملأ الناقص بأصفار.
 *
 * بديلُ fillGaps في العرض اليومي لا نسخةٌ منه: ذاك يملأ كل يوم تقويمي
 * بين الطرفين، فتدخل العطلُ المحورَ أصفاراً — وهي ليست «يوم دوام نتيجته
 * صفر» بل يومٌ لا دوام فيه أصلاً، فوجودها يمدّ الخطّ على فراغ ويخفض
 * المتوسّط البصري بلا معنى.
 *
 * والمحور اتحادُ أيام الدوام مع أيام السلسلة نفسها، لا أيام الدوام
 * وحدها: تسميعٌ سُجّل في يومٍ بلا جلسة حضور واقعةٌ حدثت، وإسقاطه إخفاءُ
 * بيانات لا تنظيفُ محور.
 */
function alignToDays<T extends { bucket: string }>(
  rows: T[],
  days: string[],
  empty: (bucket: string) => T
): T[] {
  const byBucket = new Map(rows.map((row) => [row.bucket, row]));
  const axis = [...new Set([...days, ...byBucket.keys()])].sort();
  return axis.map((day) => byBucket.get(day) ?? empty(day));
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
      const { department, period } = parse(scopeQuery, req.query);
      const user = viewAsDepartment(req.user!, department);

      /*
       * قيود النطاق تُبنى مرّة وتُعاد على كل تجميعة من نفس الجدول: بناؤها
       * داخل كل استعلام يعني استعلام حلقات لكل تجميعة (ستة) بلا فائدة.
       */
      const recitWhere: string[] = [];
      const recitParams: SqlParam[] = [];
      await applyScope(user, "r.halaqa_id", recitWhere, recitParams);

      /*
       * الجلسة الفارغة ليست يوم دوام (راجع services/attendanceSql.ts).
       * الشرط في القيد المشترك لا في كل تجميعة، فيرثه عدُّ الأيام وعدُّ
       * الجلسات وقائمةُ أيام الدوام معاً — ونسيانُه في واحدة منها يعني
       * محوراً فيه يومٌ لا بيانات وراءه.
       */
      const sessionWhere: string[] = [countedSession("s")];
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

      // ── سلسلة التسميع: شهرية أو يومية ─────────────────────────────
      /*
       * الحبيبة تبدّل تعبيرَ التجميع وحده؛ الصفحات والعدد والنطاق تبقى
       * كما هي، فلا يتفرّع الاستعلام إلى نسختين تتباعدان مع الوقت.
       */
      const daily = period === "daily";
      const bucketExpr = daily ? dayOf("r.recited_at") : monthOf("r.recited_at");

      /*
       * النافذة تُقصّ في القاعدة لا بعد الجلب: قصّها في جافاسكربت يعني
       * قراءة كل تلاوات المركز لرمي أقدمها.
       *
       * والمقارنة نصّية على recited_at مباشرةً لا على bucketExpr: العمود
       * مفهرس وصيغته 'YYYY-MM-DD' مرتّبة معجمياً كترتيبها الزمني، أما
       * المقارنة على التعبير فتُبطل الفهرس.
       */
      const seriesWhere = [...recitWhere];
      const seriesParams = [...recitParams];
      if (daily) {
        seriesWhere.push("r.recited_at >= ?");
        seriesParams.push(windowStart(DAILY_WINDOW_DAYS));
      }

      const seriesRows = await db().all<{
        bucket: string;
        pages: number;
        count: number;
      }>(
        `SELECT ${bucketExpr} AS bucket,
                ROUND(CAST(SUM(${recitationPagesExpr()}) AS numeric), 2) AS pages,
                COUNT(*) AS count
         FROM recitations r ${whereOf(seriesWhere)}
         GROUP BY ${bucketExpr}
         ORDER BY bucket`,
        seriesParams
      );

      // ── أيام الدوام الفعلية ───────────────────────────────────────
      /*
       * يوم دوام = يوم سُجّلت فيه جلسة حضور واحدة على الأقل. هذه هي
       * القائمة التي يُبنى عليها محور العرض اليومي في المخطّطين، فلا
       * تظهر العطل أعمدةً فارغة.
       *
       * تُجلب في العرض اليومي وحده: الشهري لا يحتاجها، وأشهرُه متّصلة
       * أصلاً فيبقى fillGaps عليه كما كان.
       */
      const attendanceWindowWhere = [...sessionWhere];
      const attendanceWindowParams = [...sessionParams];
      if (daily) {
        attendanceWindowWhere.push("s.date >= ?");
        attendanceWindowParams.push(windowStart(DAILY_WINDOW_DAYS));
      }

      const workingDays = daily
        ? (
            await db().all<{ day: string }>(
              `SELECT DISTINCT ${dayOf("s.date")} AS day
               FROM attendance_sessions s ${whereOf(attendanceWindowWhere)}
               ORDER BY day`,
              attendanceWindowParams
            )
          ).map((row) => row.day)
        : [];

      // ── سلسلة الحضور: حاضر/متأخّر مقابل المسجَّلين ────────────────
      /*
       * المقياس نفسه الذي تعرضه لوحة الصدارة: المتأخّر حاضرٌ متأخّر لا
       * غائب (IN ('present','late'))، والنسبة من المسجَّلين في الجلسة لا
       * من طلاب المركز — فيوم حضرت فيه حلقة واحدة يُقاس بطلابها.
       *
       * التجميع من attendance_entries موصولةً بالجلسة: النطاق والتاريخ
       * كلاهما على الجلسة، والحالة على القيد.
       */
      const attendanceBucket = daily ? dayOf("s.date") : monthOf("s.date");

      const attendanceSeriesRows = await db().all<{
        bucket: string;
        attended: number;
        absent: number;
        excused: number;
        total: number;
      }>(
        `SELECT ${attendanceBucket} AS bucket,
                SUM(CASE WHEN e.status IN ('present','late') THEN 1 ELSE 0 END) AS attended,
                SUM(CASE WHEN e.status = 'absent'  THEN 1 ELSE 0 END) AS absent,
                SUM(CASE WHEN e.status = 'excused' THEN 1 ELSE 0 END) AS excused,
                COUNT(*) AS total
         FROM attendance_entries e
         JOIN attendance_sessions s ON s.id = e.session_id
         ${whereOf(attendanceWindowWhere)}
         GROUP BY ${attendanceBucket}
         ORDER BY bucket`,
        attendanceWindowParams
      );

      /*
       * النسبة تُحسب هنا لا في SQL: القسمة على صفر تختلف بين اللهجتين،
       * والبسط والمقام موجودان في الصفّ أصلاً فلا جولة قاعدة إضافية.
       */
      const attendancePoints = attendanceSeriesRows.map((row) => {
        const total = Number(row.total);
        const attended = Number(row.attended);
        return {
          bucket: row.bucket,
          attended,
          absent: Number(row.absent),
          excused: Number(row.excused),
          total,
          rate: total ? Math.round((attended / total) * 100) : 0,
        };
      });

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
          /*
           * الحبيبة تُعاد مع السلسلة لا تُستنتج من طول المفتاح: الواجهة
           * تصوغ المحور والعنوان عليها، ورقّة «هل المفتاح عشرة محارف؟»
           * عقدٌ ضمنيّ ينكسر بصمت.
           */
          recitationSeries: {
            period,
            /*
             * الشهري يُملأ بالأصفار (fillGaps) واليومي يُحاذى على أيام
             * الدوام (alignToDays): الشهر الفارغ شهرٌ وُجد ولم يُسمَّع
             * فيه، أمّا يوم العطلة فلم يكن يوم دوام أصلاً.
             */
            points: (() => {
              const rows = seriesRows.map((row) => ({
                bucket: row.bucket,
                pages: Number(row.pages),
                count: Number(row.count),
              }));
              const empty = (bucket: string) => ({ bucket, pages: 0, count: 0 });

              return daily
                ? alignToDays(rows, workingDays, empty)
                : fillGaps(rows, nextMonth, empty);
            })(),
          },
          /*
           * سلسلة الحضور بنفس حبيبة التسميع: المخطّطان يُقرآن معاً
           * ("هل انخفض التسميع لأن الحضور انخفض؟")، وحبيبتان مختلفتان
           * على الصفحة الواحدة تُبطل المقارنة.
           *
           * ولا تُملأ فجواتها إطلاقاً: كل صفّ فيها يومُ دوامٍ أو شهرُ
           * دوامٍ وقع فعلاً، وما لا جلسة فيه ليس صفراً بل لا شيء.
           */
          attendanceSeries: {
            period,
            points: attendancePoints,
          },
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
