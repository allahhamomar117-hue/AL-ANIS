import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./MainLayout";
import Dashboard from "./pages/Dashboard/Dashboard";
import AttendancePage from "./pages/Attendance/AttendancePage";
import AttendanceGroups from "./pages/Attendance/AttendanceGroups";
import RecitationGroups from "./pages/Recitation/RecitationGroups";
import Reports from "./pages/Reports/Reports";
import RecitationPage from "./pages/Recitation/RecitationPage";
import RecitationRegistration from "./pages/Recitation/RecitationRegistration";
import AttendanceRecord from "./pages/Attendance/AttendanceRecord";
import RecitationRecords from "./pages/Recitation/RecitationRecords";
import AllStudent from "./pages/ِِAllStudent/AllStudent";
import StudentProfile from "./pages/ِِAllStudent/StudentProfile";
import SettingsPage from "./pages/Settings/SettingsPage";
import StaffPage from "./pages/Staff/StaffPage";
import ProtectedRoute from "./shared/ProtectedRoute";
import RequireManager from "./shared/RequireManager";
import HalaqatPage from "./pages/Halaqat/HalaqatPage";
import LoginPage from "./pages/logIn/LoginPage";

const MainRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/ar" replace />} />

      {/* ===== مسارات عامة (بلا حماية) ===== */}
      <Route path="/login" element={<LoginPage />} />

      {/* المسارات القديمة تُحوَّل إلى الجديدة حفاظاً على الروابط المحفوظة */}
      <Route path="/LogInEnter" element={<Navigate to="/login" replace />} />
      <Route path="/LogInEnd" element={<Navigate to="/login" replace />} />
      <Route path="/login/verify" element={<Navigate to="/login" replace />} />

      {/* ===== مسارات التطبيق: كلها خلف حارس الجلسة ===== */}
      <Route
        path="/:lang"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="attendance-groups/attendance-record" element={<AttendanceRecord />} />
        <Route path="attendance-groups" element={<AttendanceGroups />} />
        <Route path="attendance-groups/:id" element={<AttendancePage />} />

        <Route path="recitation-groups" element={<RecitationGroups />} />
        <Route path="recitation-groups/recitation-records" element={<RecitationRecords />} />
        <Route path="recitation-groups/:id" element={<RecitationPage />} />
        <Route
          path="recitation-groups/:groupId/students/:studentId"
          element={<RecitationRegistration />}
        />

        {/* صفحة الطلاب: المشرف يرى الجميع بكامل الصلاحيات،
            والمدرّس يرى طلاب حلقته للاطّلاع فقط (النطاق والصلاحيات من الخادم). */}
        <Route path="all-student" element={<AllStudent />} />
        <Route path="all-student/StudentProfile/:id" element={<StudentProfile />} />

        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<SettingsPage />} />

        {/* إدارة الحلقات: للمدير وحده — منها تُشتقّ كل قوائم اختيار الحلقات */}
        <Route
          path="halaqat"
          element={
            <RequireManager>
              <HalaqatPage />
            </RequireManager>
          }
        />

        {/* إدارة الكادر: للمدير وحده — الخادم يرد 403 لغيره على أي حال */}
        <Route
          path="staff"
          element={
            <RequireManager>
              <StaffPage />
            </RequireManager>
          }
        />
      </Route>

      {/* أي مسار آخر: إلى الصفحة الرئيسية (ومنها الحارس إلى /login عند اللزوم) */}
      <Route path="*" element={<Navigate to="/ar" replace />} />
    </Routes>
  );
};

export default MainRoutes;
