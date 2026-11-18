import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout, ProtectedRoute, PublicLayout } from './components/layout/Layouts';
import Landing from './pages/public/Landing';
import HowItWorks from './pages/public/HowItWorks';
import { Login, NotFound, Register } from './pages/public/Auth';
import { CitizenDashboard, MyReports } from './pages/citizen/CitizenPages';
import NewReport from './pages/citizen/NewReport';
import ReportDetail from './pages/shared/ReportDetail';
import { MapPage, ProfilePage } from './pages/shared/SharedPages';
import {
  AdminDashboard, AdminIncidents, AdminReports, Analytics, DuplicateReview,
} from './pages/admin/AdminPages';
import IncidentDetail from './pages/admin/IncidentDetail';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route element={<ProtectedRoute role="citizen" />}>
        <Route path="/app" element={<AppLayout variant="citizen" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<CitizenDashboard />} />
          <Route path="report/new" element={<NewReport />} />
          <Route path="reports" element={<MyReports />} />
          <Route path="reports/:id" element={<ReportDetail />} />
          <Route path="map" element={<MapPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute role="admin" />}>
        <Route path="/admin" element={<AppLayout variant="admin" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="reports/:id" element={<ReportDetail admin />} />
          <Route path="duplicates" element={<DuplicateReview />} />
          <Route path="incidents" element={<AdminIncidents />} />
          <Route path="incidents/:id" element={<IncidentDetail />} />
          <Route path="map" element={<MapPage admin />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>
    </Routes>
  );
}
