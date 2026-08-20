import React from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/authContext";

interface PopupLogOutProps {
  openPopupLogOut: boolean;
  setOpenPopupLogOut: React.Dispatch<React.SetStateAction<boolean>>;
}

function PopupLogOut({ openPopupLogOut, setOpenPopupLogOut }: PopupLogOutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  if (!openPopupLogOut) return null;

  /** مسح الجلسة ثم توجيه حتمي إلى صفحة الدخول. */
  const handleLogout = () => {
    logout();
    setOpenPopupLogOut(false);
    navigate("/login", { replace: true });
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-dark-light rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4 transition-colors duration-300">
        {/* العنوان */}
        <div className="text-xl font-bold text-black dark:text-white text-center">
          {t("logout.confirm")}
        </div>

        {/* الأزرار */}
        <div className="flex justify-center gap-4 mt-4">
          <button
            className="bg-gray-400 dark:bg-gray-600 hover:bg-gray-500 dark:hover:bg-gray-700 text-white rounded px-4 py-2 transition-colors"
            onClick={() => setOpenPopupLogOut(false)}
          >
            {t("logout.cancel")}
          </button>
          <button
            className="bg-red-600 hover:bg-red-700 text-white rounded px-4 py-2 transition-colors"
            onClick={handleLogout}
          >
            {t("logout.logout")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default PopupLogOut;
