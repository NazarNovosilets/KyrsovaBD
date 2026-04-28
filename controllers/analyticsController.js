const db = require('../config/db');
const { getMatchLifecycle } = require('../utils/matchLifecycle');
const { ensureLiveEventsTable, generateRandomEventForMatch } = require('../services/liveEventEngine');

const MIN_PLAYER_RATING = 1;
const MAX_PLAYER_RATING = 100;
const MAX_MINUTES_PLAYED = 130;
const RANDOM_FORMATIONS = [
    { label: '4-3-3', DEF: 4, MID: 3, FWD: 3 },
    { label: '4-4-2', DEF: 4, MID: 4, FWD: 2 },
    { label: '3-5-2', DEF: 3, MID: 5, FWD: 2 },
    { label: '5-3-2', DEF: 5, MID: 3, FWD: 2 },
    { label: '3-4-3', DEF: 3, MID: 4, FWD: 3 }
];

function buildLiveEventText(eventRow) {
    const payload = eventRow.payloadjson || {};
    const minute = Number(eventRow.minute) || 0;
    const sideLabel = payload.side === 'home' ? 'Home' : payload.side === 'away' ? 'Away' : 'Match';

    switch (eventRow.eventtype) {
        case 'goal':
            return `${minute}' GOAL chance (${sideLabel})`;
        case 'shot_on':
            return `${minute}' Shot on target (${sideLabel})`;
        case 'shot_off':
            return `${minute}' Shot off target (${sideLabel})`;
        case 'save':
            return `${minute}' Goalkeeper save (${sideLabel})`;
        case 'yellow':
            return `${minute}' Yellow card (${sideLabel})`;
        case 'attack':
            return `${minute}' Dangerous attack (${sideLabel})`;
        case 'foul':
            return `${minute}' Foul (${sideLabel})`;
        default:
            return `${minute}' ${String(eventRow.eventtype || 'event')}`;
    }
}

function mapLiveEvent(eventRow) {
    const payload = eventRow.payloadjson || {};
    return {
        id: Number(eventRow.id),
        matchId: Number(eventRow.matchid),
        minute: Number(eventRow.minute) || 0,
        type: eventRow.eventtype,
        teamClubId: eventRow.teamclubid === null ? null : Number(eventRow.teamclubid),
        status: eventRow.status,
        text: buildLiveEventText(eventRow),
        payload: {
            side: payload.side || null,
            suggestedScorerId: payload.suggestedScorerId ?? null,
            suggestedScorerName: payload.suggestedScorerName ?? null,
            suggestedAssistId: payload.suggestedAssistId ?? null,
            suggestedAssistName: payload.suggestedAssistName ?? null
        },
        createdAt: eventRow.createdat
    };
}

async function hasColumn(client, tableName, columnName) {
    const result = await client.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_name = $1
           AND column_name = $2
         LIMIT 1`,
        [tableName, columnName]
    );
    return result.rows.length > 0;
}

async function incrementStatValue(client, matchId, playerId, fieldName) {
    const safeField = fieldName === 'assists' ? 'assists' : 'goals';
    const supportsYellowCards = await hasColumn(client, 'statistics', 'yellowcards');

    const updated = await client.query(
        `UPDATE statistics
         SET ${safeField} = COALESCE(${safeField}, 0) + 1
         WHERE matchid = $1 AND footballerid = $2`,
        [matchId, playerId]
    );

    if (updated.rowCount > 0) return;

    if (supportsYellowCards) {
        if (safeField === 'goals') {
            await client.query(
                `INSERT INTO statistics (matchid, footballerid, goals, assists, minutesplayed, cleansheet, yellowcards)
                 VALUES ($1, $2, 1, 0, 0, FALSE, 0)`,
                [matchId, playerId]
            );
        } else {
            await client.query(
                `INSERT INTO statistics (matchid, footballerid, goals, assists, minutesplayed, cleansheet, yellowcards)
                 VALUES ($1, $2, 0, 1, 0, FALSE, 0)`,
                [matchId, playerId]
            );
        }
        return;
    }

    if (safeField === 'goals') {
        await client.query(
            `INSERT INTO statistics (matchid, footballerid, goals, assists, minutesplayed, cleansheet)
             VALUES ($1, $2, 1, 0, 0, FALSE)`,
            [matchId, playerId]
        );
    } else {
        await client.query(
            `INSERT INTO statistics (matchid, footballerid, goals, assists, minutesplayed, cleansheet)
             VALUES ($1, $2, 0, 1, 0, FALSE)`,
            [matchId, playerId]
        );
    }
}

async function recalculateScoreAndPlayerOfMatch(client, matchId) {
    const matchRes = await client.query(
        `SELECT homeclubid, awayclubid
         FROM matches
         WHERE id = $1
         LIMIT 1`,
        [matchId]
    );

    if (matchRes.rows.length === 0) return;
    const { homeclubid, awayclubid } = matchRes.rows[0];

    const goalsRes = await client.query(
        `SELECT
            COALESCE(SUM(CASE WHEN f.footballclubid = $2 THEN s.goals ELSE 0 END), 0)::INT AS home_goals,
            COALESCE(SUM(CASE WHEN f.footballclubid = $3 THEN s.goals ELSE 0 END), 0)::INT AS away_goals
         FROM statistics s
         JOIN footballers f ON f.id = s.footballerid
         WHERE s.matchid = $1`,
        [matchId, homeclubid, awayclubid]
    );

    const homeGoals = Number(goalsRes.rows[0]?.home_goals) || 0;
    const awayGoals = Number(goalsRes.rows[0]?.away_goals) || 0;

    await client.query(
        `UPDATE matches
         SET score = $2
         WHERE id = $1`,
        [matchId, `${homeGoals}:${awayGoals}`]
    );

    const supportsYellowCards = await hasColumn(client, 'statistics', 'yellowcards');
    const supportsPlayerOfTheMatch = await hasColumn(client, 'matches', 'playerofthematchid');

    const bestPlayerResult = await client.query(
        supportsYellowCards
            ? `SELECT s.footballerid
               FROM statistics s
               JOIN footballers f ON f.id = s.footballerid
               WHERE s.matchid = $1
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
               LIMIT 1`
            : `SELECT s.footballerid
               FROM statistics s
               JOIN footballers f ON f.id = s.footballerid
               WHERE s.matchid = $1
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
               LIMIT 1`,
        [matchId]
    );

    if (!supportsPlayerOfTheMatch) return;

    const playerOfTheMatchId = bestPlayerResult.rows[0]?.footballerid || null;
    await client.query(
        `UPDATE matches
         SET playerofthematchid = $2
         WHERE id = $1`,
        [matchId, playerOfTheMatchId]
    );
}

async function ensureAnalystRatingsTable() {
    await db.query(
        `CREATE TABLE IF NOT EXISTS analyst_player_ratings (
            matchid INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
            footballerid INTEGER NOT NULL REFERENCES footballers(id) ON DELETE CASCADE,
            rating INTEGER NOT NULL CHECK (rating >= ${MIN_PLAYER_RATING} AND rating <= ${MAX_PLAYER_RATING}),
            createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (matchid, footballerid)
        )`
    );
}

async function ensureAnalystLineupsTable() {
    await db.query(
        `CREATE TABLE IF NOT EXISTS analyst_match_lineups (
            matchid INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
            teamclubid INTEGER NOT NULL REFERENCES footballclubs(id) ON DELETE CASCADE,
            formation VARCHAR(10) NOT NULL,
            starterids INTEGER[] NOT NULL DEFAULT '{}',
            createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (matchid, teamclubid)
        )`
    );
}

async function recalculateFantasyTeamsPointsForPlayers(client, playerIds = []) {
    const normalizedIds = Array.from(
        new Set(
            (playerIds || [])
                .map((id) => Number(id))
                .filter((id) => Number.isInteger(id) && id > 0)
        )
    );

    if (normalizedIds.length === 0) return;

    await client.query(
        `UPDATE fantasyteams ft
         SET totalseasonpoints = COALESCE(calc.total_points, 0)
         FROM (
            SELECT
                impacted.id AS fantasyteamid,
                COALESCE(SUM(COALESCE(player_points.points, 0)), 0)::INTEGER AS total_points
            FROM fantasyteams impacted
            LEFT JOIN fantasyteam_footballer ftf ON ftf.fantasyteamid = impacted.id
            LEFT JOIN (
                SELECT apr.footballerid, ROUND(AVG(apr.rating))::INTEGER AS points
                FROM analyst_player_ratings apr
                GROUP BY apr.footballerid
            ) player_points ON player_points.footballerid = ftf.footballerid
            WHERE impacted.id IN (
                SELECT DISTINCT ftf2.fantasyteamid
                FROM fantasyteam_footballer ftf2
                WHERE ftf2.footballerid = ANY($1::INT[])
            )
            GROUP BY impacted.id
         ) calc
         WHERE ft.id = calc.fantasyteamid`,
        [normalizedIds]
    );
}

function shuffle(items) {
    const array = [...items];
    for (let i = array.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function normalizePosition(position = '') {
    const value = String(position).trim().toUpperCase();

    if (['GK', 'GOALKEEPER', 'ВРТ', 'ВОРОТАР'].includes(value)) return 'GK';
    if (['DEF', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'ЗАХ', 'ЗАХИСНИК'].includes(value)) return 'DEF';
    if (['MID', 'CM', 'CDM', 'CAM', 'RM', 'LM', 'ПЗ', 'ПІВЗАХИСНИК'].includes(value)) return 'MID';
    if (['FWD', 'FW', 'ST', 'CF', 'STR', 'НАП', 'НАПАДНИК'].includes(value)) return 'FWD';

    if (value.includes('GK') || value.includes('GOAL')) return 'GK';
    if (value.includes('DEF') || value.includes('BACK')) return 'DEF';
    if (value.includes('MID')) return 'MID';
    if (value.includes('FWD') || value.includes('STR') || value.includes('FORWARD')) return 'FWD';

    return 'MID';
}

function pickPlayers(pool, amount) {
    const shuffled = shuffle(pool);
    return shuffled.slice(0, amount);
}

function buildRandomLineup(players) {
    const enriched = players.map((player) => ({
        ...player,
        normalizedPosition: normalizePosition(player.position)
    }));

    const formation = RANDOM_FORMATIONS[Math.floor(Math.random() * RANDOM_FORMATIONS.length)];
    const grouped = {
        GK: enriched.filter((player) => player.normalizedPosition === 'GK'),
        DEF: enriched.filter((player) => player.normalizedPosition === 'DEF'),
        MID: enriched.filter((player) => player.normalizedPosition === 'MID'),
        FWD: enriched.filter((player) => player.normalizedPosition === 'FWD')
    };

    const starters = {
        GK: pickPlayers(grouped.GK, 1),
        DEF: pickPlayers(grouped.DEF, formation.DEF),
        MID: pickPlayers(grouped.MID, formation.MID),
        FWD: pickPlayers(grouped.FWD, formation.FWD)
    };

    const starterIds = new Set([
        ...starters.GK.map((player) => player.id),
        ...starters.DEF.map((player) => player.id),
        ...starters.MID.map((player) => player.id),
        ...starters.FWD.map((player) => player.id)
    ]);

    const fallbackPool = shuffle(enriched.filter((player) => !starterIds.has(player.id)));
    const desiredStarterCount = Math.min(11, enriched.length);
    const maxGoalkeepersInStart = 1;

    while (starterIds.size < desiredStarterCount && fallbackPool.length > 0) {
        const nextPlayer = fallbackPool.shift();
        const position = nextPlayer.normalizedPosition;

        if (position === 'GK' && starters.GK.length >= maxGoalkeepersInStart) {
            continue;
        }

        starters[position].push(nextPlayer);
        starterIds.add(nextPlayer.id);
    }

    const bench = shuffle(enriched.filter((player) => !starterIds.has(player.id)));

    const stripMeta = (player) => ({
        id: player.id,
        name: player.name,
        position: player.position,
        footballClubId: player.footballClubId,
        rating: player.rating
    });

    return {
        formation: formation.label,
        starters: {
            GK: starters.GK.map(stripMeta),
            DEF: starters.DEF.map(stripMeta),
            MID: starters.MID.map(stripMeta),
            FWD: starters.FWD.map(stripMeta)
        },
        starterIds: Array.from(starterIds),
        bench: bench.map(stripMeta),
        startersCount: starterIds.size,
        totalPlayers: enriched.length
    };
}

function buildLineupFromStarterIds(players, formationLabel, starterIds = []) {
    const starterSet = new Set(starterIds.map((id) => Number(id)));
    const startersRaw = players.filter((player) => starterSet.has(Number(player.id)));
    const benchRaw = players.filter((player) => !starterSet.has(Number(player.id)));

    const groupedStarters = splitByPosition(startersRaw);

    return {
        formation: formationLabel || 'Custom',
        starters: groupedStarters,
        starterIds: Array.from(starterSet),
        bench: shuffle(benchRaw),
        startersCount: startersRaw.length,
        totalPlayers: players.length
    };
}

function splitByPosition(players) {
    const grouped = { GK: [], DEF: [], MID: [], FWD: [] };
    players.forEach((player) => {
        const normalized = normalizePosition(player.position);
        grouped[normalized].push(player);
    });
    return grouped;
}

function mapAnalystMatch(row) {
    const matchDate = new Date(row.match_date);
    const score = row.score || '0:0';
    const [homeScore = '', awayScore = ''] = score.split(':');
    const lifecycle = getMatchLifecycle(row.match_date, row.status);

    return {
        id: Number(row.id),
        homeTeam: row.home_team,
        awayTeam: row.away_team,
        score,
        homeScore,
        awayScore,
        gameweek: Number(row.gameweek) || 0,
        matchState: lifecycle.group,
        phase: lifecycle.phase,
        isoDate: matchDate.toISOString(),
        displayDate: matchDate.toLocaleString('sv-SE').replace(' ', 'T')
    };
}

exports.getAnalystMatches = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                m.id,
                hc.name AS home_team,
                ac.name AS away_team,
                m.date AS match_date,
                m.score,
                m.matchday AS gameweek,
                m.status
             FROM matches m
             JOIN footballclubs hc ON hc.id = m.homeclubid
             JOIN footballclubs ac ON ac.id = m.awayclubid
             WHERE COALESCE(m.status, '') <> 'cancelled'
             ORDER BY m.date ASC, m.id ASC`
        );

        const matches = result.rows.map(mapAnalystMatch);
        const liveMatches = matches.filter((match) => match.matchState === 'live');
        const completedMatches = matches.filter((match) => match.matchState === 'completed');
        const upcomingMatches = matches.filter((match) => match.matchState === 'upcoming');
        const latestGameweek = matches.reduce((max, match) => Math.max(max, match.gameweek || 0), 0);

        res.status(200).json({
            summary: {
                live: liveMatches.length,
                completed: completedMatches.length,
                upcoming: upcomingMatches.length,
                gameweek: latestGameweek
            },
            liveMatches,
            completedMatches,
            upcomingMatches
        });
    } catch (err) {
        console.error('❌ Помилка при отриманні аналітичних матчів:', err);
        res.status(500).json({
            error: 'Помилка при отриманні матчів для аналітика',
            details: err.message
        });
    }
};

exports.getMatchLineups = async (req, res) => {
    const { matchId } = req.params;

    try {
        await ensureAnalystRatingsTable();
        await ensureAnalystLineupsTable();

        const matchResult = await db.query(
            `SELECT
                m.id,
                hc.id AS home_team_id,
                hc.name AS home_team,
                ac.id AS away_team_id,
                ac.name AS away_team,
                m.date AS match_date,
                m.score,
                m.matchday AS gameweek,
                m.status
             FROM matches m
             JOIN footballclubs hc ON hc.id = m.homeclubid
             JOIN footballclubs ac ON ac.id = m.awayclubid
             WHERE m.id = $1
             LIMIT 1`,
            [matchId]
        );

        if (matchResult.rows.length === 0) {
            return res.status(404).json({ error: 'Матч не знайдений' });
        }

        const match = matchResult.rows[0];
        const lifecycle = getMatchLifecycle(match.match_date, match.status);

        const playersResult = await db.query(
            `SELECT
                f.id,
                f.firstname,
                f.lastname,
                f.position,
                f.footballclubid,
                apr.rating,
                s.goals,
                s.assists,
                s.minutesplayed,
                s.cleansheet,
                s.yellowcards
             FROM footballers f
             LEFT JOIN analyst_player_ratings apr
               ON apr.footballerid = f.id
              AND apr.matchid = $1
             LEFT JOIN statistics s
               ON s.footballerid = f.id
              AND s.matchid = $1
             WHERE f.footballclubid IN ($2, $3)
             ORDER BY f.footballclubid, f.position, f.lastname, f.firstname`,
            [matchId, match.home_team_id, match.away_team_id]
        );

        const mapPlayer = (playerRow) => ({
            id: Number(playerRow.id),
            name: `${playerRow.firstname} ${playerRow.lastname}`.trim(),
            position: playerRow.position,
            footballClubId: Number(playerRow.footballclubid),
            rating: playerRow.rating === null ? null : Number(playerRow.rating),
            stats: {
                goals: Number(playerRow.goals) || 0,
                assists: Number(playerRow.assists) || 0,
                minutesPlayed: Number(playerRow.minutesplayed) || 0,
                cleanSheet: Boolean(playerRow.cleansheet),
                yellowCards: Number(playerRow.yellowcards) || 0
            }
        });

        const homePlayers = playersResult.rows
            .filter((row) => Number(row.footballclubid) === Number(match.home_team_id))
            .map(mapPlayer);
        const awayPlayers = playersResult.rows
            .filter((row) => Number(row.footballclubid) === Number(match.away_team_id))
            .map(mapPlayer);

        const savedLineupsResult = await db.query(
            `SELECT teamclubid, formation, starterids
             FROM analyst_match_lineups
             WHERE matchid = $1
               AND teamclubid IN ($2, $3)`,
            [matchId, match.home_team_id, match.away_team_id]
        );

        const savedByTeam = new Map(
            savedLineupsResult.rows.map((row) => [
                Number(row.teamclubid),
                { formation: row.formation, starterIds: row.starterids || [] }
            ])
        );

        let homeLineup;
        let awayLineup;

        const savedHome = savedByTeam.get(Number(match.home_team_id));
        const savedAway = savedByTeam.get(Number(match.away_team_id));

        if (savedHome && savedAway) {
            homeLineup = buildLineupFromStarterIds(homePlayers, savedHome.formation, savedHome.starterIds);
            awayLineup = buildLineupFromStarterIds(awayPlayers, savedAway.formation, savedAway.starterIds);
        } else {
            homeLineup = buildRandomLineup(homePlayers);
            awayLineup = buildRandomLineup(awayPlayers);

            const client = await db.connect();
            try {
                await client.query('BEGIN');
                await client.query(
                    `INSERT INTO analyst_match_lineups (matchid, teamclubid, formation, starterids, createdat, updatedat)
                     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                     ON CONFLICT (matchid, teamclubid)
                     DO UPDATE SET
                        formation = EXCLUDED.formation,
                        starterids = EXCLUDED.starterids,
                        updatedat = CURRENT_TIMESTAMP`,
                    [matchId, Number(match.home_team_id), homeLineup.formation, homeLineup.starterIds]
                );
                await client.query(
                    `INSERT INTO analyst_match_lineups (matchid, teamclubid, formation, starterids, createdat, updatedat)
                     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                     ON CONFLICT (matchid, teamclubid)
                     DO UPDATE SET
                        formation = EXCLUDED.formation,
                        starterids = EXCLUDED.starterids,
                        updatedat = CURRENT_TIMESTAMP`,
                    [matchId, Number(match.away_team_id), awayLineup.formation, awayLineup.starterIds]
                );
                await client.query('COMMIT');
            } catch (saveErr) {
                await client.query('ROLLBACK');
                throw saveErr;
            } finally {
                client.release();
            }
        }

        return res.status(200).json({
            match: {
                id: Number(match.id),
                homeTeam: match.home_team,
                awayTeam: match.away_team,
                score: match.score || '0:0',
                gameweek: Number(match.gameweek) || 0,
                status: lifecycle.group,
                phase: lifecycle.phase,
                isoDate: new Date(match.match_date).toISOString()
            },
            lineups: {
                home: homeLineup,
                away: awayLineup
            }
        });
    } catch (err) {
        console.error('❌ Помилка при отриманні складів матчу:', err);
        return res.status(500).json({
            error: 'Помилка при отриманні складів матчу',
            details: err.message
        });
    }
};

exports.savePlayerRatings = async (req, res) => {
    const { matchId } = req.params;
    const { ratings } = req.body || {};

    if (!Array.isArray(ratings) || ratings.length === 0) {
        return res.status(400).json({ error: 'Немає оцінок для збереження' });
    }

    const invalidRating = ratings.find((item) => {
        const value = Number(item?.rating);
        return Number.isNaN(value) || value < MIN_PLAYER_RATING || value > MAX_PLAYER_RATING;
    });

    if (invalidRating) {
        return res.status(400).json({ error: `Оцінка має бути в межах ${MIN_PLAYER_RATING}-${MAX_PLAYER_RATING}` });
    }

    const client = await db.connect();

    try {
        await client.query('BEGIN');
        await ensureAnalystRatingsTable();

        const allowedPlayersResult = await client.query(
            `SELECT f.id
             FROM footballers f
             JOIN matches m ON m.id = $1
             WHERE f.footballclubid IN (m.homeclubid, m.awayclubid)`,
            [matchId]
        );

        const allowedPlayerIds = new Set(allowedPlayersResult.rows.map((row) => Number(row.id)));
        const invalidPlayer = ratings.find((item) => !allowedPlayerIds.has(Number(item.playerId)));

        if (invalidPlayer) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Один або декілька гравців не належать до складу цього матчу' });
        }

        for (const item of ratings) {
            const playerId = Number(item.playerId);
            const rating = Number(item.rating);

            await client.query(
                `INSERT INTO analyst_player_ratings (matchid, footballerid, rating, createdat, updatedat)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 ON CONFLICT (matchid, footballerid)
                 DO UPDATE SET
                    rating = EXCLUDED.rating,
                    updatedat = CURRENT_TIMESTAMP`,
                [matchId, playerId, rating]
            );
        }

        await recalculateFantasyTeamsPointsForPlayers(
            client,
            ratings.map((item) => Number(item.playerId))
        );

        await client.query('COMMIT');

        return res.status(200).json({
            message: 'Оцінки збережено',
            saved: ratings.length
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Помилка при збереженні оцінок:', err);
        return res.status(500).json({
            error: 'Помилка при збереженні оцінок',
            details: err.message
        });
    } finally {
        client.release();
    }
};

exports.savePlayerStatistics = async (req, res) => {
    const { matchId } = req.params;
    const { statistics } = req.body || {};

    if (!Array.isArray(statistics) || statistics.length === 0) {
        return res.status(400).json({ error: 'Немає статистики для збереження' });
    }

    const invalidStat = statistics.find((item) => {
        const goals = Number(item?.goals);
        const assists = Number(item?.assists);
        const minutesPlayed = Number(item?.minutesPlayed);
        const yellowCards = Number(item?.yellowCards);
        const cleanSheet = item?.cleanSheet;

        return (
            !Number.isInteger(Number(item?.playerId))
            || Number.isNaN(goals) || goals < 0
            || Number.isNaN(assists) || assists < 0
            || Number.isNaN(minutesPlayed) || minutesPlayed < 0 || minutesPlayed > MAX_MINUTES_PLAYED
            || Number.isNaN(yellowCards) || yellowCards < 0
            || typeof cleanSheet !== 'boolean'
        );
    });

    if (invalidStat) {
        return res.status(400).json({ error: 'Некоректні значення статистики (перевір goals/assists/minutes/cleanSheet/yellowCards).' });
    }

    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const allowedPlayersResult = await client.query(
            `SELECT f.id
             FROM footballers f
             JOIN matches m ON m.id = $1
             WHERE f.footballclubid IN (m.homeclubid, m.awayclubid)`,
            [matchId]
        );

        const allowedPlayerIds = new Set(allowedPlayersResult.rows.map((row) => Number(row.id)));
        const invalidPlayer = statistics.find((item) => !allowedPlayerIds.has(Number(item.playerId)));

        if (invalidPlayer) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Один або декілька гравців не належать до складу цього матчу' });
        }

        for (const item of statistics) {
            const playerId = Number(item.playerId);
            const goals = Number(item.goals) || 0;
            const assists = Number(item.assists) || 0;
            const minutesPlayed = Number(item.minutesPlayed) || 0;
            const cleanSheet = Boolean(item.cleanSheet);
            const yellowCards = Number(item.yellowCards) || 0;

            const updated = await client.query(
                `UPDATE statistics
                 SET goals = $3,
                     assists = $4,
                     minutesplayed = $5,
                     cleansheet = $6,
                     yellowcards = $7
                 WHERE matchid = $1 AND footballerid = $2`,
                [matchId, playerId, goals, assists, minutesPlayed, cleanSheet, yellowCards]
            );

            if (updated.rowCount === 0) {
                await client.query(
                    `INSERT INTO statistics (matchid, footballerid, goals, assists, minutesplayed, cleansheet, yellowcards)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [matchId, playerId, goals, assists, minutesPlayed, cleanSheet, yellowCards]
                );
            }
        }

        await recalculateScoreAndPlayerOfMatch(client, matchId);

        await client.query('COMMIT');

        return res.status(200).json({
            message: 'Статистику гравців збережено',
            saved: statistics.length
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Помилка при збереженні статистики гравців:', err);
        return res.status(500).json({
            error: 'Помилка при збереженні статистики',
            details: err.message
        });
    } finally {
        client.release();
    }
};

exports.getMatchEvents = async (req, res) => {
    const { matchId } = req.params;
    try {
        await ensureLiveEventsTable();
        const matchResult = await db.query(
            `SELECT m.id, m.homeclubid, m.awayclubid, m.date, m.score, m.status
             FROM matches m
             WHERE m.id = $1
             LIMIT 1`,
            [matchId]
        );

        if (matchResult.rows.length === 0) {
            return res.status(404).json({ error: 'Матч не знайдений' });
        }

        const lifecycle = getMatchLifecycle(matchResult.rows[0].date, matchResult.rows[0].status);

        const eventsResult = await db.query(
            `SELECT id, matchid, minute, eventtype, teamclubid, payloadjson, status, createdat
             FROM match_live_events
             WHERE matchid = $1
             ORDER BY createdat DESC
             LIMIT 120`,
            [matchId]
        );

        return res.status(200).json({
            matchId: Number(matchId),
            matchState: lifecycle.group,
            phase: lifecycle.phase,
            score: matchResult.rows[0].score || '0:0',
            events: eventsResult.rows.map(mapLiveEvent),
            pendingGoals: eventsResult.rows
                .filter((row) => row.eventtype === 'goal' && row.status === 'pending')
                .map(mapLiveEvent)
        });
    } catch (err) {
        console.error('❌ Помилка при отриманні live-подій:', err);
        return res.status(500).json({
            error: 'Помилка при отриманні live-подій',
            details: err.message
        });
    }
};

exports.generateMatchEvent = async (req, res) => {
    const { matchId } = req.params;
    try {
        await ensureLiveEventsTable();
        const matchResult = await db.query(
            `SELECT id, homeclubid, awayclubid, date, status
             FROM matches
             WHERE id = $1
             LIMIT 1`,
            [matchId]
        );

        if (matchResult.rows.length === 0) {
            return res.status(404).json({ error: 'Матч не знайдений' });
        }

        const match = matchResult.rows[0];
        const lifecycle = getMatchLifecycle(match.date, match.status);
        if (lifecycle.group !== 'live') {
            return res.status(400).json({ error: 'Події можна генерувати лише для live-матчу' });
        }

        await generateRandomEventForMatch(match);
        return res.status(200).json({ message: 'Подію згенеровано' });
    } catch (err) {
        console.error('❌ Помилка генерації live-події:', err);
        return res.status(500).json({
            error: 'Помилка генерації live-події',
            details: err.message
        });
    }
};

exports.confirmGoalEvent = async (req, res) => {
    const { matchId, eventId } = req.params;
    const { scorerId, assistId, minute } = req.body || {};

    if (!Number.isInteger(Number(scorerId))) {
        return res.status(400).json({ error: 'Потрібно вказати коректного автора голу' });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await ensureLiveEventsTable(client);

        const eventResult = await client.query(
            `SELECT id, matchid, eventtype, status, payloadjson
             FROM match_live_events
             WHERE id = $1 AND matchid = $2
             LIMIT 1`,
            [eventId, matchId]
        );

        if (eventResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Подія не знайдена' });
        }

        const event = eventResult.rows[0];
        if (event.eventtype !== 'goal') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Підтвердження доступне лише для goal-подій' });
        }
        if (event.status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Подія вже оброблена' });
        }

        const matchAndPlayersResult = await client.query(
            `SELECT m.homeclubid, m.awayclubid, f.id
             FROM matches m
             LEFT JOIN footballers f ON f.footballclubid IN (m.homeclubid, m.awayclubid)
             WHERE m.id = $1`,
            [matchId]
        );

        if (matchAndPlayersResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Матч не знайдений' });
        }

        const allowedIds = new Set(
            matchAndPlayersResult.rows
                .map((row) => Number(row.id))
                .filter((id) => Number.isInteger(id) && id > 0)
        );
        if (!allowedIds.has(Number(scorerId))) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Автор голу не належить до матчу' });
        }
        if (assistId !== null && assistId !== undefined && !allowedIds.has(Number(assistId))) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Асистент не належить до матчу' });
        }

        const eventMinute = Number.isInteger(Number(minute)) ? Number(minute) : null;
        if (eventMinute !== null) {
            await client.query(
                `UPDATE match_live_events
                 SET minute = $3
                 WHERE id = $1 AND matchid = $2`,
                [eventId, matchId, Math.max(1, Math.min(eventMinute, 130))]
            );
        }

        await incrementStatValue(client, Number(matchId), Number(scorerId), 'goals');

        if (assistId !== null && assistId !== undefined) {
            await incrementStatValue(client, Number(matchId), Number(assistId), 'assists');
        }

        const actorsResult = await client.query(
            `SELECT id,
                    CONCAT(COALESCE(firstname, ''), ' ', COALESCE(lastname, '')) AS fullname
             FROM footballers
             WHERE id = ANY($1::int[])`,
            [[
                Number(scorerId),
                assistId === null || assistId === undefined ? -1 : Number(assistId)
            ]]
        );
        const actorsMap = new Map(
            actorsResult.rows.map((row) => [Number(row.id), String(row.fullname || '').trim() || `Player ${row.id}`])
        );

        await recalculateScoreAndPlayerOfMatch(client, matchId);

        await client.query(
            `UPDATE match_live_events
             SET status = 'confirmed',
                 resolvedat = CURRENT_TIMESTAMP,
                 payloadjson = COALESCE(payloadjson, '{}'::jsonb)
                    || jsonb_build_object(
                        'confirmedScorerId', $3::INT,
                        'confirmedAssistId', $4::INT
                    )
             WHERE id = $1 AND matchid = $2`,
            [eventId, matchId, Number(scorerId), assistId === null || assistId === undefined ? null : Number(assistId)]
        );

        await client.query('COMMIT');
        console.log(
            `⚽ Goal confirmed | match=${matchId} | scorer=${actorsMap.get(Number(scorerId)) || scorerId} | assist=${assistId !== null && assistId !== undefined ? (actorsMap.get(Number(assistId)) || assistId) : 'none'}`
        );
        return res.status(200).json({ message: 'Гол підтверджено' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Помилка підтвердження гол-події:', err);
        return res.status(500).json({
            error: 'Помилка підтвердження гол-події',
            details: err.message
        });
    } finally {
        client.release();
    }
};

exports.rejectEvent = async (req, res) => {
    const { matchId, eventId } = req.params;
    try {
        await ensureLiveEventsTable();
        const result = await db.query(
            `UPDATE match_live_events
             SET status = 'rejected',
                 resolvedat = CURRENT_TIMESTAMP
             WHERE id = $1 AND matchid = $2 AND status = 'pending'`,
            [eventId, matchId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Pending подія не знайдена' });
        }

        return res.status(200).json({ message: 'Подію відхилено' });
    } catch (err) {
        console.error('❌ Помилка відхилення події:', err);
        return res.status(500).json({
            error: 'Помилка відхилення події',
            details: err.message
        });
    }
};
