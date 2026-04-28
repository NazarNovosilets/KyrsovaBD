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

function TeamHalf({ teamName, lineup, statsByPlayer, pointsByPlayer, onStatChange, onPointsChange, side = 'left', activeTab, onTabChange }) {
  const [expandedPlayerId, setExpandedPlayerId] = useState(null);
  const starters = useMemo(
    () => lineup?.starters || { GK: [], DEF: [], MID: [], FWD: [] },
    [lineup]
  );
  const formation = useMemo(
    () => splitByFormation([...(starters.GK || []), ...(starters.DEF || []), ...(starters.MID || []), ...(starters.FWD || [])]),
    [starters]
  );
  const benchPlayers = lineup?.bench || [];

  const actualFormation = useMemo(
    () => calculateFormationFromPlayers(starters),
    [starters]
  );

  const renderPlayerCard = (player) => (
    <article
      key={player.id}
      className={`evaluation-player ${expandedPlayerId === player.id ? 'is-expanded' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => setExpandedPlayerId((prev) => (prev === player.id ? null : player.id))}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setExpandedPlayerId((prev) => (prev === player.id ? null : player.id));
        }
      }}
    >
      <div className="evaluation-player__name">{player.name}</div>
      <div className="evaluation-player__position">{normalizePosition(player.position)}</div>
      {expandedPlayerId === player.id ? (
        <div className="evaluation-player__stats-panel" onClick={(event) => event.stopPropagation()}>
          <div className="evaluation-player__stats-grid">
            <label className="evaluation-player__stat-field">
              <span>Pts</span>
              <input
                className="evaluation-player__input"
                type="number"
                min="1"
                max="100"
                value={pointsByPlayer[player.id] ?? ''}
                onChange={(event) => onPointsChange(player.id, event.target.value)}
                placeholder="-"
              />
            </label>
            <label className="evaluation-player__stat-field">
              <span>G</span>
              <input
                className="evaluation-player__input"
                type="number"
                min="0"
                value={statsByPlayer[player.id]?.goals ?? 0}
                onChange={(event) => onStatChange(player.id, 'goals', event.target.value)}
              />
            </label>
            <label className="evaluation-player__stat-field">
              <span>A</span>
              <input
                className="evaluation-player__input"
                type="number"
                min="0"
                value={statsByPlayer[player.id]?.assists ?? 0}
                onChange={(event) => onStatChange(player.id, 'assists', event.target.value)}
              />
            </label>
            <label className="evaluation-player__stat-field">
              <span>Min</span>
              <input
                className="evaluation-player__input"
                type="number"
                min="0"
                max="130"
                value={statsByPlayer[player.id]?.minutesPlayed ?? 0}
                onChange={(event) => onStatChange(player.id, 'minutesPlayed', event.target.value)}
              />
            </label>
            <label className="evaluation-player__stat-field">
              <span>YC</span>
              <input
                className="evaluation-player__input"
                type="number"
                min="0"
                value={statsByPlayer[player.id]?.yellowCards ?? 0}
                onChange={(event) => onStatChange(player.id, 'yellowCards', event.target.value)}
              />
            </label>
          </div>
          <label className="evaluation-player__checkbox">
            <input
              type="checkbox"
              checked={Boolean(statsByPlayer[player.id]?.cleanSheet)}
              onChange={(event) => onStatChange(player.id, 'cleanSheet', event.target.checked)}
            />
            CS
          </label>
        </div>
      ) : null}
    </article>
  );

  const renderFormationView = () => {
    const rowOrder = side === 'left'
      ? ['GK', 'DEF', 'MID', 'FWD']
      : ['FWD', 'MID', 'DEF', 'GK'];

    return (
      <div className="evaluation-half__grid">
        {rowOrder.map((positionKey) => (
          <div key={positionKey} className={`evaluation-formation-row ${positionKey.toLowerCase()}`}>
            {(formation[positionKey] || []).map(renderPlayerCard)}
          </div>
        ))}
      </div>
    );
  };

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
        renderFormationView()
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

function MatchArena({ match, lineups, statsByPlayer, pointsByPlayer, onStatChange, onPointsChange, teamTabs, onTeamTabChange }) {
  return (
    <section className="evaluation-arena">
      <TeamHalf
        teamName={match?.homeTeam}
        lineup={lineups.home}
        statsByPlayer={statsByPlayer}
        pointsByPlayer={pointsByPlayer}
        onStatChange={onStatChange}
        onPointsChange={onPointsChange}
        side="left"
        activeTab={teamTabs.left}
        onTabChange={(tab) => onTeamTabChange('left', tab)}
      />
      <CenterDivider />
      <TeamHalf
        teamName={match?.awayTeam}
        lineup={lineups.away}
        statsByPlayer={statsByPlayer}
        pointsByPlayer={pointsByPlayer}
        onStatChange={onStatChange}
        onPointsChange={onPointsChange}
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
  const [statsByPlayer, setStatsByPlayer] = useState({});
  const [pointsByPlayer, setPointsByPlayer] = useState({});
  const [liveEvents, setLiveEvents] = useState([]);
  const [pendingGoals, setPendingGoals] = useState([]);
  const [eventError, setEventError] = useState('');
  const [eventActionState, setEventActionState] = useState({ loading: false, message: '', error: '' });
  const [goalForms, setGoalForms] = useState({});

  const allPlayers = useMemo(() => {
    const collect = (teamLineup) => ([
      ...(teamLineup?.starters?.GK || []),
      ...(teamLineup?.starters?.DEF || []),
      ...(teamLineup?.starters?.MID || []),
      ...(teamLineup?.starters?.FWD || []),
      ...(teamLineup?.bench || [])
    ]);
    return [...collect(lineups.home), ...collect(lineups.away)];
  }, [lineups]);

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

        const existingStats = allPlayers.reduce((acc, player) => {
          acc[player.id] = {
            goals: Number(player.stats?.goals) || 0,
            assists: Number(player.stats?.assists) || 0,
            minutesPlayed: Number(player.stats?.minutesPlayed) || 0,
            cleanSheet: Boolean(player.stats?.cleanSheet),
            yellowCards: Number(player.stats?.yellowCards) || 0
          };
          return acc;
        }, {});
        setStatsByPlayer(existingStats);

        const existingPoints = allPlayers.reduce((acc, player) => {
          if (player.rating !== null && player.rating !== undefined) {
            acc[player.id] = String(player.rating);
          }
          return acc;
        }, {});
        setPointsByPlayer(existingPoints);
      } catch (err) {
        console.error('Evaluation load error:', err);
        setError('Не вдалося завантажити дані матчу для оцінювання.');
      } finally {
        setLoading(false);
      }
    };

    fetchLineups();
  }, [matchId]);

  useEffect(() => {
    let isMounted = true;

    const fetchEvents = async () => {
      try {
        const response = await fetch(`/api/auth/analytics/matches/${matchId}/events`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (!isMounted) return;
        setLiveEvents(payload.events || []);
        setPendingGoals(payload.pendingGoals || []);
        setEventError('');
        setMatch((prev) => (prev ? { ...prev, score: payload.score || prev.score } : prev));

        setGoalForms((prev) => {
          const next = { ...prev };
          (payload.pendingGoals || []).forEach((eventItem) => {
            if (!next[eventItem.id]) {
              next[eventItem.id] = {
                scorerId: eventItem.payload?.suggestedScorerId || '',
                assistId: eventItem.payload?.suggestedAssistId || '',
                minute: eventItem.minute || ''
              };
            }
          });
          return next;
        });
      } catch (err) {
        if (isMounted) setEventError('Не вдалося завантажити live-події.');
      }
    };

    fetchEvents();
    const poll = window.setInterval(fetchEvents, 5000);
    return () => {
      isMounted = false;
      window.clearInterval(poll);
    };
  }, [matchId]);

  const handleStatChange = (playerId, field, value) => {
    setStatsByPlayer((prev) => {
      const current = prev[playerId] || { goals: 0, assists: 0, minutesPlayed: 0, cleanSheet: false, yellowCards: 0 };
      let nextValue = value;

      if (field !== 'cleanSheet') {
        const numeric = Number(value);
        nextValue = Number.isNaN(numeric) ? 0 : Math.max(0, numeric);
        if (field === 'minutesPlayed') {
          nextValue = Math.min(130, nextValue);
        }
      }

      return {
        ...prev,
        [playerId]: {
          ...current,
          [field]: field === 'cleanSheet' ? Boolean(value) : Math.trunc(nextValue)
        }
      };
    });
  };

  const handlePointsChange = (playerId, value) => {
    if (value === '') {
      setPointsByPlayer((prev) => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
      return;
    }

    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    const normalized = Math.max(1, Math.min(100, numeric));

    setPointsByPlayer((prev) => ({
      ...prev,
      [playerId]: String(Math.trunc(normalized))
    }));
  };

  const totalPlayers = (lineups.home?.totalPlayers || 0) + (lineups.away?.totalPlayers || 0);
  const filledPlayers = Object.keys(statsByPlayer).length;

  const handleTeamTabChange = (side, tab) => {
    setTeamTabs((prev) => ({
      ...prev,
      [side]: tab
    }));
  };

  const handleSaveStats = async () => {
    const statistics = Object.entries(statsByPlayer)
      .map(([playerId, stats]) => ({
        playerId: Number(playerId),
        goals: Number(stats.goals) || 0,
        assists: Number(stats.assists) || 0,
        minutesPlayed: Number(stats.minutesPlayed) || 0,
        cleanSheet: Boolean(stats.cleanSheet),
        yellowCards: Number(stats.yellowCards) || 0
      }))
      .filter((item) => !Number.isNaN(item.playerId));

    if (statistics.length === 0) {
      setSaveState({ loading: false, message: '', error: 'Додайте хоча б одну статистику перед збереженням.' });
      return;
    }

    try {
      setSaveState({ loading: true, message: '', error: '' });
      const response = await fetch(`/api/auth/analytics/matches/${matchId}/statistics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statistics })
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);

      const ratings = Object.entries(pointsByPlayer)
        .map(([playerId, rating]) => ({ playerId: Number(playerId), rating: Number(rating) }))
        .filter((item) => !Number.isNaN(item.rating));

      if (ratings.length > 0) {
        const ratingsResponse = await fetch(`/api/auth/analytics/matches/${matchId}/ratings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ratings })
        });

        const ratingsPayload = await ratingsResponse.json();
        if (!ratingsResponse.ok) throw new Error(ratingsPayload.error || `HTTP ${ratingsResponse.status}`);
      }

      setSaveState({ loading: false, message: 'Статистику і поінти успішно збережено.', error: '' });
    } catch (err) {
      console.error('Save statistics error:', err);
      setSaveState({ loading: false, message: '', error: err.message || 'Не вдалося зберегти статистику.' });
    }
  };

  const handleGenerateEvent = async () => {
    try {
      setEventActionState({ loading: true, message: '', error: '' });
      const response = await fetch(`/api/auth/analytics/matches/${matchId}/events/generate`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      setEventActionState({ loading: false, message: 'Нова live-подія згенерована.', error: '' });
    } catch (err) {
      setEventActionState({ loading: false, message: '', error: err.message || 'Не вдалося згенерувати подію.' });
    }
  };

  const handleGoalFormChange = (eventId, field, value) => {
    setGoalForms((prev) => ({
      ...prev,
      [eventId]: {
        ...(prev[eventId] || { scorerId: '', assistId: '', minute: '' }),
        [field]: value
      }
    }));
  };

  const handleConfirmGoal = async (eventId) => {
    const form = goalForms[eventId] || {};
    try {
      setEventActionState({ loading: true, message: '', error: '' });
      const response = await fetch(`/api/auth/analytics/matches/${matchId}/events/${eventId}/confirm-goal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scorerId: form.scorerId ? Number(form.scorerId) : null,
          assistId: form.assistId ? Number(form.assistId) : null,
          minute: form.minute ? Number(form.minute) : null
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      setEventActionState({ loading: false, message: 'Гол-подію підтверджено.', error: '' });
    } catch (err) {
      setEventActionState({ loading: false, message: '', error: err.message || 'Не вдалося підтвердити гол.' });
    }
  };

  const handleRejectGoal = async (eventId) => {
    try {
      setEventActionState({ loading: true, message: '', error: '' });
      const response = await fetch(`/api/auth/analytics/matches/${matchId}/events/${eventId}/reject`, {
        method: 'POST'
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      setEventActionState({ loading: false, message: 'Подію відхилено.', error: '' });
    } catch (err) {
      setEventActionState({ loading: false, message: '', error: err.message || 'Не вдалося відхилити подію.' });
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
              onClick={handleSaveStats}
              disabled={loading || saveState.loading}
            >
              {saveState.loading ? 'Saving...' : 'Save stats and points'}
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
                <strong>{filledPlayers}/{totalPlayers}</strong>
                <span>Players Loaded</span>
              </div>
            </section>

            <section className="evaluation-events">
              <div className="evaluation-events__header">
                <h3>Live Event Log</h3>
                <button
                  className="evaluation-secondary-btn"
                  onClick={handleGenerateEvent}
                  disabled={eventActionState.loading || match?.status !== 'live'}
                >
                  Generate random event
                </button>
              </div>

              {pendingGoals.length > 0 && (
                <div className="evaluation-events__pending">
                  <h4>Pending goal confirmations</h4>
                  {pendingGoals.map((goalEvent) => {
                    const form = goalForms[goalEvent.id] || {};
                    return (
                      <div key={goalEvent.id} className="evaluation-pending-goal">
                        <div className="evaluation-pending-goal__title">{goalEvent.text}</div>
                        <div className="evaluation-pending-goal__form">
                          <select
                            value={form.scorerId ?? ''}
                            onChange={(event) => handleGoalFormChange(goalEvent.id, 'scorerId', event.target.value)}
                          >
                            <option value="">Scorer</option>
                            {allPlayers.map((player) => (
                              <option key={`scorer-${goalEvent.id}-${player.id}`} value={player.id}>{player.name}</option>
                            ))}
                          </select>
                          <select
                            value={form.assistId ?? ''}
                            onChange={(event) => handleGoalFormChange(goalEvent.id, 'assistId', event.target.value)}
                          >
                            <option value="">No assist</option>
                            {allPlayers.map((player) => (
                              <option key={`assist-${goalEvent.id}-${player.id}`} value={player.id}>{player.name}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="1"
                            max="130"
                            value={form.minute ?? ''}
                            onChange={(event) => handleGoalFormChange(goalEvent.id, 'minute', event.target.value)}
                            placeholder="Minute"
                          />
                          <button onClick={() => handleConfirmGoal(goalEvent.id)} disabled={eventActionState.loading}>Confirm</button>
                          <button onClick={() => handleRejectGoal(goalEvent.id)} disabled={eventActionState.loading}>Reject</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="evaluation-events__list">
                {liveEvents.map((eventItem) => (
                  <div key={eventItem.id} className={`evaluation-event-row status-${eventItem.status}`}>
                    <strong>{eventItem.minute}'</strong>
                    <span>{eventItem.text}</span>
                    <em>{eventItem.status}</em>
                  </div>
                ))}
                {liveEvents.length === 0 && <div className="evaluation-bench__empty">Поки що немає live-подій.</div>}
              </div>
              {eventError && <div className="evaluation-error">{eventError}</div>}
              {eventActionState.message && <div className="evaluation-success">{eventActionState.message}</div>}
              {eventActionState.error && <div className="evaluation-error">{eventActionState.error}</div>}
            </section>

            <MatchArena
              match={match}
              lineups={lineups}
              statsByPlayer={statsByPlayer}
              pointsByPlayer={pointsByPlayer}
              onStatChange={handleStatChange}
              onPointsChange={handlePointsChange}
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
