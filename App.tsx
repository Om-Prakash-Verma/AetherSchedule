import React, { useState, lazy, Suspense } from 'react';
import { useAppContext } from './hooks/useAppContext';
import { Layout } from './components/Layout';
import LoginPage from './pages/LoginPage';
import Homepage from './pages/Homepage';
import PublicHowItWorks from './pages/PublicHowItWorks';
import PublicAlgorithmDeepDive from './pages/PublicAlgorithmDeepDive';
import { GlassPanel } from './components/GlassPanel';
import { AlertTriangle, Loader2 } from 'lucide-react';

// Lazy load all page components for code-splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MyTimetable = lazy(() => import('./pages/MyTimetable'));
const Scheduler = lazy(() => import('./pages/Scheduler'));
const DataManagement = lazy(() => import('./pages/DataManagement'));
const Constraints = lazy(() => import('./pages/Constraints'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Settings = lazy(() => import('./pages/Settings'));

const PageLoader: React.FC = () => (
  <div className="flex justify-center items-center h-64">
    <Loader2 className="animate-spin h-8 w-8 text-[var(--accent)]" />
  </div>
);


const App: React.FC = () => {
  const { user, currentPage, isLoading, appInitializationError } = useAppContext();
  const [publicPage, setPublicPage] = useState<'Homepage' | 'HowItWorks' | 'AlgorithmDeepDive'>('Homepage');
  const [showLogin, setShowLogin] = useState(false);

  const renderPage = () => {
    switch (currentPage) {
      case 'Dashboard': return <Dashboard />;
      case 'My Timetable': return <MyTimetable />;
      case 'Scheduler': return <Scheduler />;
      case 'Data Management': return <DataManagement />;
      case 'Constraints': return <Constraints />;
      case 'Analytics': return <Analytics />;
      case 'Settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  // FIX: Added a dedicated error screen for critical startup failures.
  if (appInitializationError) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <GlassPanel className="max-w-3xl p-8 text-center border-[var(--danger)]">
          <AlertTriangle className="mx-auto h-12 w-12 text-[var(--danger)]" />
          <h1 className="mt-4 text-2xl font-bold text-[var(--text-white)]">Application Startup Failed</h1>
          <p className="mt-2 text-[var(--text-muted)]">A critical error occurred while connecting to the backend services.</p>
          <div className="mt-4 p-4 bg-[var(--panel-strong)] rounded-lg text-left font-mono text-sm text-[var(--red-400)] overflow-x-auto">
            <code>{appInitializationError}</code>
          </div>
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            If you are running this locally, please ensure your backend server is running and the database schema has been pushed using 
            <code className="bg-[var(--panel-strong)] px-2 py-1 rounded-md text-[var(--text-white)] mx-1">npx drizzle-kit push</code>.
          </p>
        </GlassPanel>
      </div>
    );
  }

  if (!user) {
    if (showLogin) {
      return <LoginPage onBackToHome={() => setShowLogin(false)} />;
    }
    
    switch (publicPage) {
      case 'Homepage':
        return <Homepage onGoToApp={() => setShowLogin(true)} onShowHowItWorks={() => setPublicPage('HowItWorks')} onShowAlgorithmDeepDive={() => setPublicPage('AlgorithmDeepDive')} onGoToHome={() => setPublicPage('Homepage')} />;
      case 'HowItWorks':
        {/* FIX: Pass onShowHowItWorks prop to satisfy PublicHowItWorksProps. */}
        return <PublicHowItWorks onGoToApp={() => setShowLogin(true)} onGoToHome={() => setPublicPage('Homepage')} onShowAlgorithmDeepDive={() => setPublicPage('AlgorithmDeepDive')} onShowHowItWorks={() => setPublicPage('HowItWorks')} />;
      case 'AlgorithmDeepDive':
        {/* FIX: Pass onShowAlgorithmDeepDive prop to satisfy PublicAlgorithmDeepDiveProps. */}
        return <PublicAlgorithmDeepDive onGoToApp={() => setShowLogin(true)} onGoToHome={() => setPublicPage('Homepage')} onShowHowItWorks={() => setPublicPage('HowItWorks')} onShowAlgorithmDeepDive={() => setPublicPage('AlgorithmDeepDive')} />;
      default:
        return <Homepage onGoToApp={() => setShowLogin(true)} onShowHowItWorks={() => setPublicPage('HowItWorks')} onShowAlgorithmDeepDive={() => setPublicPage('AlgorithmDeepDive')} onGoToHome={() => setPublicPage('Homepage')} />;
    }
  }

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        {renderPage()}
      </Suspense>
    </Layout>
  );
};

export default App;