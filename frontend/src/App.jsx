import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import TechDashboard from './pages/TechDashboard';
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
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import OfficeTechDashboard from './pages/OfficeTechDashboard';
import MaTechDashboard from './pages/MaTechDashboard';
import AisExpansionPage from './pages/AisExpansionPage';

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
  const userRoles = user.roles || [user.role];
  if (userRoles.includes('super_admin')) return <Navigate to="/super-admin" replace />;
  if (userRoles.includes('admin')) return <Navigate to="/admin" replace />;
  if (userRoles.includes('sales')) return <Navigate to="/checkin" replace />;
  if (userRoles.includes('technician') || userRoles.includes('office_technician')) return <Navigate to="/office-tech" replace />;
  if (userRoles.includes('ma_technician')) return <Navigate to="/ma-tech" replace />;
  return <Navigate to="/login" replace />;
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
        path="/super-admin"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/office-tech"
        element={
          <ProtectedRoute allowedRoles={['technician', 'office_technician', 'super_admin', 'admin']}>
            <OfficeTechDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ma-tech"
        element={
          <ProtectedRoute allowedRoles={['ma_technician', 'super_admin', 'admin']}>
            <MaTechDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs"
        element={
          <ProtectedRoute allowedRoles={['technician', 'ma_technician', 'super_admin', 'admin']}>
            <DispatchDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkin"
        element={
          <ProtectedRoute allowedRoles={['sales', 'admin', 'super_admin']}>
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
      <Route path="/bag" element={<ProtectedRoute allowedRoles={['technician', 'ma_technician', 'super_admin', 'admin']}><TechBagPage /></ProtectedRoute>} />
      <Route path="/entry-fee" element={<ProtectedRoute allowedRoles={['technician', 'super_admin', 'admin']}><EntryFeePage /></ProtectedRoute>} />
      <Route path="/attendance-summary" element={<ProtectedRoute allowedRoles={['super_admin', 'admin']}><AttendanceSummaryPage /></ProtectedRoute>} />
      <Route path="/ma-performance" element={<ProtectedRoute allowedRoles={['super_admin']}><MaPerformancePage /></ProtectedRoute>} />
      <Route path="/announcements" element={<ProtectedRoute allowedRoles={['super_admin', 'admin']}><AnnouncementsPage /></ProtectedRoute>} />
      <Route path="/ais-expansion" element={<ProtectedRoute allowedRoles={['super_admin', 'admin', 'ma_technician', 'technician', 'sales']}><AisExpansionPage /></ProtectedRoute>} />

      {/* Default: redirect based on role */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

// Force HMR reload
