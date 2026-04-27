import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
    userName: '',
    teamName: '',
    teamPoints: 0,
    teamId: null
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

         // 🔄 Сортуємо лідерборд за поінтами (від більшого до меншого)
         const sortedLeaderboard = leaderboardData.leaderboard
           ? [...leaderboardData.leaderboard].sort((a, b) => {
               const aPoints = a.team?.points || 0;
               const bPoints = b.team?.points || 0;
               return bPoints - aPoints; // Від більшого до меншого
             })
           : [];

         console.log('📊 Лідерборд відсортований:', sortedLeaderboard);

         // Встановлюємо відсортований лідерборд
         setLeaderboard(sortedLeaderboard);

           // Встановлюємо статистику поточного користувача
           if (statsData.stats) {
             const userStats = statsData.stats;
             const leader = sortedLeaderboard ? sortedLeaderboard[0] : null;

             // 🔍 Шукаємо текущого користувача в лідербораді, щоб отримати його команду та ранг
             const currentUserInLeaderboard = sortedLeaderboard?.find(manager => manager.id === userId);

             // Якщо користувача знайдено в лідербораді, використовуємо його ранг і команду
             if (currentUserInLeaderboard) {
               // 💰 Отримуємо вартість команди
               let teamValueInM = '£0M';

               try {
                 const userTeamResponse = await fetch(`/api/auth/user-team/${userId}`);
                 if (userTeamResponse.ok) {
                   const userTeamResult = await userTeamResponse.json();
                   console.log('📋 userTeamResult (leaderboard user):', userTeamResult);
                    if (userTeamResult.team && userTeamResult.team.players) {
                      console.log('👥 Гравці:', userTeamResult.team.players);
                      const totalValue = userTeamResult.team.players.reduce((sum, p) => {
                        console.log(`   Гравець: ${p.name}, price: ${p.price}`);
                        return sum + (p.price || 0);
                      }, 0);
                      console.log(`💰 Загальна вартість: ${totalValue}`);
                      teamValueInM = `£${totalValue.toFixed(1)}M`;
                      console.log(`✅ Успішно розраховано teamValue: ${teamValueInM}`);
                    }
                 }
               } catch (err) {
                 console.error('⚠️ Помилка при отриманні вартості команди:', err.message);
               }

               // 🏆 Розраховуємо ранг на основі лідерборду
               let userRank = currentUserInLeaderboard.rank;
               if (!userRank && sortedLeaderboard && sortedLeaderboard.length > 0) {
                 // Якщо рангу немає, розраховуємо його позицію у відсортованому масиві + 1
                 const rankIndex = sortedLeaderboard.findIndex(manager => manager.id === userId);
                 userRank = rankIndex >= 0 ? rankIndex + 1 : userStats.totalManagers;
                 console.log(`🔍 Розраховано ранг з позиції у лідербораді: ${userRank} (позиція: ${rankIndex})`);
               }

               console.log(`🔴 ПЕРЕД setUserStats: teamValueInM = ${teamValueInM}, userRank = ${userRank}`);

               const newStats = {
                 rank: userRank,
                 totalManagers: userStats.totalManagers,
                 totalPoints: currentUserInLeaderboard.team?.points || 0,
                 pointsBehind: (leader?.team?.points || 0) - (currentUserInLeaderboard.team?.points || 0),
                 userEmail: userEmail,
                 userName: userName,
                 teamName: currentUserInLeaderboard.team?.name || 'No Team',
                 teamPoints: currentUserInLeaderboard.team?.points || 0,
                 teamId: currentUserInLeaderboard.team?.id || null,
                 teamValue: teamValueInM,
                 pointsChange: 0,
                 gameweekPoints: 0,
                 gameweekChange: 0,
                 gameweek: 'GW 25'
               };

               console.log('📊 Готові дані перед встановленням:', newStats);
               setUserStats(newStats);

               console.log(`🏆 ${userName} - Ранг: ${userRank}/${userStats.totalManagers}, Команда: ${currentUserInLeaderboard.team?.name}, Балів: ${currentUserInLeaderboard.team?.points}, Вартість: ${teamValueInM}`);
             } else {
               // Якщо користувача не знайдено в лідербораді, отримуємо його команду окремо
               let userTeamData = null;
               let teamValueInM = '£0M';

               try {
                 const userTeamResponse = await fetch(`/api/auth/user-team/${userId}`);
                 if (userTeamResponse.ok) {
                   const userTeamResult = await userTeamResponse.json();
                   console.log('📋 userTeamResult:', userTeamResult);
                   if (userTeamResult.team) {
                     userTeamData = {
                       id: userTeamResult.team.id,
                       name: userTeamResult.team.teamname,
                       points: userTeamResult.team.totalseasonpoints || 0
                     };

                      // 💰 Розраховуємо вартість команди на основі гравців
                      console.log('👥 Гравці:', userTeamResult.team.players);
                      if (userTeamResult.team.players && userTeamResult.team.players.length > 0) {
                        const totalValue = userTeamResult.team.players.reduce((sum, p) => {
                          console.log(`   Гравець: ${p.name}, price: ${p.price}`);
                          return sum + (p.price || 0);
                        }, 0);
                        console.log(`💰 Загальна вартість: ${totalValue}`);
                        teamValueInM = `£${totalValue.toFixed(1)}M`;
                        console.log(`✅ Успішно розраховано teamValue: ${teamValueInM}`);
                      } else {
                        console.log('⚠️ Гравці не знайдені');
                      }

                     console.log(`⚽ Команда користувача отримана окремо: ${userTeamData.name} (${userTeamData.points} поінтів, вартість: ${teamValueInM})`);
                   }
                 }
               } catch (teamErr) {
                 console.error('⚠️ Помилка при отриманні команди:', teamErr.message);
               }

               // Використовуємо поінти команди, якщо команда існує, інакше 0
               const userTeamPoints = userTeamData?.points || 0;
               const leaderTeamPoints = leader?.team?.points || 0;
               const pointsBehind = leaderTeamPoints > 0 ? leaderTeamPoints - userTeamPoints : 0;

               // 🏆 Розраховуємо ранг користувача на основі лідерборду
               let userRank = userStats.totalManagers; // За замовчуванням - останнє місце
               if (sortedLeaderboard && sortedLeaderboard.length > 0) {
                 // Шукаємо позицію користувача у відсортованому лідербораді
                 const rankIndex = sortedLeaderboard.findIndex(manager => manager.id === userId);
                 if (rankIndex >= 0) {
                   userRank = rankIndex + 1;
                   console.log(`🔍 Розраховано ранг з позиції у відсортованому лідербораді: ${userRank} (позиція: ${rankIndex})`);
                 } else {
                   // Якщо користувача немає в лідербораді, рахуємо скільки людей мають більше поінтів
                   const rankPosition = sortedLeaderboard.filter(manager => {
                     return (manager.team?.points || 0) > userTeamPoints;
                   }).length;
                   userRank = rankPosition + 1;
                   console.log(`🔍 Розраховано ранг за поінтами: ${userRank} (людей попереду: ${rankPosition})`);
                 }
               }

               console.log(`🔴 ПЕРЕД setUserStats (else case): teamValueInM = ${teamValueInM}, userRank = ${userRank}`);

               const newStats = {
                 rank: userRank,
                 totalManagers: userStats.totalManagers,
                 totalPoints: userTeamPoints,
                 pointsBehind: pointsBehind > 0 ? pointsBehind : 0,
                 userEmail: userEmail,
                 userName: userName,
                 teamName: userTeamData?.name || 'No Team',
                 teamPoints: userTeamPoints,
                 teamId: userTeamData?.id || null,
                 teamValue: teamValueInM,
                 pointsChange: 0,
                 gameweekPoints: 0,
                 gameweekChange: 0,
                 gameweek: 'GW 25'
               };

               console.log('📊 Готові дані перед встановленням (else case):', newStats);
               setUserStats(newStats);

               console.log(`🏆 ${userName} - Ранг: ${userRank}/${userStats.totalManagers}, Команда: ${userTeamData?.name || 'No Team'}, Балів: ${userTeamPoints}, Вартість: ${teamValueInM}`);
            }
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
             <Link to="/dashboard" className="nav-item active">Dashboard</Link>
             <Link to="/team-builder" className="nav-item">My Team</Link>
             <a href="#leagues" className="nav-item">Leagues</a>
             <Link to="/matches" className="nav-item">Matches</Link>
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
            <span className="info-label">YOUR TEAM</span>
            <span className="info-value" style={{ color: '#10b981' }}>⚽ {userStats.teamName}</span>
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

          <div className="stat-card team-value-card">
            <div className="stat-header">💰 Team Value</div>
            <div className="stat-value" style={{ color: '#10b981' }}>{userStats.teamValue}</div>
            <div className="stat-subtitle">Squad Budget</div>
            <div className="stat-footer">⚽ {userStats.teamName}</div>
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
                       {manager.team && manager.team.name && (
                         <div className="team-info">
                           ⚽ {manager.team.name}
                           {manager.team.points !== undefined && (
                             <span className="team-points"> • {manager.team.points} pts</span>
                           )}
                         </div>
                       )}
                       {manager.status && (
                         <div className="manager-status">
                           {manager.status === 'Champion' && '👑 Champion'}
                           {manager.status === 'Runner Up' && `🏃 ${manager.status} ${manager.statusDetail || ''}`}
                           {manager.status === 'Third Place' && `🎯 ${manager.status} ${manager.statusDetail || ''}`}
                         </div>
                       )}
                     </div>
                   </div>
                   <div className="manager-points">{manager.team?.points}<span className="points-label">pts</span></div>
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
