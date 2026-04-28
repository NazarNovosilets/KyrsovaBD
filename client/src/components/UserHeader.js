import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import './UserHeader.css';

function UserHeader() {
  const navigate = useNavigate();
  const role = localStorage.getItem('role');
  const isAnalyst = role === 'analyst' || role === 'analytics';
  const [manager, setManager] = useState({
    name: localStorage.getItem('fullName') || localStorage.getItem('email') || 'User',
    points: 0
  });

  useEffect(() => {
    const userId = localStorage.getItem('userId');

    setManager((prev) => ({
      ...prev,
      name: localStorage.getItem('fullName') || localStorage.getItem('email') || 'User'
    }));

    if (!userId) {
      return;
    }

    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/auth/stats/${userId}`);

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const stats = data.stats || {};

        setManager({
          name: localStorage.getItem('fullName') || stats.name || localStorage.getItem('email') || 'User',
          points: Number(stats.points) || 0
        });
      } catch (err) {
        console.error('Header stats load error:', err);
      }
    };

    fetchStats();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('email');
    localStorage.removeItem('fullName');
    localStorage.removeItem('role');
    navigate('/login');
  };

  return (
    <header className="user-header">
      <div className="user-header__brand">
        <div className="user-header__logo">⚽ UPL Fantasy</div>
        <span className="user-header__league">Ukrainian Premier League</span>
      </div>

      <nav className="user-header__nav">
        {isAnalyst ? (
          <NavLink to="/analytics" className={({ isActive }) => `user-header__link${isActive ? ' is-active' : ''}`}>
            Live Matches
          </NavLink>
        ) : (
          <>
            <NavLink to="/dashboard" className={({ isActive }) => `user-header__link${isActive ? ' is-active' : ''}`}>
              Dashboard
            </NavLink>
            <NavLink to="/team-builder" className={({ isActive }) => `user-header__link${isActive ? ' is-active' : ''}`}>
              My Team
            </NavLink>
            <NavLink to="/matches" className={({ isActive }) => `user-header__link${isActive ? ' is-active' : ''}`}>
              Matches
            </NavLink>
          </>
        )}
      </nav>

      <div className="user-header__meta">
        <button className="user-header__logout" onClick={handleLogout}>Logout</button>
        <div className="user-header__manager">
          <span className="user-header__label">{isAnalyst ? 'Analyst' : 'Manager'}</span>
          <span className="user-header__value">
            {isAnalyst ? manager.name : `${manager.name} • ${manager.points.toLocaleString()} pts`}
          </span>
        </div>
      </div>
    </header>
  );
}

export default UserHeader;
