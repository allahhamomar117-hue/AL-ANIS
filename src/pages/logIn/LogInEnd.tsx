import { useEffect, useState } from "react";
import type { FormProps } from "./types/TypeLogIn";
import { useLocation } from "react-router-dom";
import { InputOTPPattern } from "@/pages/logIn/Opt";
import { SendOtpApi } from "./services/sendOtpApi";
import { useNavigate } from "react-router-dom";
import { FaHome } from "react-icons/fa";

function LogInEnd() {
  const [error, setError] = useState("");
  const [number, setNumber] = useState("");
  const [timeLeft, setTimeLeft] = useState(
    Number(localStorage.getItem("canResend") || 0)
  );
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const phoneNumber = params.get("phone") || "";
  const countryCode = params.get("country_code") || "";
  const navigate = useNavigate();

  const loginMutation = SendOtpApi(setError, setTimeLeft);
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1;
        localStorage.setItem("canResend", newTime.toString());
        if (newTime <= 0) clearInterval(timer);
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleSubmit = () => {
    const data: FormProps = {
      phone_number: phoneNumber,
      country_code: countryCode,
      fcm_token: "23r24t35t...",
      app: "CLIENT",
      otp: String(number),
    };

    loginMutation.mutate(data);
  };
  const handleResend = () => {
    if (timeLeft > 0) return;

    const data: FormProps = {
      phone_number: phoneNumber,
      country_code: countryCode,
      fcm_token: "23r24t35t...",
      app: "CLIENT",
    };

    loginMutation.mutate(data);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (    <div className="min-h-screen bg-green-400 flex flex-col">
    <div
  onClick={() => navigate("/")}
  className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 text-white cursor-pointer bg-black w-fit rounded-xl z-50"
>
  <FaHome />
  <span>العودة إلى الصفحة الرئيسية</span>
</div>

    <div className="min-h-screen flex items-center justify-center ">

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 space-y-4 m-4">
        <h1 className="text-xl font-bold text-center">
          لقد تم ارسال رمز التحقق الى الرقم
        </h1>{" "}
        <form
          action=""
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div className="flex items-center justify-center">
            <InputOTPPattern onChange={(value: string) => setNumber(value)} />
          </div>
          <div>
            {timeLeft > 0 ? (
              `${formatTime(timeLeft)}`
            ) : (
              <button
                className={`text-blue-500 cursor-pointer ${
                  timeLeft > 0 ? "opacity-50 pointer-events-none" : ""
                }`}
                onClick={handleResend}
              >
                اعادة ارسال
              </button>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={loginMutation.isPending}
            className="w-full rounded-xl bg-green-500 py-3 text-white flex justify-center"
          >
            {loginMutation.isPending ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "تأكيد"
            )}
          </button>
        </form>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
    </div>
  );
}

export default LogInEnd;
