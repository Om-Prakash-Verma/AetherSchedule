import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout, { PublicLayout } from './components/Layout';
import Dashboard from './components/Dashboard';
import Scheduler from './components/Scheduler';
import DataManagement from './components/DataManagement';
import StudentPortal from './components/StudentPortal';
import FacultyPortal from './components/FacultyPortal';
import Analytics from './components/Analytics';
import Settings from './components/Settings';
import Login from './components/Login';
import { StoreProvider, useStore } from './context/StoreContext';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children }: React.PropsWithChildren) => {
  const { user, loading } = useStore();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950 text-primary">
        <Loader2 size={40} className="animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};

const App: React.FC = () => {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Public Routes */}
          <Route path="/student-portal" element={
              <PublicLayout>
                  <StudentPortal />
              </PublicLayout>
          } />
          
          <Route path="/faculty-portal" element={
              <PublicLayout>
                  <FacultyPortal />
              </PublicLayout>
          } />
          
          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/schedule" element={<ProtectedRoute><Scheduler /></ProtectedRoute>} />
          <Route path="/resources" element={<ProtectedRoute><DataManagement /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </StoreProvider>
  );
};

export default App;