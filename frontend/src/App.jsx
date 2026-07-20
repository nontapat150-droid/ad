import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import NotificationProvider from './components/NotificationProvider';
import Login from './pages/Login';
import CheckinPage from './pages/CheckinPage';
import OilDashboardPage from './pages/OilDashboardPage';
import UserManagementPage from './pages/UserManagementPage';
import CustomersPage from './pages/CustomersPage';
import DispatchDashboardPage from './pages/DispatchDashboardPage';
import InventoryDashboardPage from './pages/InventoryDashboardPage';
import TechBagPage from './pages/TechBagPage';
import EntryFeePage from './pages/EntryFeePage';
import AttendanceSummaryPage from './pages/AttendanceSummaryPage';
import MaPerformancePage from './pages/MaPerformancePage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import UnifiedDashboard from './pages/UnifiedDashboard';
import AisExpansionPage from './pages/AisExpansionPage';
import ReportIssuePage from './pages/ReportIssuePage';
import TechOilHistoryPage from './pages/TechOilHistoryPage';
import SystemSettingsPage from './pages/SystemSettingsPage';
import ContractorInventoryPage from './pages/ContractorInventoryPage';

// ── Protected Route ─────────────────────────────────────────
function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex', height: '100dvh', alignItems: 'center',
        justifyContent: 'center', background: '#020617',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: '3px solid rgba(59,130,246,0.3)', borderTopColor: '#3B82F6',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ color: '#94A3B8', fontSize: 14 }}>Loading...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  
  const userRoles = user.roles || [user.role];
  if (allowedRoles.length > 0 && !userRoles.some(r => allowedRoles.includes(r))) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to="/dashboard" replace />;
}

// ── App Routes ────────────────────────────────────────────────
function AppRoutes() {
  useEffect(() => {
    AOS.init({
      duration: 700,
      easing:   'ease-out-cubic',
      once:     true,
      mirror:   false,
      offset:   40,
    });
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <UnifiedDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dispatch-dashboard"
        element={
          <ProtectedRoute allowedRoles={['technician', 'ma_technician', 'contractor_office', 'contractor_ma', 'super_admin', 'admin']}>
            <DispatchDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkin"
        element={
          <ProtectedRoute allowedRoles={['sales', 'admin', 'super_admin', 'technician', 'ma_technician', 'contractor_office', 'contractor_ma']}>
            <CheckinPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/oil"
        element={
          <ProtectedRoute>
            <OilDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <UserManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers"
        element={
          <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
            <CustomersPage />
          </ProtectedRoute>
        }
      />
      <Route path="/inventory" element={<ProtectedRoute allowedRoles={['super_admin', 'admin']}><InventoryDashboardPage /></ProtectedRoute>} />
      <Route path="/bag" element={<ProtectedRoute allowedRoles={['technician', 'ma_technician', 'contractor_office', 'contractor_ma', 'super_admin', 'admin']}><TechBagPage /></ProtectedRoute>} />
      <Route path="/entry-fee" element={<ProtectedRoute allowedRoles={['technician', 'contractor_office', 'super_admin', 'admin']}><EntryFeePage /></ProtectedRoute>} />
      <Route path="/attendance-summary" element={<ProtectedRoute allowedRoles={['super_admin', 'admin']}><AttendanceSummaryPage /></ProtectedRoute>} />
      <Route path="/ma-performance" element={<ProtectedRoute allowedRoles={['super_admin']}><MaPerformancePage /></ProtectedRoute>} />
      <Route path="/announcements" element={<ProtectedRoute allowedRoles={['super_admin', 'admin']}><AnnouncementsPage /></ProtectedRoute>} />
      <Route path="/ais-expansion" element={<ProtectedRoute allowedRoles={['super_admin', 'admin', 'ma_technician', 'technician', 'contractor_office', 'contractor_ma', 'sales']}><AisExpansionPage /></ProtectedRoute>} />
      <Route path="/oil-history" element={<ProtectedRoute allowedRoles={['technician', 'ma_technician', 'contractor_office', 'contractor_ma', 'sales', 'super_admin', 'admin']}><TechOilHistoryPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute allowedRoles={['super_admin']}><SystemSettingsPage /></ProtectedRoute>} />
      <Route path="/contractor-inventory" element={<ProtectedRoute allowedRoles={['super_admin', 'admin']}><ContractorInventoryPage /></ProtectedRoute>} />
      <Route path="/report" element={<ProtectedRoute><ReportIssuePage /></ProtectedRoute>} />

      {/* Default: redirect based on role */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

import { BrandingProvider } from './context/BrandingContext';

export default function App() {
  return (
    <AuthProvider>
      <BrandingProvider>
        <BrowserRouter>
          <NotificationProvider>
            <AppRoutes />
          </NotificationProvider>
        </BrowserRouter>
      </BrandingProvider>
    </AuthProvider>
  );
}

// Force HMR reload
