import type { CSSProperties, ReactNode } from "react";
import { FaCrown, FaMedal } from "react-icons/fa";
import Avatar from "../../shared/Avatar";

export interface PodiumStudent {
  id: number;
  name: string;
  avatarUrl: string | null;
  rank: number;
}

/**
 * ألوان كل مركز: إطار معدنيّ متدرّج، وتوهّج حوله، وصبغة داخل الزجاج،
 * ولون الرقم، وقاعدة المنصّة. ذهبيّ للأول، فضّيّ للثاني، برونزيّ للثالث.
 */
const MEDALS: Record<
  number,
  { frame: string; glow: string; tint: string; value: string; pedestal: string; icon: string; order: string }
> = {
  1: {
    frame: "from-yellow-100 via-yellow-400 to-amber-600",
    glow: "shadow-[0_0_30px_rgba(250,204,21,0.45),0_0_80px_rgba(250,204,21,0.2)]",
    tint: "from-yellow-400/20 via-yellow-500/5 to-transparent",
    value: "from-yellow-100 via-yellow-300 to-amber-500",
    pedestal: "from-yellow-400/80 via-amber-500/50 to-amber-700/20",
    icon: "text-yellow-300",
    order: "order-2",
  },
  2: {
    frame: "from-white via-slate-300 to-slate-500",
    glow: "shadow-[0_0_24px_rgba(203,213,225,0.35),0_0_60px_rgba(203,213,225,0.12)]",
    tint: "from-slate-200/15 via-slate-300/5 to-transparent",
    value: "from-white via-slate-200 to-slate-400",
    pedestal: "from-slate-300/70 via-slate-400/40 to-slate-600/20",
    icon: "text-slate-200",
    order: "order-1",
  },
  3: {
    frame: "from-orange-200 via-orange-500 to-amber-800",
    glow: "shadow-[0_0_24px_rgba(205,127,50,0.4),0_0_60px_rgba(205,127,50,0.15)]",
    tint: "from-orange-400/15 via-orange-500/5 to-transparent",
    value: "from-orange-100 via-orange-300 to-orange-600",
    pedestal: "from-orange-400/70 via-orange-600/40 to-amber-800/20",
    icon: "text-orange-300",
    order: "order-3",
  },
};

/**
 * المقاسات بوضعين. وضع التلفاز يقيس بارتفاع الشاشة (vh) لا بقيم ثابتة:
 * تلفاز 720p يعرض الصفحة بارتفاع ~720px، وقيمٌ مضبوطة على 1080p تجعل
 * المنصّة تبتلع القائمة تحتها. clamp يحفظ حدّاً أدنى للقراءة وأعلى للتوازن.
 */
const SIZES = {
  tv: {
    first: {
      avatar: "size-[clamp(3.5rem,10vh,7rem)]",
      crown: "text-[clamp(1.5rem,4vh,3rem)]",
      name: "text-[clamp(1.1rem,2.8vh,2rem)]",
      value: "text-[clamp(1.8rem,5.5vh,3.75rem)]",
      pad: "px-4 py-[1.6vh]",
      pedestal: "h-[6vh]",
    },
    other: {
      avatar: "size-[clamp(3rem,7.5vh,5rem)]",
      crown: "text-[clamp(1.1rem,2.8vh,2rem)]",
      name: "text-[clamp(1rem,2.3vh,1.6rem)]",
      value: "text-[clamp(1.4rem,4vh,2.75rem)]",
      pad: "px-3 py-[1.4vh]",
      pedestal: "h-[3.5vh]",
    },
    caption: "text-[clamp(0.75rem,1.4vh,1rem)]",
    rank: "text-[clamp(1rem,2.6vh,1.75rem)]",
  },
  page: {
    first: {
      avatar: "size-16 md:size-24",
      crown: "text-2xl md:text-4xl",
      name: "text-sm md:text-xl",
      value: "text-2xl md:text-4xl",
      pad: "px-2 py-4 md:px-4 md:py-6",
      pedestal: "h-12 md:h-16",
    },
    other: {
      avatar: "size-12 md:size-20",
      crown: "text-lg md:text-2xl",
      name: "text-xs md:text-lg",
      value: "text-xl md:text-3xl",
      pad: "px-2 py-3 md:px-3 md:py-5",
      pedestal: "h-6 md:h-9",
    },
    caption: "text-[10px] md:text-xs",
    rank: "text-base md:text-2xl",
  },
} as const;

/** حركة الظهور. الثالث ثم الثاني ثم الأول أخيراً — الإعلان يبلغ ذروته بالبطل. */
const enter = "animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both motion-reduce:animate-none";
const delayByRank: Record<number, number> = { 3: 100, 2: 300, 1: 550 };

/**
 * منصّة المراكز الثلاثة الأولى — لوحة شرف داكنة بزجاج شفّاف وإطارات معدنية مضيئة.
 *
 * داكنة في الوضعين عمداً، حتى في الصفحة الفاتحة: هي لوحة الشرف، والتوهّج
 * الذهبيّ لا يُرى على خلفية بيضاء. وصنف `dark` على المسرح يُبقي ما بداخله
 * (الصورة الرمزية) على ألوانه الداكنة أيّاً كان وضع الصفحة.
 */
export default function Podium<T extends PodiumStudent>({
  students,
  tv,
  valueOf,
  captionOf,
  animationKey,
}: {
  students: T[];
  tv: boolean;
  valueOf: (student: T) => ReactNode;
  captionOf: (student: T) => ReactNode;
  /** يتغيّر مع نوع الترتيب فتُعاد حركة الظهور عند تبديل التبويب. */
  animationKey: string;
}) {
  const sizes = tv ? SIZES.tv : SIZES.page;

  return (
    <div
      className={`dark relative isolate w-full overflow-hidden ${
        tv
          ? "shrink-0"
          : "mx-auto mb-8 max-w-5xl rounded-3xl border border-white/10 px-2 pt-6 shadow-2xl md:px-8 md:pt-10 " +
            "bg-[radial-gradient(ellipse_at_top,#1e293b_0%,#0b1220_55%,#05080f_100%)]"
      }`}
    >
      {/* بقعة ضوء ذهبية من الأعلى على المركز الأول */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-full w-2/3 -translate-x-1/2
          bg-[radial-gradient(ellipse_at_top,rgba(250,204,21,0.22),transparent_65%)]"
      />

      <div className={`mx-auto flex items-end justify-center gap-2 md:gap-5 ${tv ? "max-w-6xl" : ""}`}>
        {students.map((student) => {
          const medal = MEDALS[student.rank] ?? MEDALS[3];
          const first = student.rank === 1;
          const size = first ? sizes.first : sizes.other;

          return (
            <div
              key={`${animationKey}-${student.id}`}
              style={{ animationDelay: `${delayByRank[student.rank] ?? 0}ms` } as CSSProperties}
              className={`flex min-w-0 flex-col items-center ${medal.order} ${enter} ${
                first ? "z-10 flex-[1.25] zoom-in-90" : "flex-1"
              } ${tv ? (first ? "max-w-md" : "max-w-xs") : first ? "max-w-xs" : "max-w-60"}`}
            >
              {/* البطاقة: إطار متدرّج بسماكة 2px يحيط بزجاج داكن */}
              <div className={`relative w-full rounded-3xl bg-linear-to-b p-0.5 ${medal.frame} ${medal.glow}`}>
                <div
                  className={`relative overflow-hidden rounded-[calc(1.5rem-2px)] bg-slate-950/80 text-center
                    backdrop-blur-xl ${size.pad}`}
                >
                  <div className={`pointer-events-none absolute inset-0 bg-linear-to-b ${medal.tint}`} />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-white/10 to-transparent" />
                  {first && (
                    <div
                      className="podium-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3
                        bg-linear-to-r from-transparent via-white/15 to-transparent"
                    />
                  )}

                  <div className="relative">
                    {first ? (
                      <FaCrown
                        className={`podium-float mx-auto mb-1 ${medal.icon} ${size.crown}
                          drop-shadow-[0_0_14px_rgba(250,204,21,0.85)]`}
                      />
                    ) : (
                      <FaMedal className={`mx-auto mb-1 ${medal.icon} ${size.crown} drop-shadow`} />
                    )}

                    {/* الصورة بحلقة معدنية بلون المركز */}
                    <div className={`mx-auto w-fit rounded-full bg-linear-to-br p-0.75 ${medal.frame}`}>
                      <div className="rounded-full bg-slate-950 p-0.5">
                        <Avatar
                          name={student.name}
                          url={student.avatarUrl}
                          className={size.avatar}
                          textClassName={first ? "text-3xl" : "text-2xl"}
                        />
                      </div>
                    </div>

                    <h2 className={`mt-2 truncate font-black leading-tight text-white ${size.name}`}>
                      {student.name}
                    </h2>
                    <div
                      className={`mt-1 bg-linear-to-b bg-clip-text font-black leading-none text-transparent
                        tabular-nums drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] ${medal.value} ${size.value}`}
                    >
                      {valueOf(student)}
                    </div>
                    <div className={`mt-1 truncate font-bold text-white/60 ${sizes.caption}`}>
                      {captionOf(student)}
                    </div>
                  </div>
                </div>
              </div>

              {/* قاعدة المنصّة — أعلاها للأول */}
              <div
                className={`mt-2 flex w-[86%] items-start justify-center rounded-t-xl border-x border-t border-white/15
                  bg-linear-to-b pt-0.5 ${medal.pedestal} ${size.pedestal}`}
              >
                <span className={`font-black text-white/90 drop-shadow ${sizes.rank}`}>{student.rank}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
