import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Scheduler from './components/Scheduler';
import DataManagement from './components/DataManagement';
import Settings from './components/Settings';
import { StoreProvider } from './context/StoreContext';

const App: React.FC = () => {
  return (
    <StoreProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/schedule" element={<Scheduler />} />
            <Route path="/resources" element={<DataManagement />} />
            <Route path="/analytics" element={<Navigate to="/" replace />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </HashRouter>
    </StoreProvider>
  );
};

export default App;
