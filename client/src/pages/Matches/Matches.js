import React, { useState, useEffect } from 'react';
import UserHeader from '../../components/UserHeader';
import { getClientMatchLifecycle } from '../../utils/matchLifecycle';
import './Matches.css';

function Matches() {
  const [activeTab, setActiveTab] = useState('fixtures');
  const [matches, setMatches] = useState([]);
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());

  // Мапінг кольорів команд
  const teamColors = {
    'Shakhtar Donetsk': { primary: '#FF6B00', secondary: '#000000' },
    'Dynamo Kyiv': { primary: '#0066CC', secondary: '#FFFFFF' },
    'Zorya Luhansk': { primary: '#000000', secondary: '#FFDD00' },
    'Oleksandriya': { primary: '#FFDD00', secondary: '#0066CC' },
    'Kolos Kovalivka': { primary: '#00AA00', secondary: '#FFFFFF' },
    'Vorskla Poltava': { primary: '#00AA00', secondary: '#FFFFFF' },
    'Dnipro-1': { primary: '#0066CC', secondary: '#FFFFFF' },
    'Chornomorets': { primary: '#0066CC', secondary: '#FFDD00' },
    'Metalurh': { primary: '#FF6B00', secondary: '#FFFFFF' },
    'Veres': { primary: '#FF0000', secondary: '#FFFFFF' }
  };

  const getTeamColors = (teamName) => {
    return teamColors[teamName] || { primary: '#666666', secondary: '#CCCCCC' };
  };

  // Завантаження матчів або таблиці при зміні таба
  useEffect(() => {
    fetchMatches(activeTab);
  }, [activeTab]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    const refresh = window.setInterval(() => {
      fetchMatches(activeTab);
    }, 30000);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(refresh);
    };
  }, [activeTab]);

  const fetchMatches = async (tab) => {
    try {
      setLoading(true);
      setError(null);

      let endpoint = '';
      if (tab === 'fixtures') endpoint = '/api/auth/matches/fixtures';
      else if (tab === 'results') endpoint = '/api/auth/matches/results';
      else if (tab === 'standings') endpoint = '/api/auth/matches/standings';

      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      // Зберігаємо дані в правильний стейт
      if (tab === 'standings') {
        setStandings(data.standings || []);
        setMatches([]); // Очищаємо матчі
      } else {
        setMatches(data.matches || []);
        setStandings([]); // Очищаємо таблицю
      }

    } catch (err) {
      console.error(`❌ Помилка:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderTeamCircle = (color) => {
    return (
        <div
            className="team-circle"
            style={{ backgroundColor: color, width: '12px', height: '12px', borderRadius: '50%', display: 'inline-block' }}
        />
    );
  };

  return (
      <div className="matches-page">
        <UserHeader />

        <div className="matches-content">
          <div className="match-center">
            <div className="match-center-header">
              <div className="match-center-title">
                <span className="match-icon">📋</span>
                <h1>Match Center</h1>
              </div>
              <p className="match-center-subtitle">Fixtures, results, and match statistics</p>
              <button className="gameweek-selector">Gameweek 25</button>
            </div>

            {/* 🔘 Tabs */}
            <div className="match-tabs">
              <button
                  className={`tab-button ${activeTab === 'fixtures' ? 'active' : ''}`}
                  onClick={() => setActiveTab('fixtures')}
              >
                📋 Fixtures
              </button>
              <button
                  className={`tab-button ${activeTab === 'results' ? 'active' : ''}`}
                  onClick={() => setActiveTab('results')}
              >
                📊 Results
              </button>
              <button
                  className={`tab-button ${activeTab === 'standings' ? 'active' : ''}`}
                  onClick={() => setActiveTab('standings')}
              >
                📈 Standings
              </button>
            </div>

            {/* 📝 Контент вкладки */}
            {loading ? (
                <div className="loading">Завантаження...</div>
            ) : error ? (
                <div className="error-message">Помилка при завантаженні: {error}</div>
            ) : activeTab === 'standings' ? (
                /* 🏆 ТАБЛИЦЯ ЛІГИ */
                <div className="standings-container">
                  <h2 className="section-title">League Table</h2>
                  <p className="section-subtitle">Current standings in the Ukrainian Premier League</p>

                  <table className="standings-table">
                    <thead>
                    <tr>
                      <th>#</th>
                      <th style={{ textAlign: 'left' }}>Club</th>
                      <th>P</th>
                      <th>W</th>
                      <th>D</th>
                      <th>L</th>
                      <th>GF</th>
                      <th>GA</th>
                      <th>GD</th>
                      <th>Pts</th>
                    </tr>
                    </thead>
                    <tbody>
                    {standings.length > 0 ? standings.map((team, index) => (
                        <tr key={team.id}>
                          <td className="rank-col">{index + 1}</td>
                          <td className="team-cell">
                            <div className="team-colors" style={{ display: 'inline-flex', gap: '2px', marginRight: '10px' }}>
                              {renderTeamCircle(getTeamColors(team.name).primary)}
                              {renderTeamCircle(getTeamColors(team.name).secondary)}
                            </div>
                            <span className="team-name">{team.name}</span>
                          </td>
                          <td>{team.played}</td>
                          <td>{team.won}</td>
                          <td>{team.drawn}</td>
                          <td>{team.lost}</td>
                          <td>{team.gf}</td>
                          <td>{team.ga}</td>
                          <td style={{ color: team.gd > 0 ? '#00AA00' : team.gd < 0 ? '#FF0000' : 'inherit', fontWeight: 'bold' }}>
                            {team.gd > 0 ? `+${team.gd}` : team.gd}
                          </td>
                          <td className="pts-col" style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{team.points}</td>
                        </tr>
                    )) : (
                        <tr><td colSpan="10" style={{ textAlign: 'center', padding: '2rem' }}>Немає даних для таблиці</td></tr>
                    )}
                    </tbody>
                  </table>
                </div>
            ) : matches.length === 0 ? (
                /* 🚫 НЕМАЄ МАТЧІВ */
                <div className="no-data-message" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                  Немає матчів для відображення
                </div>
            ) : (
                /* ⚽ СПИСОК МАТЧІВ (Fixtures / Results) */
                <div className="matches-list">
                  <h2 className="section-title">
                    {activeTab === 'fixtures' ? 'Upcoming & Live Matches' : 'Latest Results'}
                  </h2>
                  <p className="section-subtitle">
                    {activeTab === 'fixtures' ? 'Live timers and scheduled fixtures in the Ukrainian Premier League' : 'Recent match scores and statistics'}
                  </p>

                  {matches.map((match) => {
                    const homeColors = getTeamColors(match.homeTeam);
                    const awayColors = getTeamColors(match.awayTeam);
                    const lifecycle = getClientMatchLifecycle(match.kickoffIso, match.score, nowMs);

                    // Парсимо рахунок для красивого відображення у вкладці Results
                    const [homeGoals, awayGoals] = (match.score || '0:0').split(':');

                    return (
                        <div key={match.id} className={`match-card ${lifecycle.phase}`}>
                          <div className="match-header">
                            <div className="match-header-main">
                              <span className="match-date">📅 {match.date}</span>
                              <span className="match-time">⏰ {match.time}</span>
                            </div>
                            <div className="match-header-side">
                              <span className={`match-phase-badge phase-${lifecycle.phase}`}>{lifecycle.statusLabel}</span>
                              {lifecycle.showTimer && <span className="match-live-timer">{lifecycle.timerLabel}</span>}
                            </div>
                          </div>

                          <div className="match-body">
                            <div className="team home-team">
                              <div className="team-info">
                                <div className="team-name">{match.homeTeam}</div>
                                <div className="team-code">{match.homeCode}</div>
                              </div>
                              <div className="team-colors">
                                {renderTeamCircle(homeColors.primary)}
                                {renderTeamCircle(homeColors.secondary)}
                              </div>
                            </div>

                            <div className="vs-container">
                              {activeTab === 'results' || lifecycle.showScore ? (
                                <div className="score-display">
                                  <span className="score-box">{homeGoals?.trim() || '0'}</span>
                                  <span className="score-divider">-</span>
                                  <span className="score-box">{awayGoals?.trim() || '0'}</span>
                                </div>
                              ) : (
                                <span className="vs-text">VS</span>
                              )}
                            </div>

                            <div className="team away-team">
                              <div className="team-colors">
                                {renderTeamCircle(awayColors.primary)}
                                {renderTeamCircle(awayColors.secondary)}
                              </div>
                              <div className="team-info">
                                <div className="team-name">{match.awayTeam}</div>
                                <div className="team-code">{match.awayCode}</div>
                              </div>
                            </div>
                          </div>
                          <div className="match-footer">
                            <span className="match-gameweek">{match.gameweekLabel || `GW ${match.gameweek}`}</span>
                            {lifecycle.showTimer && <span className="match-phase-copy">{lifecycle.statusLabel} in progress</span>}
                          </div>
                          {activeTab === 'results' && match.playerOfMatch && (
                            <div className="match-footer" style={{ paddingTop: 0 }}>
                              <span className="match-phase-copy">⭐ Player of the Match: {match.playerOfMatch}</span>
                            </div>
                          )}
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

export default Matches;
