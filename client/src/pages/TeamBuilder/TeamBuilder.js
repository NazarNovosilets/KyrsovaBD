import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './TeamBuilder.css';

export default function TeamBuilder() {
  const navigate = useNavigate();
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [players, setPlayers] = useState([]);
  const [formation, setFormation] = useState('4-3-3');
  const [teamName, setTeamName] = useState('My Team');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedPos, setSelectedPos] = useState(null);
  const [search, setSearch] = useState('');
  const [budget] = useState(100);

  const userId = localStorage.getItem('userId');
  const userName = localStorage.getItem('fullName');

  const formations = ['3-4-3', '3-5-2', '4-2-4', '4-3-3', '4-4-2', '5-3-2', '5-4-1'];

  const formationMap = {
    '3-4-3': { GK: 1, DEF: 3, MID: 4, FWD: 3 },
    '3-5-2': { GK: 1, DEF: 3, MID: 5, FWD: 2 },
    '4-2-4': { GK: 1, DEF: 4, MID: 2, FWD: 4 },
    '4-3-3': { GK: 1, DEF: 4, MID: 3, FWD: 3 },
    '4-4-2': { GK: 1, DEF: 4, MID: 4, FWD: 2 },
    '5-3-2': { GK: 1, DEF: 5, MID: 3, FWD: 2 },
    '5-4-1': { GK: 1, DEF: 5, MID: 4, FWD: 1 }
  };

  // Запобіжник: якщо формація не знайдена, беремо дефолтну 4-3-3
  const posReqs = formationMap[formation] || formationMap['4-3-3'];

  const validPositions = ['GK', 'DEF', 'MID', 'FWD'];

  const normalizeSelectedPlayers = (rawPlayers) => {
    if (!Array.isArray(rawPlayers)) return [];

    const seen = new Set();
    return rawPlayers
        .filter(p => p && (p.id !== undefined && p.id !== null))
        .map(p => {
          const position = String(p.position || '').toUpperCase();
          const price = Number(p.price);
          const points = Number(p.points);
          return {
            ...p,
            position,
            price: Number.isFinite(price) ? price : 0,
            points: Number.isFinite(points) ? points : 0
          };
        })
        .filter(p => validPositions.includes(p.position))
        .filter(p => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
  };

  const reconcileTeamToFormation = (playersList, formationKey) => {
    const reqs = formationMap[formationKey] || formationMap['4-3-3'];
    const normalized = normalizeSelectedPlayers(playersList);

    const cleaned = [];
    Object.keys(reqs).forEach(pos => {
      const posPlayers = normalized.filter(p => p.position === pos);
      cleaned.push(...posPlayers.slice(0, reqs[pos]));
    });

    return { reqs, cleaned };
  };

  useEffect(() => {
    if (!userId) navigate('/login');
    else {
      loadPlayers();
      loadTeam();
    }
  }, [userId, navigate]);


  const generateMock = () => {
    const mock = [];
    ['GK', 'DEF', 'MID', 'FWD'].forEach((pos, pi) => {
      const cnt = [5, 15, 15, 10][pi];
      for (let i = 0; i < cnt; i++) {
        mock.push({
          id: mock.length + 1,
          name: `${pos} Player ${i + 1}`,
          position: pos,
          team: ['Dynamo', 'Shakhtar', 'Zorya'][i % 3],
          price: parseFloat((Math.random() * 3 + 4).toFixed(1)),
          points: Math.floor(Math.random() * 80) + 20
        });
      }
    });
    return mock;
  };

  const loadPlayers = async () => {
    try {
      const res = await fetch('/api/auth/players');
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.players || []);
      } else {
        setPlayers(generateMock());
      }
    } catch (e) {
      setPlayers(generateMock());
    } finally {
      setLoading(false);
    }
  };

  const loadTeam = async () => {
    try {
      const res = await fetch(`/api/auth/user-team/${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.team && data.team.players) {
          const apiFormation = data.team.formation || '4-3-3';
          setTeamName(data.team.teamname || 'My Team');
          setFormation(apiFormation);
          const normalized = normalizeSelectedPlayers(data.team.players);
          console.log('✅ Normalized players:', normalized);
          const { cleaned } = reconcileTeamToFormation(normalized, apiFormation);
          console.log('✅ Cleaned players:', cleaned);
          setSelectedPlayers(cleaned);
        }
      }
    } catch (e) {
      console.log('New team setup', e);
    }
  };

  const handleFormationChange = (e) => {
    const newFormation = e.target.value;
    setFormation(newFormation);
    setSelectedPlayers([]); // Очищуємо, щоб уникнути конфліктів лімітів
    setError(null);
  };

  const selectPlayer = (player) => {
    if (!posReqs[selectedPos]) return;

    if (!player || String(player.position || '').toUpperCase() !== selectedPos) {
      setError('Invalid player position');
      return;
    }

    const currentCount = selectedPlayers.filter(p => p.position === selectedPos).length;
    if (currentCount >= posReqs[selectedPos]) {
      setError(`Max ${selectedPos} reached`);
      return;
    }

    const playerPrice = Number(player.price);
    if (!Number.isFinite(playerPrice)) {
      setError('Invalid player price');
      return;
    }

    const totalCost = selectedPlayers.reduce((s, p) => s + (Number(p.price) || 0), 0) + playerPrice;
    if (totalCost > budget) {
      setError('Budget exceeded');
      return;
    }

    if (selectedPlayers.some(p => p.id === player.id)) {
      setError('Player already in team');
      return;
    }

    setSelectedPlayers([...selectedPlayers, player]);
    setError(null);
    setShowModal(false);
    setSearch('');
  };

  const removePlayer = (id) => {
    setSelectedPlayers(selectedPlayers.filter(p => p.id !== id));
  };

  const getEmptySlotsCount = (pos) => {
    // Убедимся, что selectedPlayers - это массив
    if (!Array.isArray(selectedPlayers)) return posReqs[pos] || 0;

    // Фильтруем только гравців с валидной позицией
    const count = selectedPlayers.filter(p => p && String(p.position || '').toUpperCase() === pos).length;
    const required = Number(posReqs[pos]) || 0;
    const diff = required - count;

    // Абсолютная защита: всегда возвращаем целое неотрицательное число
    if (!Number.isFinite(diff) || diff < 0) return 0;
    return Math.max(0, Math.floor(Math.abs(diff)));
  };

  const isComplete = () => {
    return Object.keys(posReqs).every(pos =>
        selectedPlayers.filter(p => p.position === pos).length === posReqs[pos]
    );
  };

  const saveTeam = async () => {
    if (!isComplete()) return;
    try {
      const res = await fetch(`/api/auth/save-team/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: selectedPlayers, formation, teamName })
      });
      if (res.ok) alert('Team saved!');
      else setError('Failed to save team');
    } catch (e) {
      setError('Connection error');
    }
  };

  if (loading) return <div className="team-builder-loading">Loading...</div>;

  return (
      <div className="team-builder">
        <header className="team-builder-header">
          <div className="header-left">
            <div className="logo">⚽ UPL Fantasy</div>
          </div>
          <nav className="nav-menu">
            <Link to="/dashboard" className="nav-item">Dashboard</Link>
            <Link to="/team-builder" className="nav-item active">My Team</Link>
          </nav>
          <div className="header-right">
            <span className="rank">{userName}</span>
          </div>
        </header>

        <div className="team-builder-content">
          <div className="team-info-bar">
            <div className="info-item">
              <span className="info-label">TEAM</span>
              <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} className="team-name-input" />
            </div>
            <div className="info-item">
              <span className="info-label">BUDGET</span>
              <span className="info-value">£{(budget - selectedPlayers.reduce((s, p) => s + p.price, 0)).toFixed(1)}M</span>
            </div>
            <div className="info-item">
              <span className="info-label">FORMATION</span>
              <select value={formation} onChange={handleFormationChange} className="formation-select">
                {formations.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          {error && <div className="error-message">⚠️ {error}</div>}

          <div className="team-builder-main">
            <div className="squad-visualizer">
              <div className="pitch">
                {['FWD', 'MID', 'DEF', 'GK'].map(pos => (
                    <div key={pos} className="pitch-row">
                      {/* Рендеримо вибраних гравців */}
                      {selectedPlayers.filter(p => p.position === pos).map(p => (
                          <div key={p.id} className="player-slot selected">
                            <div className="player-badge">👕</div>
                            <div className="player-info">
                              <div className="player-name">{p.name}</div>
                              <button className="remove-btn" onClick={() => removePlayer(p.id)}>×</button>
                            </div>
                          </div>
                      ))}

                      {/* Рендеримо порожні слоти БЕЗПЕЧНИМ методом */}
                      {(() => {
                        const emptyCount = getEmptySlotsCount(pos);
                        const safeCount = Math.max(0, Math.floor(Number(emptyCount) || 0));
                        if (!Number.isFinite(safeCount) || safeCount < 0) return null;
                        return Array.from({ length: safeCount }).map((_, i) => (
                          <div
                              key={`empty-${pos}-${i}`}
                              className="player-slot empty"
                              onClick={() => { setSelectedPos(pos); setShowModal(true); setSearch(''); }}
                          >
                            <div className="player-placeholder">+</div>
                            <div className="player-pos">{pos}</div>
                          </div>
                        ));
                      })()}
                    </div>
                ))}
              </div>
            </div>

            <div className="right-sidebar">
              <div className="actions-panel">
                <button className="btn btn-primary" onClick={saveTeam} disabled={!isComplete()}>💾 Save Team</button>
                <button className="btn btn-secondary" onClick={() => setSelectedPlayers([])}>🗑️ Clear</button>
              </div>
              <div className="team-summary">
                <h3>Squad</h3>
                {Object.entries(posReqs).map(([pos, req]) => (
                    <div key={pos} className="summary-item">
                      <span>{pos}</span>
                      <span>{selectedPlayers.filter(p => p.position === pos).length}/{req}</span>
                    </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {showModal && (
            <div className="modal-overlay" onClick={() => { setShowModal(false); setSearch(''); }}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Select {selectedPos}</h2>
                  <input
                      type="text"
                      placeholder="Search player..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="search-input"
                  />
                </div>
                <div className="modal-body">
                  {players
                      .filter(p => p.position === selectedPos && !selectedPlayers.some(sp => sp.id === p.id))
                      .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
                      .map(p => (
                          <div key={p.id} className="player-row" onClick={() => selectPlayer(p)}>
                            <span>{p.name} ({p.team})</span>
                            <span>£{p.price}M</span>
                          </div>
                      ))}
                </div>
              </div>
            </div>
        )}
      </div>
  );
}