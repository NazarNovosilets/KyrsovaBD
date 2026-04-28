const db = require('../config/db');
const { getMatchLifecycle, TOTAL_MATCH_MS } = require('../utils/matchLifecycle');

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

function mapMatchData(match) {
    const lifecycle = getMatchLifecycle(match.matchdate, match.status);
    const kickoff = new Date(match.matchdate);
    const playerOfMatchName = String(match.playerofmatch || '').trim();
    const rawStatus = String(match.status || '').toLowerCase();

    return {
        id: match.id,
        homeTeamId: match.homeclubid,
        awayTeamId: match.awayclubid,
        homeTeam: match.hometeam,
        awayTeam: match.awayteam,
        homeCode: match.hometeam.substring(0, 3).toUpperCase(),
        awayCode: match.awayteam.substring(0, 3).toUpperCase(),
        date: formatDate(match.matchdate),
        time: kickoff.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
        score: match.score,
        gameweek: match.gameweek,
        gameweekLabel: `GW ${match.gameweek}`,
        status: lifecycle.group,
        rawStatus,
        phase: lifecycle.phase,
        isLive: lifecycle.isLive,
        kickoffIso: kickoff.toISOString(),
        playerOfMatch: playerOfMatchName || null
    };
}

async function loadMatchesBase(whereClause = '', params = []) {
    try {
        const result = await db.query(
            `SELECT
                 m.id,
                 m.homeclubid,
                 hc.name AS hometeam,
                 m.awayclubid,
                 ac.name AS awayteam,
                 m.date AS matchdate,
                 m.score,
                 m.matchday AS gameweek,
                 m.status,
                 pom.playerofmatch
             FROM matches m
             JOIN footballclubs hc ON m.homeclubid = hc.id
             JOIN footballclubs ac ON m.awayclubid = ac.id
             LEFT JOIN LATERAL (
                 SELECT
                    CONCAT(COALESCE(f.firstname, ''), ' ', COALESCE(f.lastname, '')) AS playerofmatch
                 FROM statistics s
                 JOIN footballers f ON f.id = s.footballerid
                 WHERE s.matchid = m.id
                 ORDER BY
                    (
                        COALESCE(s.goals, 0) * 5
                        + COALESCE(s.assists, 0) * 3
                        + LEAST(COALESCE(s.minutesplayed, 0), 120) / 30.0
                        - COALESCE(s.yellowcards, 0) * 1.5
                        + CASE
                            WHEN COALESCE(s.cleansheet, FALSE) AND UPPER(COALESCE(f.position, '')) IN ('GK', 'DEF') THEN 4
                            ELSE 0
                          END
                    ) DESC,
                    COALESCE(s.goals, 0) DESC,
                    COALESCE(s.assists, 0) DESC,
                    COALESCE(s.minutesplayed, 0) DESC,
                    s.footballerid ASC
                 LIMIT 1
             ) pom ON TRUE
             ${whereClause}
             ORDER BY m.date ASC, m.id ASC`,
            params
        );

        return result.rows.map(mapMatchData);
    } catch (err) {
        // Backward compatibility for older DB schema without
        // matches.status / matches.playerofthematchid columns.
        if (err.code !== '42703') {
            throw err;
        }

        const fallbackResult = await db.query(
            `SELECT
                 m.id,
                 m.homeclubid,
                 hc.name AS hometeam,
                 m.awayclubid,
                 ac.name AS awayteam,
                 m.date AS matchdate,
                 m.score,
                 m.matchday AS gameweek,
                 NULL::VARCHAR AS status,
                 pom.playerofmatch
             FROM matches m
             JOIN footballclubs hc ON m.homeclubid = hc.id
             JOIN footballclubs ac ON m.awayclubid = ac.id
             LEFT JOIN LATERAL (
                 SELECT
                    CONCAT(COALESCE(f.firstname, ''), ' ', COALESCE(f.lastname, '')) AS playerofmatch
                 FROM statistics s
                 JOIN footballers f ON f.id = s.footballerid
                 WHERE s.matchid = m.id
                 ORDER BY
                    (
                        COALESCE(s.goals, 0) * 5
                        + COALESCE(s.assists, 0) * 3
                        + LEAST(COALESCE(s.minutesplayed, 0), 120) / 30.0
                        + CASE
                            WHEN COALESCE(s.cleansheet, FALSE) AND UPPER(COALESCE(f.position, '')) IN ('GK', 'DEF') THEN 4
                            ELSE 0
                          END
                    ) DESC,
                    COALESCE(s.goals, 0) DESC,
                    COALESCE(s.assists, 0) DESC,
                    COALESCE(s.minutesplayed, 0) DESC,
                    s.footballerid ASC
                 LIMIT 1
             ) pom ON TRUE
             ${whereClause}
             ORDER BY m.date ASC, m.id ASC`,
            params
        );

        return fallbackResult.rows.map(mapMatchData);
    }
}

exports.getFixtures = async (req, res) => {
    try {
        const matches = await loadMatchesBase();

        const fixtureMatches = matches
            .filter((match) => {
                const byDbStatus = match.rawStatus === 'upcoming' || match.rawStatus === 'live';
                const byLifecycle = match.status === 'upcoming' || match.status === 'live';
                return byDbStatus || byLifecycle;
            })
            .sort((a, b) => {
                const aLive = a.rawStatus === 'live' || a.status === 'live';
                const bLive = b.rawStatus === 'live' || b.status === 'live';
                if (aLive && !bLive) return -1;
                if (!aLive && bLive) return 1;
                return new Date(a.kickoffIso) - new Date(b.kickoffIso);
            })
            .slice(0, 20);

        res.status(200).json({
            message: 'Наступні матчи успішно отримані',
            matches: fixtureMatches,
            total: fixtureMatches.length
        });
    } catch (err) {
        console.error('❌ Помилка при отриманні матчів:', err);
        res.status(500).json({
            error: 'Помилка при отриманні матчів',
            details: err.message
        });
    }
};

exports.getStandings = async (req, res) => {
    try {
        const clubsResult = await db.query(`SELECT id, name FROM footballclubs`);
        const standingsMap = {};

        clubsResult.rows.forEach((club) => {
            standingsMap[club.id] = {
                id: club.id,
                name: club.name,
                played: 0,
                won: 0,
                drawn: 0,
                lost: 0,
                gf: 0,
                ga: 0,
                gd: 0,
                points: 0
            };
        });

        const matchesResult = await db.query(
            `SELECT homeclubid, awayclubid, score, date, status
             FROM matches
             WHERE score IS NOT NULL`
        );

        matchesResult.rows
            .filter((match) => getMatchLifecycle(match.date, match.status).group === 'completed')
            .forEach((match) => {
                const [homeGoalsStr, awayGoalsStr] = String(match.score || '0:0').split(':');
                const homeGoals = parseInt(homeGoalsStr, 10);
                const awayGoals = parseInt(awayGoalsStr, 10);

                if (Number.isNaN(homeGoals) || Number.isNaN(awayGoals)) return;

                const homeTeam = standingsMap[match.homeclubid];
                const awayTeam = standingsMap[match.awayclubid];

                if (!homeTeam || !awayTeam) return;

                homeTeam.played += 1;
                awayTeam.played += 1;
                homeTeam.gf += homeGoals;
                homeTeam.ga += awayGoals;
                awayTeam.gf += awayGoals;
                awayTeam.ga += homeGoals;

                if (homeGoals > awayGoals) {
                    homeTeam.won += 1;
                    homeTeam.points += 3;
                    awayTeam.lost += 1;
                } else if (homeGoals < awayGoals) {
                    awayTeam.won += 1;
                    awayTeam.points += 3;
                    homeTeam.lost += 1;
                } else {
                    homeTeam.drawn += 1;
                    awayTeam.drawn += 1;
                    homeTeam.points += 1;
                    awayTeam.points += 1;
                }
            });

        const standingsArray = Object.values(standingsMap).map((team) => {
            team.gd = team.gf - team.ga;
            return team;
        });

        standingsArray.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.gf - a.gf;
        });

        res.status(200).json({
            message: 'Таблиця успішно згенерована',
            standings: standingsArray
        });
    } catch (err) {
        console.error('❌ Помилка генерації таблиці:', err);
        res.status(500).json({ error: 'Помилка', details: err.message });
    }
};

exports.getAllMatches = async (req, res) => {
    try {
        const matches = await loadMatchesBase();
        const completedMatches = matches
            .filter((match) => match.status === 'completed')
            .sort((a, b) => new Date(b.kickoffIso) - new Date(a.kickoffIso))
            .slice(0, 20);

        res.status(200).json({ matches: completedMatches, total: completedMatches.length });
    } catch (err) {
        res.status(500).json({ error: 'Помилка', details: err.message });
    }
};

exports.getMatchById = async (req, res) => {
    const { matchId } = req.params;

    try {
        const matches = await loadMatchesBase(`WHERE m.id = $1`, [matchId]);

        if (matches.length === 0) {
            return res.status(404).json({ error: 'Матч не знайдений' });
        }

        res.status(200).json({ match: matches[0] });
    } catch (err) {
        res.status(500).json({ error: 'Помилка', details: err.message });
    }
};

exports.getMatchesByGameweek = async (req, res) => {
    const { gameweek } = req.params;

    try {
        if (!gameweek) {
            return res.status(400).json({ error: 'Gameweek не надано' });
        }

        const matches = await loadMatchesBase(`WHERE m.matchday = $1`, [gameweek]);

        res.status(200).json({
            message: `Матчи для GW ${gameweek} успішно отримані`,
            matches,
            gameweek,
            total: matches.length
        });
    } catch (err) {
        console.error('❌ Помилка при отриманні матчів:', err);
        res.status(500).json({
            error: 'Помилка при отриманні матчів',
            details: err.message
        });
    }
};

exports.getResults = async (req, res) => {
    try {
        const matches = await loadMatchesBase(
            `WHERE m.date <= CURRENT_TIMESTAMP + INTERVAL '${TOTAL_MATCH_MS / 60000} minutes'`
        );

        const results = matches
            .filter((match) => match.status === 'completed')
            .sort((a, b) => new Date(b.kickoffIso) - new Date(a.kickoffIso))
            .slice(0, 20);

        res.status(200).json({
            message: 'Результати успішно отримані',
            matches: results,
            total: results.length
        });
    } catch (err) {
        console.error('❌ Помилка при отриманні результатів:', err);
        res.status(500).json({
            error: 'Помилка при отриманні результатів',
            details: err.message
        });
    }
};

exports.createMatchByAdmin = async (req, res) => {
    const {
        homeClubId,
        awayClubId,
        kickoffAt,
        status = 'upcoming',
        matchday = 1,
        score = '0:0'
    } = req.body || {};

    const normalizedStatus = String(status || '').toLowerCase();
    const allowedStatuses = ['upcoming', 'live', 'finished', 'postponed', 'cancelled'];

    if (!homeClubId || !awayClubId || !kickoffAt) {
        return res.status(400).json({
            error: 'homeClubId, awayClubId та kickoffAt є обов\'язковими'
        });
    }

    if (Number(homeClubId) === Number(awayClubId)) {
        return res.status(400).json({
            error: 'Домашня і гостьова команда не можуть бути однаковими'
        });
    }

    if (!allowedStatuses.includes(normalizedStatus)) {
        return res.status(400).json({
            error: `Неприпустимий статус. Дозволені: ${allowedStatuses.join(', ')}`
        });
    }

    const kickoffDate = new Date(kickoffAt);
    if (Number.isNaN(kickoffDate.getTime())) {
        return res.status(400).json({
            error: 'Некоректна дата/час kickoffAt'
        });
    }

    try {
        const clubsResult = await db.query(
            `SELECT id, name FROM footballclubs WHERE id = ANY($1::int[])`,
            [[Number(homeClubId), Number(awayClubId)]]
        );

        if (clubsResult.rows.length !== 2) {
            return res.status(404).json({
                error: 'Один або обидва клуби не знайдено'
            });
        }

        const insertResult = await db.query(
            `INSERT INTO matches (homeclubid, awayclubid, date, score, matchday, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, homeclubid, awayclubid, date, score, matchday, status`,
            [
                Number(homeClubId),
                Number(awayClubId),
                kickoffDate.toISOString(),
                String(score || '0:0'),
                Number(matchday) || 1,
                normalizedStatus
            ]
        );

        res.status(201).json({
            message: 'Матч успішно створено',
            match: insertResult.rows[0]
        });
    } catch (err) {
        console.error('❌ Помилка створення матчу адміном:', err);
        res.status(500).json({
            error: 'Помилка при створенні матчу',
            details: err.message
        });
    }
};

