// MainRoutes.jsx
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
// import LogInEnter from "./pages/logIn/LogInEnter";
// import LogInEnd from "./pages/logIn/LogInEnd";

const MainRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/ar" replace />} />
      {/* <Route path="/LogInEnter" element={<LogInEnter />} />
      <Route path="/LogInEnd" element={<LogInEnd />} /> */}

      <Route path="/:lang" element={<MainLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="attendance-groups/attendance-record" element={<AttendanceRecord/>} />
        <Route path="attendance-groups" element={<AttendanceGroups />} />
        <Route path="attendance-groups/:id" element={<AttendancePage />} />

        <Route path="recitation-groups" element={<RecitationGroups />} />
        <Route path="recitation-groups/recitation-records" element={<RecitationRecords />} />
        <Route path="recitation-groups/:id" element={<RecitationPage />} />
        <Route path="recitation-groups/:groupId/students/:studentId" element={<RecitationRegistration />} />

        <Route path="all-student" element={<AllStudent />} />
        <Route path="all-student/StudentProfile/:id" element={<StudentProfile />} />

        <Route path="reports" element={<Reports />} />
        {/* <Route path="Recitation" element={<Recitation />} />
        <Route path="Initiatives" element={<Initiatives />} />
        <Route path="Reports" element={<Reports />} /> */}
      </Route>
    </Routes>
  );
};

export default MainRoutes;
