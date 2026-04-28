import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserHeader from '../../components/UserHeader';
import { getClientMatchLifecycle } from '../../utils/matchLifecycle';
import './AnalyticsMatches.css';

function MatchRow({ match, variant, nowMs, onOpenDetails }) {
  const lifecycle = getClientMatchLifecycle(match.isoDate, match.score, nowMs);
  const badgeClass = variant === 'completed' ? 'is-completed' : variant === 'live' ? 'is-live' : 'is-upcoming';
  const centerContent = variant === 'completed' || lifecycle.showScore
    ? `${match.homeScore} - ${match.awayScore}`
    : 'VS';
  const isClickable = variant === 'live' || variant === 'completed';

  return (
    <article
      className={`analytics-match-card ${isClickable ? 'is-clickable' : ''}`}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? () => onOpenDetails(match) : undefined}
      onKeyDown={isClickable ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenDetails(match);
        }
      } : undefined}
    >
      <div className="analytics-match-card__teams">
        <div className="analytics-team analytics-team--left">{match.homeTeam}</div>
        <div className="analytics-match-card__center">
          <span className={`analytics-status-badge ${badgeClass}`}>
            {variant === 'completed' ? 'Completed' : variant === 'live' ? lifecycle.statusLabel : 'Upcoming'}
          </span>
          <div className="analytics-match-card__score">{centerContent}</div>
          <div className="analytics-match-card__separator"></div>
          {variant === 'live' && lifecycle.showTimer && (
            <div className="analytics-match-card__timer">{lifecycle.timerLabel}</div>
          )}
        </div>
        <div className="analytics-team analytics-team--right">{match.awayTeam}</div>
      </div>

      <div className="analytics-match-card__meta">
        <strong>GW {match.gameweek}</strong>
        <span>{match.displayDate}</span>
        {isClickable && <span className="analytics-match-card__cta">Open evaluation</span>}
      </div>
    </article>
  );
}

export default function AnalyticsMatches() {
  const navigate = useNavigate();
  const [nowMs, setNowMs] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    summary: { live: 0, completed: 0, upcoming: 0, gameweek: 0 },
    liveMatches: [],
    completedMatches: [],
    upcomingMatches: []
  });

  useEffect(() => {
    const fetchAnalyticsMatches = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/auth/analytics/matches');

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        setData(payload);
        setError(null);
      } catch (err) {
        console.error('Analytics matches load error:', err);
        setError('Не вдалося завантажити матчі для аналітика.');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsMatches();

    const refresh = window.setInterval(fetchAnalyticsMatches, 30000);
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);

    return () => {
      window.clearInterval(refresh);
      window.clearInterval(timer);
    };
  }, []);

  const handleOpenMatch = (match) => {
    navigate(`/analytics/matches/${match.id}/evaluation`);
  };

  return (
    <div className="analytics-page">
      <UserHeader />

      <main className="analytics-content">
        <section className="analytics-hero">
          <div>
            <span className="analytics-kicker">(( )) Live Matches</span>
            <h1>Monitor ongoing and completed matches</h1>
            <p>Заплановані та завершені матчі підтягуються напряму з бази даних для ролі аналітика.</p>
          </div>
        </section>

        <section className="analytics-stats">
          <div className="analytics-stat-card analytics-stat-card--live">
            <span>Live Now</span>
            <strong>{data.summary.live}</strong>
          </div>
          <div className="analytics-stat-card">
            <span>Completed</span>
            <strong>{data.summary.completed}</strong>
          </div>
          <div className="analytics-stat-card">
            <span>Upcoming</span>
            <strong>{data.summary.upcoming}</strong>
          </div>
          <div className="analytics-stat-card analytics-stat-card--accent">
            <span>Gameweek</span>
            <strong>{data.summary.gameweek || '-'}</strong>
          </div>
        </section>

        {loading ? (
          <div className="analytics-empty-state">Завантаження матчів...</div>
        ) : error ? (
          <div className="analytics-error">{error}</div>
        ) : (
          <>
            {data.liveMatches.length > 0 && (
              <section className="analytics-section">
                <div className="analytics-section__header">
                  <h2>Live Matches</h2>
                  <p>Матчі, які зараз у статусі live</p>
                </div>
                <div className="analytics-list">
                  {data.liveMatches.map((match) => (
                    <MatchRow
                      key={`live-${match.id}`}
                      match={match}
                      variant="live"
                      nowMs={nowMs}
                      onOpenDetails={handleOpenMatch}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="analytics-section">
              <div className="analytics-section__header">
                <h2>Completed Matches</h2>
                <p>Matches ready for player evaluation</p>
              </div>
                <div className="analytics-list">
                  {data.completedMatches.length > 0 ? (
                    data.completedMatches.map((match) => (
                      <MatchRow
                        key={`completed-${match.id}`}
                        match={match}
                        variant="completed"
                        nowMs={nowMs}
                        onOpenDetails={handleOpenMatch}
                      />
                    ))
                  ) : (
                    <div className="analytics-empty-state">Немає завершених матчів.</div>
                )}
              </div>
            </section>

            <section className="analytics-section">
              <div className="analytics-section__header">
                <h2>Upcoming Matches</h2>
                <p>Scheduled fixtures for next gameweeks</p>
              </div>
                <div className="analytics-list">
                  {data.upcomingMatches.length > 0 ? (
                    data.upcomingMatches.map((match) => (
                      <MatchRow key={`upcoming-${match.id}`} match={match} variant="upcoming" nowMs={nowMs} />
                    ))
                  ) : (
                    <div className="analytics-empty-state">Немає запланованих матчів.</div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
