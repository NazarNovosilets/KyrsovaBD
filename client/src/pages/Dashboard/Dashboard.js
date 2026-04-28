import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import UserHeader from '../../components/UserHeader';
import './Dashboard.css';

function Dashboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [userStats, setUserStats] = useState({
    rank: 0,
    totalManagers: 0,
    totalPoints: 0,
    pointsChange: 0,
    pointsBehind: 0,
    gameweekPoints: 0,
    gameweekChange: 0,
    teamValue: '0.0M',
    gameweek: 'Current',
    userEmail: '',
    userName: '',
    teamName: 'Create your team',
    teamPoints: 0,
    teamId: null,
    hasTeam: false,
    topPercent: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const numericUserId = Number(localStorage.getItem('userId')) || null;

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        const userEmail = localStorage.getItem('email') || '';
        const userName = localStorage.getItem('fullName') || '';

        if (!numericUserId) {
          throw new Error('userId не знайдено у localStorage');
        }

        const [statsResponse, leaderboardResponse, userTeamResponse] = await Promise.all([
          fetch(`/api/auth/stats/${numericUserId}`),
          fetch('/api/auth/leaderboard'),
          fetch(`/api/auth/user-team/${numericUserId}`)
        ]);

        if (!statsResponse.ok) {
          throw new Error(`HTTP ${statsResponse.status}: Помилка при завантаженні статистики`);
        }

        if (!leaderboardResponse.ok) {
          throw new Error(`HTTP ${leaderboardResponse.status}: Помилка при завантаженні лідерборду`);
        }

        const statsData = await statsResponse.json();
        const leaderboardData = await leaderboardResponse.json();
        const userTeamData = userTeamResponse.ok ? await userTeamResponse.json() : { team: null };

        const sortedLeaderboard = Array.isArray(leaderboardData.leaderboard)
          ? [...leaderboardData.leaderboard].sort((a, b) => {
              const pointsDiff = (b.team?.points || 0) - (a.team?.points || 0);
              if (pointsDiff !== 0) {
                return pointsDiff;
              }
              return (a.rank || 0) - (b.rank || 0);
            })
          : [];

        setLeaderboard(sortedLeaderboard);

        const stats = statsData.stats || {};
        const currentUserEntry = sortedLeaderboard.find(
          (manager) => Number(manager.id) === numericUserId
        );
        const currentTeam = userTeamData.team || stats.team || null;
        const totalTeamValue = Array.isArray(currentTeam?.players)
          ? currentTeam.players.reduce((sum, player) => sum + (Number(player.price) || 0), 0)
          : 0;
        const currentPoints = Number(
          currentUserEntry?.team?.points
          || stats.team?.points
          || currentTeam?.totalseasonpoints
          || 0
        );
        const currentRank = Number(currentUserEntry?.rank || stats.rank || 0);
        const totalManagers = Number(
          leaderboardData.totalManagers || stats.totalManagers || sortedLeaderboard.length || 0
        );
        const leaderPoints = Number(sortedLeaderboard[0]?.team?.points || 0);
        const hasTeam = Boolean(currentTeam);
        const topPercent = currentRank && totalManagers
          ? Math.max(1, Math.round((currentRank / totalManagers) * 100))
          : 0;

        setUserStats({
          rank: currentRank,
          totalManagers,
          totalPoints: currentPoints,
          pointsChange: 0,
          pointsBehind: hasTeam ? Math.max(0, leaderPoints - currentPoints) : 0,
          gameweekPoints: 0,
          gameweekChange: 0,
          teamValue: `${totalTeamValue.toFixed(1)}M`,
          gameweek: 'Current',
          userEmail,
          userName,
          teamName: currentUserEntry?.team?.name || currentTeam?.teamname || stats.team?.name || 'Create your team',
          teamPoints: currentPoints,
          teamId: currentUserEntry?.team?.id || currentTeam?.id || stats.team?.id || null,
          hasTeam,
          topPercent
        });

        setError(null);
      } catch (err) {
        console.error('❌ Помилка при завантаженні:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [numericUserId]);

  const getRankBadge = (rank) => {
    const badges = { 1: '🥇', 2: '🥈', 3: '🥉' };
    return badges[rank] || `#${rank}`;
  };

  return (
    <div className="dashboard">
      <UserHeader />

      <div className="dashboard-content">
        <div className="dashboard-toolbar">
          <div className="dashboard-title">
            <h1>{userStats.userName || 'Dashboard'}</h1>
            <p>
              {userStats.hasTeam
                ? `${userStats.teamName} is in the leaderboard with ${userStats.teamPoints} pts.`
                : 'Create your fantasy team to appear in the leaderboard.'}
            </p>
          </div>

          <div className="dashboard-actions">
            <Link to="/team-builder" className="primary-action">
              {userStats.hasTeam ? 'Edit Team' : 'Create Team'}
            </Link>
            <Link to="/matches" className="secondary-action">View Matches</Link>
          </div>
        </div>

        <div className="info-bar">
          <div className="info-item">
            <span className="info-label">GLOBAL RANK</span>
            <span className="info-value">{userStats.rank ? `#${userStats.rank}` : 'N/A'}</span>
          </div>

          <div className="info-item">
            <span className="info-label">TOTAL POINTS</span>
            <span className="info-value">{userStats.totalPoints.toLocaleString()}</span>
          </div>

          <div className="info-item">
            <span className="info-label">YOUR TEAM</span>
            <span className="info-value accent-text">{userStats.teamName}</span>
          </div>

          <div className="info-item">
            <span className="info-label">TEAM VALUE</span>
            <span className="info-value accent-text">{userStats.teamValue}</span>
          </div>

          <div className="gameweek-badge">
            <span className="gameweek-label">LEADERBOARD</span>
            <span className="gameweek-number">{userStats.totalManagers}</span>
            <span className="deadline">Managers with active fantasy teams</span>
          </div>
        </div>

        <div className="leaderboard">
          <div className="leaderboard-header">
            <div>
              <h2>Global Leaderboard</h2>
              <span className="leaderboard-subtitle">
                Users with fantasy teams sorted by season points
              </span>
            </div>
            <span className="managers-count">{userStats.totalManagers} managers</span>
          </div>

          {loading ? (
            <div className="loading">Завантаження даних...</div>
          ) : error && leaderboard.length === 0 ? (
            <div className="error-message">Помилка при завантаженні лідерборду: {error}</div>
          ) : leaderboard.length === 0 ? (
            <div className="empty-state">Поки що немає жодної команди в лідерборді.</div>
          ) : (
            <div className="leaderboard-list">
              {leaderboard.map((manager) => {
                const isCurrentUser = Number(manager.id) === numericUserId;

                return (
                  <div
                    key={manager.id}
                    className={`leaderboard-item ${isCurrentUser ? 'current-user' : ''}`}
                  >
                    <div className="rank-badge">{getRankBadge(manager.rank)}</div>

                    <div className="manager-profile">
                      <div className="manager-avatar">{manager.rank <= 3 ? '★' : '👤'}</div>
                      <div className="manager-details">
                        <div className="manager-name">
                          {manager.name}
                          {isCurrentUser && <span className="you-badge">You</span>}
                        </div>
                        <div className="team-info">{manager.team?.name || 'No Team'}</div>
                      </div>
                    </div>

                    <div className="manager-points">
                      <strong>{manager.team?.points || 0}</strong>
                      <span className="points-label">pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
