/**
 * عميل API الأنيس.
 *
 * في التطوير يُترك VITE_API_BASE_URL فارغاً فتذهب الطلبات إلى `/api` نسبياً
 * ويلتقطها وسيط Vite ويمرّرها إلى http://localhost:4000.
 *
 * في الاستضافة (Render / Railway) تُنشر الواجهة كملفات ثابتة على نطاق،
 * والخادم على نطاق آخر، فلا وجود لوسيط. عندها يُضبط المتغيّر على أصل
 * الخادم — مثل https://anis-api-demo.onrender.com — فتُبنى الطلبات مطلقة.
 * (لا تضع `/api` في نهايته؛ العميل يضيفه بنفسه.)
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

/**
 * رابط ملف يقدّمه الخادم (صور الطلاب) بعد ضمّ أصل الـ API إليه.
 *
 * الخادم يعيد مسارات نسبية مثل `/api/uploads/avatars/<اسم>.jpg`، وهي تصلح
 * في التطوير فقط؛ على الاستضافة المنفصلة يجب أن تشير إلى نطاق الخادم.
 * الروابط المطلقة (http://…) وروابط data: تُترك كما هي.
 */
export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}

const TOKEN_KEY = "anis.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; query?: Query } = {}
): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_BASE_URL}/api${withQuery(path, options.query)}`, {
    method,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401) setToken(null);
    throw new ApiError(
      res.status,
      (payload as { error?: string })?.error ?? "تعذّر الاتصال بالخادم",
      (payload as { details?: unknown })?.details
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  delete: <T>(path: string, query?: Query) => request<T>("DELETE", path, { query }),
};
