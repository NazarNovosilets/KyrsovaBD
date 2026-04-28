const db = require('../config/db');
const { getMatchLifecycle } = require('../utils/matchLifecycle');

const MIN_PLAYER_RATING = 1;
const MAX_PLAYER_RATING = 10;
const RANDOM_FORMATIONS = [
    { label: '4-3-3', DEF: 4, MID: 3, FWD: 3 },
    { label: '4-4-2', DEF: 4, MID: 4, FWD: 2 },
    { label: '3-5-2', DEF: 3, MID: 5, FWD: 2 },
    { label: '5-3-2', DEF: 5, MID: 3, FWD: 2 },
    { label: '3-4-3', DEF: 3, MID: 4, FWD: 3 }
];

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

    while (starterIds.size < desiredStarterCount && fallbackPool.length > 0) {
        const nextPlayer = fallbackPool.shift();
        const position = nextPlayer.normalizedPosition;
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
                apr.rating
             FROM footballers f
             LEFT JOIN analyst_player_ratings apr
               ON apr.footballerid = f.id
              AND apr.matchid = $1
             WHERE f.footballclubid IN ($2, $3)
             ORDER BY f.footballclubid, f.position, f.lastname, f.firstname`,
            [matchId, match.home_team_id, match.away_team_id]
        );

        const mapPlayer = (playerRow) => ({
            id: Number(playerRow.id),
            name: `${playerRow.firstname} ${playerRow.lastname}`.trim(),
            position: playerRow.position,
            footballClubId: Number(playerRow.footballclubid),
            rating: playerRow.rating === null ? null : Number(playerRow.rating)
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
