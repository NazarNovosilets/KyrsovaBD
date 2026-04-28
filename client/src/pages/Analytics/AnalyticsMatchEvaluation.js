import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import UserHeader from '../../components/UserHeader';
import './AnalyticsMatchEvaluation.css';

function normalizePosition(position) {
  const value = String(position || '').toUpperCase();
  if (value.includes('GK')) return 'GK';
  if (value.includes('DEF') || value === 'CB' || value === 'RB' || value === 'LB') return 'DEF';
  if (value.includes('MID') || value === 'CM' || value === 'CDM' || value === 'CAM' || value === 'RM' || value === 'LM') return 'MID';
  if (value.includes('FWD') || value.includes('STR') || value === 'ST' || value === 'CF' || value === 'FW') return 'FWD';
  return 'MID';
}

function calculateFormationFromPlayers(groupedPlayers) {
  const defCount = (groupedPlayers.DEF || []).length;
  const midCount = (groupedPlayers.MID || []).length;
  const fwdCount = (groupedPlayers.FWD || []).length;

  return `${defCount}-${midCount}-${fwdCount}`;
}

function splitByFormation(players) {
  const grouped = { GK: [], DEF: [], MID: [], FWD: [] };

  players.forEach((player) => {
    grouped[normalizePosition(player.position)].push(player);
  });

  return grouped;
}

function TeamHalf({ teamName, lineup, ratingsByPlayer, onRate, side = 'left', activeTab, onTabChange }) {
  const starters = lineup?.starters || { GK: [], DEF: [], MID: [], FWD: [] };
  const formation = useMemo(
    () => splitByFormation([...(starters.GK || []), ...(starters.DEF || []), ...(starters.MID || []), ...(starters.FWD || [])]),
    [starters]
  );
  const benchPlayers = lineup?.bench || [];

  const actualFormation = useMemo(
    () => calculateFormationFromPlayers(starters),
    [starters]
  );

  const positionOrder = side === 'left'
    ? [
      { key: 'GK', title: 'GK' },
      { key: 'DEF', title: 'DEF' },
      { key: 'MID', title: 'MID' },
      { key: 'FWD', title: 'FWD' }
    ]
    : [
      { key: 'FWD', title: 'FWD' },
      { key: 'MID', title: 'MID' },
      { key: 'DEF', title: 'DEF' },
      { key: 'GK', title: 'GK' }
    ];

  const renderPlayerCard = (player) => (
    <article key={player.id} className="evaluation-player">
      <div className="evaluation-player__name">{player.name}</div>
      <div className="evaluation-player__position">{normalizePosition(player.position)}</div>
      <input
        className="evaluation-player__input"
        type="number"
        min="1"
        max="10"
        value={ratingsByPlayer[player.id] ?? ''}
        onChange={(event) => onRate(player.id, event.target.value)}
        placeholder="-"
      />
    </article>
  );

  const renderColumn = ({ key, title }) => (
    <div className="evaluation-column" key={key}>
      <span className="evaluation-column__title">{title}</span>
      <div className="evaluation-column__players">
        {(formation[key] || []).map(renderPlayerCard)}
      </div>
    </div>
  );

  return (
    <section className={`evaluation-half evaluation-half--${side}`}>
      <header className="evaluation-half__header">
        <div>
          <h3>{teamName}</h3>
          <span>{actualFormation} formation</span>
        </div>
        <span>{lineup?.startersCount || 0} starters / {lineup?.totalPlayers || 0}</span>
      </header>

      <div className="evaluation-half__tabs">
        <button
          className={`evaluation-tab-btn ${activeTab === 'starters' ? 'is-active' : ''}`}
          onClick={() => onTabChange('starters')}
        >
          Starting XI
        </button>
        <button
          className={`evaluation-tab-btn ${activeTab === 'bench' ? 'is-active' : ''}`}
          onClick={() => onTabChange('bench')}
        >
          Bench ({benchPlayers.length})
        </button>
      </div>

      {activeTab === 'starters' ? (
        <div className="evaluation-half__grid">
          {positionOrder.map(renderColumn)}
        </div>
      ) : (
        <div className="evaluation-bench">
          {benchPlayers.length > 0 ? (
            benchPlayers.map(renderPlayerCard)
          ) : (
            <div className="evaluation-bench__empty">Немає запасних гравців</div>
          )}
        </div>
      )}
    </section>
  );
}

function CenterDivider() {
  return (
    <div className="evaluation-divider" aria-hidden="true">
      <div className="evaluation-divider__line" />
      <div className="evaluation-divider__circle" />
    </div>
  );
}

function MatchArena({ match, lineups, ratingsByPlayer, onRate, teamTabs, onTeamTabChange }) {
  return (
    <section className="evaluation-arena">
      <TeamHalf
        teamName={match?.homeTeam}
        lineup={lineups.home}
        ratingsByPlayer={ratingsByPlayer}
        onRate={onRate}
        side="left"
        activeTab={teamTabs.left}
        onTabChange={(tab) => onTeamTabChange('left', tab)}
      />
      <CenterDivider />
      <TeamHalf
        teamName={match?.awayTeam}
        lineup={lineups.away}
        ratingsByPlayer={ratingsByPlayer}
        onRate={onRate}
        side="right"
        activeTab={teamTabs.right}
        onTabChange={(tab) => onTeamTabChange('right', tab)}
      />
    </section>
  );
}

export default function AnalyticsMatchEvaluation() {
  const navigate = useNavigate();
  const { matchId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState({ loading: false, message: '', error: '' });
  const [match, setMatch] = useState(null);
  const [lineups, setLineups] = useState({ home: null, away: null });
  const [teamTabs, setTeamTabs] = useState({ left: 'starters', right: 'starters' });
  const [ratingsByPlayer, setRatingsByPlayer] = useState({});

  useEffect(() => {
    const fetchLineups = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await fetch(`/api/auth/analytics/matches/${matchId}/lineups`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const payload = await response.json();
        setMatch(payload.match);
        setLineups(payload.lineups);
        setTeamTabs({ left: 'starters', right: 'starters' });

        const allPlayers = [
          ...(payload.lineups?.home?.starters?.GK || []),
          ...(payload.lineups?.home?.starters?.DEF || []),
          ...(payload.lineups?.home?.starters?.MID || []),
          ...(payload.lineups?.home?.starters?.FWD || []),
          ...(payload.lineups?.home?.bench || []),
          ...(payload.lineups?.away?.starters?.GK || []),
          ...(payload.lineups?.away?.starters?.DEF || []),
          ...(payload.lineups?.away?.starters?.MID || []),
          ...(payload.lineups?.away?.starters?.FWD || []),
          ...(payload.lineups?.away?.bench || [])
        ];

        const existingRatings = allPlayers.reduce((acc, player) => {
          if (player.rating !== null && player.rating !== undefined) {
            acc[player.id] = String(player.rating);
          }
          return acc;
        }, {});
        setRatingsByPlayer(existingRatings);
      } catch (err) {
        console.error('Evaluation load error:', err);
        setError('Не вдалося завантажити дані матчу для оцінювання.');
      } finally {
        setLoading(false);
      }
    };

    fetchLineups();
  }, [matchId]);

  const handleRatePlayer = (playerId, value) => {
    if (value === '') {
      setRatingsByPlayer((prev) => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
      return;
    }

    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    const normalized = Math.max(1, Math.min(10, numeric));

    setRatingsByPlayer((prev) => ({
      ...prev,
      [playerId]: String(normalized)
    }));
  };

  const totalPlayers = (lineups.home?.totalPlayers || 0) + (lineups.away?.totalPlayers || 0);
  const ratedPlayers = Object.keys(ratingsByPlayer).length;

  const handleTeamTabChange = (side, tab) => {
    setTeamTabs((prev) => ({
      ...prev,
      [side]: tab
    }));
  };

  const handleSaveRatings = async () => {
    const ratings = Object.entries(ratingsByPlayer)
      .map(([playerId, rating]) => ({ playerId: Number(playerId), rating: Number(rating) }))
      .filter((item) => !Number.isNaN(item.rating));

    if (ratings.length === 0) {
      setSaveState({ loading: false, message: '', error: 'Додайте хоча б одну оцінку перед збереженням.' });
      return;
    }

    try {
      setSaveState({ loading: true, message: '', error: '' });
      const response = await fetch(`/api/auth/analytics/matches/${matchId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratings })
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);

      setSaveState({ loading: false, message: 'Оцінки успішно збережено.', error: '' });
    } catch (err) {
      console.error('Save ratings error:', err);
      setSaveState({ loading: false, message: '', error: err.message || 'Не вдалося зберегти оцінки.' });
    }
  };

  return (
    <div className="evaluation-page">
      <UserHeader />

      <main className="evaluation-content">
        <section className="evaluation-hero">
          <div>
            <h1>Player Evaluation</h1>
            <p>Rate player performances and assign fantasy points</p>
          </div>
          <div className="evaluation-hero__actions">
            <button className="evaluation-secondary-btn" onClick={() => navigate('/analytics')}>
              Back to matches
            </button>
            <button
              className="evaluation-primary-btn"
              onClick={handleSaveRatings}
              disabled={loading || saveState.loading}
            >
              {saveState.loading ? 'Saving...' : 'Save all evaluations'}
            </button>
          </div>
        </section>

        {loading ? (
          <div className="evaluation-state">Завантаження складів...</div>
        ) : error ? (
          <div className="evaluation-error">{error}</div>
        ) : (
          <>
            <section className="evaluation-score-card">
              <div className="evaluation-score-main">
                <span className={`evaluation-status ${match?.status === 'completed' ? 'is-completed' : 'is-live'}`}>
                  {match?.status === 'completed' ? 'Completed' : 'Live'}
                </span>
                <strong>{match?.score || '0:0'}</strong>
                <span>{match?.homeTeam} vs {match?.awayTeam}</span>
              </div>
              <div className="evaluation-score-side">
                <span>Gameweek {match?.gameweek || '-'}</span>
                <strong>{ratedPlayers}/{totalPlayers}</strong>
                <span>Players Rated</span>
              </div>
            </section>

            <MatchArena
              match={match}
              lineups={lineups}
              ratingsByPlayer={ratingsByPlayer}
              onRate={handleRatePlayer}
              teamTabs={teamTabs}
              onTeamTabChange={handleTeamTabChange}
            />
          </>
        )}

        {saveState.message && <div className="evaluation-success">{saveState.message}</div>}
        {saveState.error && <div className="evaluation-error">{saveState.error}</div>}
      </main>
    </div>
  );
}
