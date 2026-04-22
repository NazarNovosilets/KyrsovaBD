import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [userStats, setUserStats] = useState({
    rank: 0,
    totalManagers: 0,
    totalPoints: 0,
    pointsChange: 0,
    pointsBehind: 0,
    gameweekPoints: 0,
    gameweekChange: 0,
    teamValue: '£0M',
    gameweek: 'GW 25',
    userEmail: '',
    userName: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 🔓 Logout функція
  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('email');
    localStorage.removeItem('fullName');
    navigate('/login');
  };

    useEffect(() => {
     const fetchLeaderboard = async () => {
       try {
         setLoading(true);

         // 📥 Отримуємо дані з localStorage
         const userEmail = localStorage.getItem('email');
         const userName = localStorage.getItem('fullName');
         const userId = localStorage.getItem('userId');

         console.log(`👤 userId знайдено: ${userId}`);

         if (!userId) {
           throw new Error('userId не знайдено у localStorage');
         }

         // 📡 Завантажуємо дані поточного користувача
         const statsResponse = await fetch(`/api/auth/stats/${userId}`);

         if (!statsResponse.ok) {
           throw new Error(`HTTP ${statsResponse.status}: Помилка при завантаженні статистики`);
         }

         const statsData = await statsResponse.json();
         console.log('✅ Статистика користувача отримана:', statsData);

         // 📡 Завантажуємо лідерборд з API
         const leaderboardResponse = await fetch('/api/auth/leaderboard');

         if (!leaderboardResponse.ok) {
           throw new Error(`HTTP ${leaderboardResponse.status}: Помилка при завантаженні лідерборду`);
         }

         const leaderboardData = await leaderboardResponse.json();
         console.log('✅ Дані лідерборду отримані:', leaderboardData);

         // Встановлюємо лідерборд
         setLeaderboard(leaderboardData.leaderboard || []);

         // Встановлюємо статистику поточного користувача
         if (statsData.stats) {
           const userStats = statsData.stats;
           const leader = leaderboardData.leaderboard ? leaderboardData.leaderboard[0] : null;
           const pointsBehind = leader ? leader.points - userStats.points : 0;

           setUserStats(prev => ({
             ...prev,
             rank: userStats.rank,
             totalManagers: userStats.totalManagers,
             totalPoints: userStats.points,
             pointsBehind: pointsBehind > 0 ? pointsBehind : 0,
             userEmail: userEmail,
             userName: userName
           }));

           console.log(`🏆 ${userName} - Ранг: ${userStats.rank}/${userStats.totalManagers}, Балів: ${userStats.points}`);
         }

         setError(null);
       } catch (err) {
         console.error('❌ Помилка при завантаженні:', err);
         setError(err.message);
       } finally {
         setLoading(false);
       }
     };

     fetchLeaderboard();
    }, []);

  const getRankBadge = (rank) => {
    const badges = { 1: '🥇', 2: '🥈', 3: '🥉' };
    return badges[rank] || rank;
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo">⚽ UPL Fantasy</div>
          <span className="league-name">Ukrainian Premier League</span>
        </div>
        <nav className="nav-menu">
          <a href="#dashboard" className="nav-item active">Dashboard</a>
          <a href="#team" className="nav-item">My Team</a>
          <a href="#leagues" className="nav-item">Leagues</a>
          <a href="#matches" className="nav-item">Matches</a>
          <a href="#statistics" className="nav-item">Statistics</a>
        </nav>
        <div className="header-right">
          <button className="user-btn">👤 User</button>
          <div className="manager-info">
            <span className="rank-label">Manager</span>
            <span className="rank">Rank #{userStats.rank} • {userStats.totalPoints.toLocaleString()} pts</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="dashboard-content">
        {/* Top Info Bar */}
        <div className="info-bar">
          <div className="info-item">
            <span className="info-label">GLOBAL RANK</span>
            <span className="info-value">#{userStats.rank}</span>
          </div>
          <div className="info-item">
            <span className="info-label">TOTAL POINTS</span>
            <span className="info-value">{userStats.totalPoints.toLocaleString()}</span>
          </div>
          <div className="info-item">
            <span className="info-label">TEAM VALUE</span>
            <span className="info-value" style={{ color: '#10b981' }}>{userStats.teamValue}</span>
          </div>
          <div className="gameweek-badge">
            <span className="gameweek-label">GAMEWEEK</span>
            <span className="gameweek-number">{userStats.gameweek}</span>
            <span className="deadline">Deadline<br/>Apr 5, 15:00</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-header">Your Rank</div>
            <div className="stat-value">#{userStats.rank}</div>
            <div className="stat-subtitle">/ {userStats.totalManagers.toLocaleString()}</div>
            <div className="stat-footer">🏆 Top 0.01%</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">Total Points</div>
            <div className="stat-main">
              <span className="stat-value">{userStats.totalPoints}</span>
              <span className="stat-change">+{userStats.pointsChange}</span>
            </div>
            <div className="stat-subtitle">{userStats.pointsBehind} pts behind leader</div>
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">This Gameweek</div>
            <div className="stat-value">{userStats.gameweekPoints}</div>
            <div className="stat-subtitle">
              <span className="increase">📈 +{userStats.gameweekChange} from last week</span>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="leaderboard">
          <div className="leaderboard-header">
            <h2>🏅 Global Leaderboard</h2>
            <span className="leaderboard-subtitle">Top managers in the UPL Fantasy League</span>
            <span className="managers-count">Gameweek 25<br/>{userStats.totalManagers} Managers</span>
          </div>

          {loading ? (
            <div className="loading">Завантаження даних...</div>
          ) : error && leaderboard.length === 0 ? (
            <div className="error-message">Помилка при завантаженні лідерборду: {error}</div>
          ) : (
            <div className="leaderboard-list">
              {leaderboard.map((manager, index) => (
                <div key={index} className={`leaderboard-item ${manager.rank === 4 || manager.name === 'You' ? 'current-user' : ''}`}>
                  <div className="rank-badge">{getRankBadge(manager.rank)}</div>
                  <div className="manager-profile">
                    <div className="manager-avatar">👤</div>
                    <div className="manager-details">
                      <div className="manager-name">{manager.name}</div>
                      {manager.status && (
                        <div className="manager-status">
                          {manager.status === 'Champion' && '👑 Champion'}
                          {manager.status === 'Runner Up' && `🏃 ${manager.status} ${manager.statusDetail || ''}`}
                          {manager.status === 'Third Place' && `🎯 ${manager.status} ${manager.statusDetail || ''}`}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="manager-points">{manager.points}<span className="points-label">points</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
