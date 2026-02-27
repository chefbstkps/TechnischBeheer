import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ReactQueryProvider } from './contexts/ReactQueryProvider';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PageVisibilityGuard from './components/PageVisibilityGuard';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Organisatie from './pages/Organisatie';
import Brands from './pages/Brands';
import VehicleManagement from './pages/VehicleManagement';
import VehicleDetail from './pages/VehicleDetail';
import Werkzaamheden from './pages/Werkzaamheden';
import Repairs from './pages/Repairs';
import ActivityDetail from './pages/ActivityDetail';
import PartsManagement from './pages/PartsManagement';
import Profile from './pages/Profile';
import UserManagement from './pages/UserManagement';
import UserDetails from './pages/UserDetails';
import UsersLog from './pages/UsersLog';
import './App.css';

export default function App() {
  return (
    <ReactQueryProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route element={<PageVisibilityGuard />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/organisatie" element={<Organisatie />} />
                <Route path="/brands" element={<Brands />} />
                <Route path="/automontage" element={<VehicleManagement />} />
                <Route path="/automontage/voertuig/:id" element={<VehicleDetail />} />
                <Route path="/werkzaamheden" element={<Werkzaamheden />} />
                <Route path="/reparaties" element={<Repairs />} />
                <Route path="/werkzaamheden/melding/:id" element={<ActivityDetail />} />
                <Route path="/onderdelen" element={<PartsManagement />} />
                <Route
                  path="/user-management"
                  element={
                    <ProtectedRoute requireAdmin>
                      <UserManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/user-management/:id"
                  element={
                    <ProtectedRoute requireAdmin>
                      <UserDetails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/users-log"
                  element={
                    <ProtectedRoute requireAdmin>
                      <UsersLog />
                    </ProtectedRoute>
                  }
                />
              </Route>
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ReactQueryProvider>
  );
}
