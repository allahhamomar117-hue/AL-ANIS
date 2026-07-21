import { useState } from "react";
import type { FormProps } from "./types/TypeLogIn";
import { SendPhoneApi } from "./services/sendPhoneApi";
import { useNavigate } from "react-router-dom";
import { FaHome } from "react-icons/fa";

function LogInEnter() {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const loginMutation = SendPhoneApi(phone, setError);

  const handleSubmit = () => {
    if (phone.length < 9) {
      setError("رقم الموبايل غير صحيح");
      return;
    }

    const data: FormProps = {
      phone_number: String(phone),
      country_code: "963",
      fcm_token: "23r24t35t...",
      app: "CLIENT",
    };

    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-green-400 flex flex-col">
      
      {/* زر الرجوع */}
<div
  onClick={() => navigate("/")}
  className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 text-white cursor-pointer bg-black w-fit rounded-xl z-50"
>
  <FaHome />
  <span>العودة إلى الصفحة الرئيسية</span>
</div>


      {/* المحتوى بمنتصف الشاشة */}
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-5">
          
          <h1 className="text-2xl font-bold text-center text-gray-800">
            تسجيل الدخول
          </h1>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-4"
          >
            <input
              type="tel"
              placeholder="09XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-400"
            />

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <button
              disabled={loginMutation.isPending}
              className="w-full rounded-xl bg-green-500 py-3 text-white font-semibold flex justify-center items-center hover:bg-green-600 transition"
            >
              {loginMutation.isPending ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "متابعة"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LogInEnter;
