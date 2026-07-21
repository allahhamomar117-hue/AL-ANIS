import { useState } from "react";
import { useTranslation } from "react-i18next";

type RecitationType = "full" | "half" | "more";

interface Props {
  onClose: () => void;
  onAdd: (student: {
    id: number;
    name: string;
    halaqa: string;
    recitationType: RecitationType;
    pageNumber: number;
    verse?: string;
    pageCompleted?: boolean;
    toPage?: number;
  }) => void;
}

const studentsList = ["أحمد محمد", "يوسف علي", "عبد الرحمن خالد", "عمر حسن"];
const halaqatList = ["حلقة النور", "حلقة الهداية", "حلقة التقوى", "حلقة الفجر"];

export default function PopupRecitationRegistration({ onClose, onAdd }: Props) {
  const { t } = useTranslation();

  const [name, setName] = useState(studentsList[0]);
  const [halaqa, setHalaqa] = useState(halaqatList[0]);
  const [recitationType, setRecitationType] = useState<RecitationType>("full");
  const [pageNumber, setPageNumber] = useState<number | "">("");
  const [verse, setVerse] = useState("");
  const [pageCompleted, setPageCompleted] = useState(false);
  const [toPage, setToPage] = useState<number | "">("");

  const handleSave = () => {
    if (!name || !pageNumber) return alert(t("popupRecitation.fillData"));

    const studentData: any = {
      id: Date.now(),
      name,
      halaqa,
      recitationType,
      pageNumber: Number(pageNumber),
    };

    if (recitationType === "half") {
      studentData.verse = verse;
      studentData.pageCompleted = pageCompleted;
    }

    if (recitationType === "more") {
      studentData.toPage = Number(toPage);
    }

    onAdd(studentData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark rounded-2xl w-full max-w-md sm:p-6 p-4 overflow-hidden transition-colors duration-300">
        <h2 className="text-xl font-bold mb-4 text-center text-primary">
          {t("popupRecitation.title")}
        </h2>

        {/* الحلقة */}
        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">
            {t("popupRecitation.halaqaLabel")}
          </label>
          <select
            value={halaqa}
            onChange={(e) => setHalaqa(e.target.value)}
            className="w-full rounded-full border dark:border-gray-600 
            bg-white dark:bg-dark-light 
            text-gray-800 dark:text-white
            px-4 py-2 focus:ring-2 focus:ring-primary outline-none"
          >
            {halaqatList.map((h, idx) => (
              <option key={idx} value={h}>{h}</option>
            ))}
          </select>
        </div>

        {/* الطالب */}
        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">
            {t("popupRecitation.studentLabel")}
          </label>
          <select
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-full border dark:border-gray-600 
            bg-white dark:bg-dark-light 
            text-gray-800 dark:text-white
            px-4 py-2 focus:ring-2 focus:ring-primary outline-none"
          >
            {studentsList.map((s, idx) => (
              <option key={idx} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* نوع التسميع */}
        <div className="mb-4">
          <p className="font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t("popupRecitation.recitationType")}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Button active={recitationType === "full"} onClick={() => setRecitationType("full")}>
              {t("popupRecitation.types.full")}
            </Button>
            <Button active={recitationType === "half"} onClick={() => setRecitationType("half")}>
              {t("popupRecitation.types.half")}
            </Button>
            <Button active={recitationType === "more"} onClick={() => setRecitationType("more")}>
              {t("popupRecitation.types.more")}
            </Button>
          </div>
        </div>

        {/* رقم الصفحة */}
        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">
            {recitationType === "more"
              ? t("popupRecitation.fromPage")
              : t("popupRecitation.pageNumber")}
          </label>
          <input
            type="number"
            value={pageNumber}
            onChange={(e) => setPageNumber(Number(e.target.value))}
            placeholder={t("popupRecitation.pagePlaceholder")}
            className="w-full rounded-full border dark:border-gray-600 
            bg-white dark:bg-dark-light 
            text-gray-800 dark:text-white
            px-4 py-2 focus:ring-2 focus:ring-primary outline-none"
          />
        </div>

        {/* نصف صفحة */}
        {recitationType === "half" && (
          <div className="mb-4 space-y-2">
            <div>
              <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">
                {t("popupRecitation.verse")}
              </label>
              <input
                type="text"
                value={verse}
                onChange={(e) => setVerse(e.target.value)}
                placeholder={t("popupRecitation.versePlaceholder")}
                className="w-full rounded-full border dark:border-gray-600 
                bg-white dark:bg-dark-light 
                text-gray-800 dark:text-white
                px-4 py-2 focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={pageCompleted}
                onChange={(e) => setPageCompleted(e.target.checked)}
                className="w-5 h-5 accent-primary"
              />
              <label className="font-medium text-gray-700 dark:text-gray-300">
                {t("popupRecitation.pageCompleted")}
              </label>
            </div>
          </div>
        )}

        {/* أكثر من صفحة */}
        {recitationType === "more" && (
          <div className="mb-4">
            <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">
              {t("popupRecitation.toPage")}
            </label>
            <input
              type="number"
              value={toPage}
              onChange={(e) => setToPage(Number(e.target.value))}
              placeholder={t("popupRecitation.toPagePlaceholder")}
              className="w-full rounded-full border dark:border-gray-600 
              bg-white dark:bg-dark-light 
              text-gray-800 dark:text-white
              px-4 py-2 focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
        )}

        {/* الأزرار */}
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full border dark:border-gray-600 
            text-gray-700 dark:text-gray-300 
            hover:bg-gray-50 dark:hover:bg-dark-light transition"
          >
            {t("popupRecitation.cancel")}
          </button>

          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-full bg-primary text-white 
            hover:bg-primary-dark transition"
          >
            {t("popupRecitation.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- زر موحد ---------- */
function Button({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full border text-sm transition flex items-center justify-center gap-1
      ${
        active
          ? "bg-primary/10 border-primary text-primary shadow-inner"
          : "bg-gray-50 dark:bg-dark-light border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-dark hover:shadow-md"
      }`}
    >
      {children}
    </button>
  );
}
