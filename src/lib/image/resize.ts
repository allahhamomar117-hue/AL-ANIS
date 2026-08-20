/** أقصى بُعد للصورة المحفوظة — الصور تُعرض بحجم 100px فما دون. */
const MAX_DIMENSION = 512;

/** جودة JPEG: توازن بين الوضوح وحجم الملف. */
const QUALITY = 0.85;

export const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";

/** الحدّ الأقصى لحجم الملف المختار قبل التصغير. */
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;

/**
 * يصغّر صورة مختارة من الجهاز ويعيدها data URL بصيغة JPEG.
 *
 * التصغير في المتصفح لا على الخادم: صورة الهاتف اليوم قد تتجاوز 5 ميغابايت،
 * ورفعها كما هي يستهلك شبكة المستخدم وقرص الخادم بلا فائدة — الصورة تُعرض
 * في دائرة قطرها 100px على أبعد تقدير. النتيجة عادةً أقل من 100 كيلوبايت.
 *
 * تُقصّ الصورة مربّعةً من المنتصف لتملأ الدائرة بلا تشويه نسب الأبعاد.
 */
export async function resizeImage(file: File): Promise<string> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("حجم الصورة كبير جداً");
  }

  const bitmap = await createImageBitmap(file);

  try {
    // القصّ المربّع: نأخذ أكبر مربّع ممكن من وسط الصورة
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;
    const target = Math.min(side, MAX_DIMENSION);

    const canvas = document.createElement("canvas");
    canvas.width = target;
    canvas.height = target;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("تعذّرت معالجة الصورة");

    // JPEG لا يدعم الشفافية، فنملأ الخلفية بالأبيض بدل أن تصير سوداء
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, target, target);
    context.drawImage(bitmap, sx, sy, side, side, 0, 0, target, target);

    return canvas.toDataURL("image/jpeg", QUALITY);
  } finally {
    bitmap.close();
  }
}
