import React, { useState } from 'react';
import { useAppContext } from './hooks/useAppContext';
import { Layout } from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import MyTimetable from './pages/MyTimetable';
import Scheduler from './pages/Scheduler';
import DataManagement from './pages/DataManagement';
import Constraints from './pages/Constraints';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Homepage from './pages/Homepage';
import PublicHowItWorks from './pages/PublicHowItWorks';
import PublicAlgorithmDeepDive from './pages/PublicAlgorithmDeepDive';

const App: React.FC = () => {
  const { user, currentPage, isLoading } = useAppContext();
  const [publicPage, setPublicPage] = useState<'Homepage' | 'HowItWorks' | 'AlgorithmDeepDive'>('Homepage');
  const [showLogin, setShowLogin] = useState(false);

  const renderPage = () => {
    switch (currentPage) {
      case 'Dashboard': return <Dashboard />;
      case 'My Timetable': return <MyTimetable />;
      case 'Scheduler': return <Scheduler />;
      case 'Data Management': return <DataManagement />;
      case 'Constraints': return <Constraints />;
      case 'Reports': return <Reports />;
      case 'Settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-white text-lg animate-pulse">Loading Application...</p>
      </div>
    );
  }

  if (!user) {
    if (showLogin) {
      return <LoginPage onBackToHome={() => setShowLogin(false)} />;
    }
    
    switch (publicPage) {
      case 'Homepage':
        return <Homepage onGoToApp={() => setShowLogin(true)} onShowHowItWorks={() => setPublicPage('HowItWorks')} onShowAlgorithmDeepDive={() => setPublicPage('AlgorithmDeepDive')} />;
      case 'HowItWorks':
        return <PublicHowItWorks onGoToApp={() => setShowLogin(true)} onGoToHome={() => setPublicPage('Homepage')} onShowAlgorithmDeepDive={() => setPublicPage('AlgorithmDeepDive')} />;
      case 'AlgorithmDeepDive':
        return <PublicAlgorithmDeepDive onGoToApp={() => setShowLogin(true)} onGoToHome={() => setPublicPage('Homepage')} onShowHowItWorks={() => setPublicPage('HowItWorks')} />;
      default:
        return <Homepage onGoToApp={() => setShowLogin(true)} onShowHowItWorks={() => setPublicPage('HowItWorks')} onShowAlgorithmDeepDive={() => setPublicPage('AlgorithmDeepDive')} />;
    }
  }

  return (
    <Layout>
      {renderPage()}
    </Layout>
  );
};

export default App;