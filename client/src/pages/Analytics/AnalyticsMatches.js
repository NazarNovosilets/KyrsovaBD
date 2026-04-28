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
  const densityClass = variant === 'completed' ? 'analytics-match-card--compact' : '';

  return (
    <article
      className={`analytics-match-card ${densityClass} ${isClickable ? 'is-clickable' : ''}`}
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

function formatDayLabel(dayValue) {
  if (!dayValue) return '-';
  const parsed = new Date(dayValue);
  if (Number.isNaN(parsed.getTime())) return String(dayValue).slice(0, 10);
  return parsed.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
}

function TrendLineChart({ points = [] }) {
  if (!points.length) {
    return <div className="analytics-empty-state">Недостатньо даних для тренду.</div>;
  }

  const width = 720;
  const height = 180;
  const padding = 22;
  const maxValue = Math.max(...points.map((p) => Number(p.value) || 0), 1);
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const mapped = points.map((point, idx) => {
    const x = padding + idx * stepX;
    const ratio = (Number(point.value) || 0) / maxValue;
    const y = height - padding - ratio * (height - padding * 2);
    return { ...point, x, y };
  });

  const linePath = mapped
    .map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const areaPath = `${linePath} L ${mapped[mapped.length - 1].x} ${height - padding} L ${mapped[0].x} ${height - padding} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="analytics-trend-chart" role="img" aria-label="Goals trend chart">
      <defs>
        <linearGradient id="goalsAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(59,130,246,0.65)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0.05)" />
        </linearGradient>
      </defs>

      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="analytics-trend-axis" />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="analytics-trend-axis" />

      <path d={areaPath} fill="url(#goalsAreaGradient)" />
      <path d={linePath} className="analytics-trend-line" />

      {mapped.map((point) => (
        <g key={`${point.label}-${point.x}`}>
          <circle cx={point.x} cy={point.y} r="4.4" className="analytics-trend-dot" />
          <text x={point.x} y={point.y - 10} textAnchor="middle" className="analytics-trend-value">
            {point.value}
          </text>
          <text x={point.x} y={height - 6} textAnchor="middle" className="analytics-trend-day">
            {point.dayShort}
          </text>
        </g>
      ))}
    </svg>
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
  const [visibleCounts, setVisibleCounts] = useState({
    completed: 10,
    upcoming: 10
  });
  const [reportRange, setReportRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 14);
    const toInput = (date) => date.toISOString().slice(0, 10);
    return { startDate: toInput(start), endDate: toInput(end) };
  });
  const [report, setReport] = useState({
    summary: { total_matches: 0, total_goals: 0, avg_goals_per_match: 0 },
    daily: [],
    topPlayers: []
  });
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);

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
      setVisibleCounts({ completed: 10, upcoming: 10 });
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

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setReportLoading(true);
        setReportError(null);
        const params = new URLSearchParams({
          startDate: reportRange.startDate,
          endDate: reportRange.endDate
        });
        const response = await fetch(`/api/auth/analytics/reports/summary?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        setReport({
          summary: payload.summary || { total_matches: 0, total_goals: 0, avg_goals_per_match: 0 },
          daily: payload.daily || [],
          topPlayers: payload.topPlayers || []
        });
      } catch (err) {
        console.error('Analytics report load error:', err);
        setReportError('Не вдалося завантажити аналітичний звіт.');
      } finally {
        setReportLoading(false);
      }
    };

    fetchReport();
  }, [reportRange.startDate, reportRange.endDate]);

  const handleOpenMatch = (match) => {
    navigate(`/analytics/matches/${match.id}/evaluation`);
  };

  const dailyTrendPoints = (report.daily || []).map((item) => ({
    label: item.day,
    dayShort: formatDayLabel(item.day),
    value: Number(item.goals_count) || 0
  }));

  const maxMatchesPerDay = Math.max(...(report.daily || []).map((d) => Number(d.matches_count) || 0), 1);

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

        <section className="analytics-section">
          <div className="analytics-section__header analytics-report-header">
            <div>
              <h2>Analytics Report (Time Range)</h2>
              <p>Графічний звіт по матчах, голах і середніх рейтингах за обраний період</p>
            </div>
            <div className="analytics-report-filters">
              <label>
                <span>From</span>
                <input
                  type="date"
                  value={reportRange.startDate}
                  onChange={(event) => setReportRange((prev) => ({ ...prev, startDate: event.target.value }))}
                />
              </label>
              <label>
                <span>To</span>
                <input
                  type="date"
                  value={reportRange.endDate}
                  onChange={(event) => setReportRange((prev) => ({ ...prev, endDate: event.target.value }))}
                />
              </label>
            </div>
          </div>

          {reportLoading ? (
            <div className="analytics-empty-state">Оновлюю звіт...</div>
          ) : reportError ? (
            <div className="analytics-error">{reportError}</div>
          ) : (
            <>
              <div className="analytics-report-stats">
                <div className="analytics-report-stat">
                  <span>Total matches</span>
                  <strong>{report.summary.total_matches || 0}</strong>
                </div>
                <div className="analytics-report-stat">
                  <span>Total goals</span>
                  <strong>{report.summary.total_goals || 0}</strong>
                </div>
                <div className="analytics-report-stat">
                  <span>Avg goals / match</span>
                  <strong>{report.summary.avg_goals_per_match || 0}</strong>
                </div>
              </div>

              <div className="analytics-report-grid">
                <div className="analytics-report-card">
                  <h3>Goals Trend by Day</h3>
                  <TrendLineChart points={dailyTrendPoints} />
                </div>

                <div className="analytics-report-card">
                  <h3>Match Volume by Day</h3>
                  <div className="analytics-bars">
                    {(report.daily || []).length > 0 ? (
                      report.daily.map((item) => {
                        const widthPercent = Math.max(8, Math.round(((Number(item.matches_count) || 0) / maxMatchesPerDay) * 100));
                        return (
                          <div key={item.day} className="analytics-bar-row">
                            <div className="analytics-bar-day">{formatDayLabel(item.day)}</div>
                            <div className="analytics-bar-track">
                              <div className="analytics-bar-fill analytics-bar-fill-matches" style={{ width: `${widthPercent}%` }} />
                            </div>
                            <div className="analytics-bar-values">
                              <span>{item.matches_count} matches</span>
                              <span>{item.goals_count} goals</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="analytics-empty-state">За цей період немає матчів.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="analytics-report-card">
                <h3>Goals per Day (Bars)</h3>
                <div className="analytics-bars">
                  {(report.daily || []).length > 0 ? (
                    report.daily.map((item) => {
                      const maxGoals = Math.max(...report.daily.map((d) => Number(d.goals_count) || 0), 1);
                      const widthPercent = Math.max(6, Math.round(((Number(item.goals_count) || 0) / maxGoals) * 100));
                      return (
                        <div key={`goals-${item.day}`} className="analytics-bar-row">
                          <div className="analytics-bar-day">{formatDayLabel(item.day)}</div>
                          <div className="analytics-bar-track">
                            <div className="analytics-bar-fill" style={{ width: `${widthPercent}%` }} />
                          </div>
                          <div className="analytics-bar-values">
                            <span>{item.goals_count} goals</span>
                            <span>{item.matches_count} matches</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="analytics-empty-state">За цей період немає матчів.</div>
                  )}
                </div>
              </div>

              <div className="analytics-top-players">
                <h3>Top Players by Analyst Rating</h3>
                {(report.topPlayers || []).length > 0 ? (
                  <div className="analytics-top-players-list">
                    {report.topPlayers.map((player) => (
                      <div key={`${player.footballerid}-${player.player_name}`} className="analytics-top-player-row">
                        <div>
                          <strong>{player.player_name}</strong>
                          <p>{player.club_name}</p>
                        </div>
                        <div className="analytics-top-player-rating">
                          <span>Avg</span>
                          <strong>{player.avg_rating}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="analytics-empty-state">Немає рейтингових даних за обраний період.</div>
                )}
              </div>
            </>
          )}
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
                    data.completedMatches.slice(0, visibleCounts.completed).map((match) => (
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

              {data.completedMatches.length > visibleCounts.completed && (
                <div className="analytics-load-more">
                  <button
                    className="analytics-load-more__btn"
                    type="button"
                    onClick={() => setVisibleCounts((prev) => ({ ...prev, completed: prev.completed + 10 }))}
                  >
                    Показати ще ({data.completedMatches.length - visibleCounts.completed})
                  </button>
                </div>
              )}
            </section>

            <section className="analytics-section">
              <div className="analytics-section__header">
                <h2>Upcoming Matches</h2>
                <p>Scheduled fixtures for next gameweeks</p>
              </div>
                <div className="analytics-list">
                  {data.upcomingMatches.length > 0 ? (
                    data.upcomingMatches.slice(0, visibleCounts.upcoming).map((match) => (
                      <MatchRow key={`upcoming-${match.id}`} match={match} variant="upcoming" nowMs={nowMs} />
                    ))
                  ) : (
                    <div className="analytics-empty-state">Немає запланованих матчів.</div>
                )}
              </div>

              {data.upcomingMatches.length > visibleCounts.upcoming && (
                <div className="analytics-load-more">
                  <button
                    className="analytics-load-more__btn"
                    type="button"
                    onClick={() => setVisibleCounts((prev) => ({ ...prev, upcoming: prev.upcoming + 10 }))}
                  >
                    Показати ще ({data.upcomingMatches.length - visibleCounts.upcoming})
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
