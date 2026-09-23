import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Hexagon, UserCircle, Buildings } from '@phosphor-icons/react';

export default function RoleSelection() {
  const navigate = useNavigate();

  const handleSelectRole = (role) => {
    localStorage.setItem('jobsphere_role', role);
    if (role === 'user') {
      navigate('/seeker');
    } else if (role === 'company') {
      navigate('/company');
    }
  };

  return (
    <div id="role-screen">
      <div className="role-logo">
        <Hexagon weight="fill" />
        Job<span>Sphere</span>
      </div>
      <div className="role-heading">
        <h2>Welcome! How are you joining?</h2>
        <p>Choose your account type to get started</p>
      </div>
      <div className="role-cards">
        <div 
          className="role-card user-card" 
          onClick={() => handleSelectRole('user')}
        >
          <UserCircle weight="fill" />
          <h3>I'm a Job Seeker</h3>
          <p>Find and apply for your dream job</p>
        </div>
        <div 
          className="role-card company-card" 
          onClick={() => handleSelectRole('company')}
        >
          <Buildings weight="fill" />
          <h3>I'm a Company</h3>
          <p>Post jobs and find top talent</p>
        </div>
      </div>
    </div>
  );
}
