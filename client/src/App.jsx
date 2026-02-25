import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Operations from './pages/Operations';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import ImportPage from './pages/ImportPage';
import UserManagement from './pages/UserManagement';
import LoginPage from './pages/LoginPage';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import TransactionHistory from './pages/TransactionHistory';
import MobileScanner from './pages/MobileScanner';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/mobile" element={<MobileScanner />} />

            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/operations" element={<Operations />} />
              <Route path="/history" element={<TransactionHistory />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/users" element={<UserManagement />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
