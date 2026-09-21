/**
 * ── الأنيس | خادم Express كدالة Netlify ──────────────────────────────
 *
 * نفس تطبيق Express الذي يعمل على Railway، ملفوفاً بـ serverless-http
 * ليُستدعى كدالة. الفائدة: الواجهة والـ API على نطاق واحد، فلا CORS ولا
 * استضافة خارجية.
 *
 * ثلاثة فروق جوهرية عن تشغيل `node dist/index.js`:
 *
 *  1) لا listen ولا إشارات إيقاف — المنصّة تملك دورة الحياة.
 *  2) لا migrate() ولا verifySchema() عند كل استدعاء: كلفتهما تُدفع في كل
 *     بداية باردة، ولا معنى لـ process.exit(1) داخل دالة. الترقية تُجرى
 *     مرّة واحدة من الجهاز المحلي مقابل نفس DATABASE_URL.
 *  3) لا SQLite: قرص الدالة مؤقّت وللقراءة فقط عدا /tmp. DATABASE_URL
 *     إلزامي هنا، ونتوقّف برسالة صريحة إن غاب بدل السقوط لاحقاً بغموض.
 *
 * التطبيق والاتصال يُنشآن مرّة واحدة على مستوى الوحدة ويُعاد استعمالهما
 * في الاستدعاءات الدافئة — وهذا سبب إبقاء مجمّع اتصالات Postgres صغيراً
 * (DATABASE_POOL_MAX=2 مثلاً) لأن كل نسخة دالة تحمل مجمّعها.
 */
import serverless from "serverless-http";
import { createApp } from "../../server/dist/app.js";
import { initDb } from "../../server/dist/db/driver.js";

/** البادئة التي تصل بها الطلبات بعد إعادة الكتابة في netlify.toml. */
const FUNCTION_PREFIX = "/.netlify/functions/api";

type ServerlessHandler = (event: any, context: any) => Promise<any>;

let ready: Promise<ServerlessHandler> | null = null;

async function boot(): Promise<ServerlessHandler> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "DATABASE_URL غير مضبوط. دالة Netlify لا تستطيع استعمال SQLite " +
        "(القرص مؤقّت)؛ اضبط رابط Postgres في Site settings → Environment variables."
    );
  }

  await initDb();

  return serverless(createApp(), {
    /**
     * الصور تُقدَّم من /api/uploads كبايتات خام؛ بدون هذا تُعاد نصّاً
     * فتصل تالفة. القائمة تشمل ما قد يمرّ فعلاً من الدالة.
     */
    binary: ["image/*", "application/octet-stream"],
  }) as ServerlessHandler;
}

/**
 * الدالة تُستدعى على /.netlify/functions/api/<بقية المسار>، بينما مسارات
 * Express كلها مُركَّبة تحت /api. فنعيد بناء المسار قبل تمريره بدل تعديل
 * app.ts — ليبقى نفس الملف صالحاً للتشغيل العادي على خادم كامل.
 */
function toAppPath(rawPath: string | undefined): string {
  let p = rawPath || "/";
  if (p.startsWith(FUNCTION_PREFIX)) p = p.slice(FUNCTION_PREFIX.length);
  if (!p.startsWith("/")) p = `/${p}`;
  return p.startsWith("/api") ? p : `/api${p === "/" ? "" : p}`;
}

export const handler = async (event: any, context: any) => {
  // لا ننتظر تفريغ حلقة الأحداث: مجمّع pg يُبقيها مشغولة فتتجمّد الاستجابة.
  if (context) context.callbackWaitsForEmptyEventLoop = false;

  if (!ready) ready = boot().catch((error) => { ready = null; throw error; });

  try {
    const run = await ready;
    return await run({ ...event, path: toAppPath(event?.path) }, context);
  } catch (error) {
    console.error("✖ فشل إقلاع دالة الـ API:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
};
