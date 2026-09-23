import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import RoleSelection from './pages/RoleSelection';

function SeekerPlaceholder() {
  return (
    <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <h1>Seeker Dashboard — migration coming next</h1>
    </div>
  );
}

function CompanyPlaceholder() {
  return (
    <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <h1>Company Dashboard — migration coming next</h1>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RoleSelection />} />
        <Route path="/seeker" element={<SeekerPlaceholder />} />
        <Route path="/company" element={<CompanyPlaceholder />} />
      </Routes>
    </BrowserRouter>
  );
}

