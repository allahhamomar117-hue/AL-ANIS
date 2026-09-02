/** مفاتيح الاستعلامات — مصدر واحد يمنع اختلاف المفاتيح بين الاستعلام والإبطال. */

export const qk = {
  auth: {
    session: ["auth", "session"] as const,
    me: ["auth", "me"] as const,
  },
  halaqat: {
    all: ["halaqat"] as const,
    list: (params?: unknown) => ["halaqat", "list", params ?? null] as const,
    detail: (id: number) => ["halaqat", "detail", id] as const,
    students: (id: number) => ["halaqat", id, "students"] as const,
  },
  students: {
    all: ["students"] as const,
    list: (params?: unknown) => ["students", "list", params ?? null] as const,
    detail: (id: number) => ["students", "detail", id] as const,
    points: (id: number) => ["students", id, "points"] as const,
  },
  attendance: {
    all: ["attendance"] as const,
    sheet: (halaqaId: number, date: string) => ["attendance", "sheet", halaqaId, date] as const,
    sessions: (params?: unknown) => ["attendance", "sessions", params ?? null] as const,
  },
  recitations: {
    all: ["recitations"] as const,
    list: (params?: unknown) => ["recitations", "list", params ?? null] as const,
  },
  reports: {
    all: ["reports"] as const,
    dashboard: (date?: string) => ["reports", "dashboard", date ?? null] as const,
    leaderboard: (params?: unknown) => ["reports", "leaderboard", params ?? null] as const,
    dailyHalaqa: (halaqaId: number, date: string) =>
      ["reports", "daily", halaqaId, date] as const,
  },
  statistics: {
    all: ["statistics"] as const,
    // القسم جزء من المفتاح: تبديل الفلتر استعلامٌ آخر لا إبطالٌ للأول،
    // فتبقى نتيجة «كل الأقسام» في المخزن عند العودة إليها.
    dashboard: (department?: string | null) =>
      ["statistics", "dashboard", department ?? null] as const,
  },
  awqaf: {
    all: ["awqaf"] as const,
    list: (params?: unknown) => ["awqaf", "list", params ?? null] as const,
    detail: (id: number) => ["awqaf", "detail", id] as const,
  },
  users: {
    all: ["users"] as const,
    list: (params?: unknown) => ["users", "list", params ?? null] as const,
    halaqat: (id: number) => ["users", id, "halaqat"] as const,
  },
};
