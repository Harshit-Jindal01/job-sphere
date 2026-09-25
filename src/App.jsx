import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import RoleSelection from './pages/RoleSelection';
import SeekerPage from './pages/SeekerPage';
import CompanyDashboard from './components/CompanyDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RoleSelection />} />
        <Route path="/seeker" element={<SeekerPage />} />
        <Route path="/company" element={<CompanyDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

