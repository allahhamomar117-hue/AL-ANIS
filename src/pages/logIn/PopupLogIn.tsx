type PopupLogInProps = {
  open: boolean;
  setOpen: (value: boolean) => void;
};

import { CiLock } from "react-icons/ci";
import { FaSignInAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

function PopupLogIn({ open, setOpen }: PopupLogInProps) {
  const navigate = useNavigate();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-[600px] max-w-[95%] rounded-2xl p-10 flex flex-col items-center gap-6 bg-gray-100
         text-black dark:bg-zinc-900 dark:text-white shadow-2xl"
      >
        <h2 className="text-3xl font-extrabold text-center">
          تسجيل الدخول مطلوب
        </h2>

        <CiLock className="text-[90px] text-orange-400" />

        <p className="text-center text-lg opacity-80 leading-relaxed">
          يرجى تسجيل الدخول إلى حسابك للاستفادة من هذه الميزة والوصول إلى جميع
          الخصائص.
        </p>

        <div className="flex gap-4 mt-6 w-full">
          <button
            onClick={() => navigate("/LogInEnter")}
            className="flex-1 py-3 text-lg rounded-xl bg-green-500 text-white hover:bg-green-600 transition
              flex items-center justify-center gap-3"
          >
            <FaSignInAlt className="text-xl" />
            تسجيل الدخول
          </button>

          <button
            onClick={() => setOpen(false)}
            className="flex-1 py-3 text-lg rounded-xl border border-gray-300 hover:bg-gray-200
             dark:hover:bg-zinc-800 transition"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

export default PopupLogIn;
