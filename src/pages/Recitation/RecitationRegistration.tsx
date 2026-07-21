import { useState } from "react";
import { BookOpen, ThumbsUp, CheckCircle, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

/* ================= TYPES ================= */
type RecitationType = "full" | "half" | "more";
type Rating = "excellent" | "good" | "needs";

/* ================= MAIN ================= */
export default function RecitationRegistration() {
  const { t } = useTranslation();
  const [recitationType, setRecitationType] = useState<RecitationType>("full");
  const [rating, setRating] = useState<Rating>("good");
  const [notes, setNotes] = useState("");

  const [pageNumber, setPageNumber] = useState<number | "">("");
  const [verse, setVerse] = useState("");
  const [pageCompleted, setPageCompleted] = useState(false);
  const [toPage, setToPage] = useState<number | "">("");

  const navigate = useNavigate();
  const userImage = "https://i.pravatar.cc/150?img=3";

  const handleSave = () => {
    const data = {
      recitationType,
      rating,
      notes,
      pageNumber,
      verse: recitationType === "half" ? verse : undefined,
      pageCompleted: recitationType === "half" ? pageCompleted : undefined,
      toPage: recitationType === "more" ? toPage : undefined,
    };

    console.log(data);
    alert(t("recitationRegistration.saved"));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 mt-16 space-y-6 bg-white dark:bg-dark-light transition-colors duration-300">
      {/* ---------- Student Card ---------- */}
      <div className="bg-white dark:bg-dark rounded-3xl p-6 flex items-center justify-between shadow transition-colors duration-300">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">أحمد محمد علي</h2>
          <span className="inline-block mt-2 px-3 py-1 text-sm bg-primary-light text-primary rounded-full">
            {t("recitationRegistration.halaqa")}
          </span>
        </div>
        <img src={userImage} className="w-16 h-16 rounded-full" />
      </div>

      {/* ---------- Card 1 : Recitation ---------- */}
      <RecitationTypeCard
        recitationType={recitationType}
        setRecitationType={setRecitationType}
        pageNumber={pageNumber}
        setPageNumber={setPageNumber}
        verse={verse}
        setVerse={setVerse}
        pageCompleted={pageCompleted}
        setPageCompleted={setPageCompleted}
        toPage={toPage}
        setToPage={setToPage}
      />

      {/* ---------- Card 2 : Rating ---------- */}
      <RatingCard rating={rating} setRating={setRating} />

      {/* ---------- Card 3 : Notes ---------- */}
      <NotesCard notes={notes} setNotes={setNotes} />

      {/* ---------- Actions ---------- */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={handleSave}
          className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-full shadow transition-colors duration-300"
        >
          <Save size={18} />
          {t("recitationRegistration.save")}
        </button>
        <button
          onClick={() => navigate(-1)}
          className="px-8 py-3 rounded-full border bg-white dark:bg-dark hover:bg-gray-100 dark:hover:bg-dark-light transition-colors duration-300"
        >
          {t("recitationRegistration.cancel")}
        </button>
      </div>
    </div>
  );
}

/* ================= CARD 1 ================= */
function RecitationTypeCard({
  recitationType,
  setRecitationType,
  pageNumber,
  setPageNumber,
  verse,
  setVerse,
  pageCompleted,
  setPageCompleted,
  toPage,
  setToPage,
}: any) {
  const { t } = useTranslation();
  return (
    <div className="bg-white dark:bg-dark rounded-3xl p-6 space-y-6 shadow transition-colors duration-300">
      <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-white">
        <BookOpen size={18} />
        {t("recitationRegistration.recitationType")}
      </h3>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 bg-white-light dark:bg-dark-light p-2 rounded-2xl w-full sm:w-fit">
        <ToggleButton
          active={recitationType === "full"}
          onClick={() => setRecitationType("full")}
        >
          {t("recitationRegistration.types.full")}
        </ToggleButton>
        <ToggleButton
          active={recitationType === "half"}
          onClick={() => setRecitationType("half")}
        >
          {t("recitationRegistration.types.half")}
        </ToggleButton>
        <ToggleButton
          active={recitationType === "more"}
          onClick={() => setRecitationType("more")}
        >
          {t("recitationRegistration.types.more")}
        </ToggleButton>
      </div>

      <div>
        <p className="font-medium mb-2 text-gray-800 dark:text-white">
          {recitationType === "more"
            ? t("recitationRegistration.fromPage")
            : t("recitationRegistration.pageNumber")}
        </p>
        <input
          type="number"
          value={pageNumber}
          onChange={(e) => setPageNumber(Number(e.target.value))}
          className="w-full max-w-md rounded-full border border-gray-300 dark:border-gray-600 px-5 py-3 bg-white dark:bg-dark-light text-gray-800 dark:text-white"
        />
      </div>

      {recitationType === "half" && (
        <div className="space-y-4">
          <input
            type="number"
            placeholder={t("recitationRegistration.verse")}
            value={verse}
            onChange={(e) => setVerse(e.target.value)}
            className="w-full max-w-md rounded-full border border-gray-300 dark:border-gray-600 px-5 py-3 bg-white dark:bg-dark-light text-gray-800 dark:text-white"
          />

          <label className="flex items-center gap-2 text-gray-800 dark:text-white">
            <input
              type="checkbox"
              checked={pageCompleted}
              onChange={(e) => setPageCompleted(e.target.checked)}
              className="w-5 h-5 accent-primary"
            />
            {t("recitationRegistration.pageCompleted")}
          </label>
        </div>
      )}

      {recitationType === "more" && (
        <input
          type="number"
          placeholder={t("recitationRegistration.toPage")}
          value={toPage}
          onChange={(e) => setToPage(Number(e.target.value))}
          className="w-full max-w-md rounded-full border border-gray-300 dark:border-gray-600 px-5 py-3 bg-white dark:bg-dark-light text-gray-800 dark:text-white"
        />
      )}
    </div>
  );
}

/* ================= CARD 2 ================= */
function RatingCard({
  rating,
  setRating,
}: {
  rating: Rating;
  setRating: (v: Rating) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="bg-white dark:bg-dark rounded-3xl p-6 space-y-4 shadow transition-colors duration-300">
      <h3 className="text-xl font-bold text-gray-800 dark:text-white">
        {t("recitationRegistration.studentRating")}
      </h3>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 bg-white-light dark:bg-dark-light p-2 rounded-2xl w-full sm:w-fit">
        <ToggleButton
          active={rating === "excellent"}
          onClick={() => setRating("excellent")}
        >
          <CheckCircle size={16} />
          {t("recitationRegistration.ratings.excellent")}
        </ToggleButton>

        <ToggleButton
          active={rating === "good"}
          onClick={() => setRating("good")}
        >
          <ThumbsUp size={16} />
          {t("recitationRegistration.ratings.good")}
        </ToggleButton>

        <ToggleButton
          active={rating === "needs"}
          onClick={() => setRating("needs")}
        >
          {t("recitationRegistration.ratings.needsImprovement")}
        </ToggleButton>
      </div>
    </div>
  );
}

/* ================= CARD 3 ================= */
function NotesCard({
  notes,
  setNotes,
}: {
  notes: string;
  setNotes: (v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="bg-white dark:bg-dark rounded-3xl p-6 space-y-3 shadow transition-colors duration-300">
      <h3 className="text-xl font-bold text-gray-800 dark:text-white">
        {t("recitationRegistration.teacherNotes")}
      </h3>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full min-h-[140px] rounded-2xl border border-gray-300 dark:border-gray-600 p-4 bg-white dark:bg-dark-light text-gray-800 dark:text-white resize-none"
        placeholder={t("recitationRegistration.notesPlaceholder")}
      />
    </div>
  );
}
/* ================= BUTTON ================= */
function ToggleButton({ active, children, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 rounded-full border flex items-center gap-2 text-sm transition
        ${
          active
            ? "bg-green-100 border-green-500 text-green-700 dark:border-green-400"
            : "bg-gray-50 hover:bg-gray-100 dark:bg-dark dark:hover:bg-dark-light dark:text-white border-gray-300 dark:border-gray-600"
        }`}
    >
      {children}
    </button>
  );
}


