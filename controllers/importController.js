const db = require('../config/db');

function normalizeKey(value = '') {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\uFEFF/g, '')
        .replace(/[\s_-]+/g, '');
}

function parseCsv(content = '') {
    const text = String(content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!text) return [];

    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"' && inQuotes && nextChar === '"') {
            cell += '"';
            i += 1;
            continue;
        }
        if (char === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (char === ',' && !inQuotes) {
            row.push(cell.trim());
            cell = '';
            continue;
        }
        if (char === '\n' && !inQuotes) {
            row.push(cell.trim());
            rows.push(row);
            row = [];
            cell = '';
            continue;
        }
        cell += char;
    }

    row.push(cell.trim());
    rows.push(row);
    return rows.filter((r) => r.some((c) => String(c || '').trim() !== ''));
}

function toObjects(rows = []) {
    if (!rows.length) return [];
    const header = rows[0].map((key) => normalizeKey(key));
    return rows.slice(1).map((values) => {
        const obj = {};
        header.forEach((key, idx) => {
            obj[key] = values[idx];
        });
        return obj;
    });
}

function toInt(value, fallback = null) {
    const num = Number.parseInt(String(value || '').trim(), 10);
    return Number.isNaN(num) ? fallback : num;
}

function toNumeric(value, fallback = null) {
    const normalized = String(value || '').trim().replace(',', '.');
    const num = Number.parseFloat(normalized);
    return Number.isNaN(num) ? fallback : num;
}

function toBool(value, fallback = false) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'так'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'ні'].includes(normalized)) return false;
    return fallback;
}

function getFirst(source, keys = []) {
    for (const key of keys) {
        const normalized = normalizeKey(key);
        if (Object.prototype.hasOwnProperty.call(source, normalized)) {
            return source[normalized];
        }
    }
    return undefined;
}

async function hasTable(client, tableName) {
    const result = await client.query(
        `SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = $1
         LIMIT 1`,
        [tableName]
    );
    return result.rows.length > 0;
}

exports.importCsvBundle = async (req, res) => {
    const files = req.files || {};
    const clubsFile = files.clubsFile?.[0];
    const footballersFile = files.footballersFile?.[0];
    const matchesFile = files.matchesFile?.[0];
    const ratingsFile = files.ratingsFile?.[0];
    const replaceExisting = String(req.body?.replaceExisting || '').toLowerCase() === 'true';

    if (!clubsFile || !footballersFile || !matchesFile || !ratingsFile) {
        return res.status(400).json({
            error: 'Потрібно завантажити всі 4 файли: clubs, footballers, matches, ratings'
        });
    }

    const client = await db.connect();
    try {
        const clubs = toObjects(parseCsv(clubsFile.buffer.toString('utf8')));
        const footballers = toObjects(parseCsv(footballersFile.buffer.toString('utf8')));
        const matches = toObjects(parseCsv(matchesFile.buffer.toString('utf8')));
        const ratings = toObjects(parseCsv(ratingsFile.buffer.toString('utf8')));

        await client.query('BEGIN');

        await client.query(
            `CREATE TABLE IF NOT EXISTS analyst_player_ratings (
                matchid INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
                footballerid INTEGER NOT NULL REFERENCES footballers(id) ON DELETE CASCADE,
                rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 100),
                createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (matchid, footballerid)
            )`
        );

        if (replaceExisting) {
            const clubIds = Array.from(new Set(
                clubs.map((row) => toInt(getFirst(row, ['id']))).filter((id) => Number.isInteger(id) && id > 0)
            ));
            const footballerIds = Array.from(new Set(
                footballers.map((row) => toInt(getFirst(row, ['id']))).filter((id) => Number.isInteger(id) && id > 0)
            ));
            const matchIds = Array.from(new Set(
                matches.map((row) => toInt(getFirst(row, ['id']))).filter((id) => Number.isInteger(id) && id > 0)
            ));
            const ratingMatchIds = Array.from(new Set(
                ratings.map((row) => toInt(getFirst(row, ['matchid', 'match_id']))).filter((id) => Number.isInteger(id) && id > 0)
            ));

            if (ratingMatchIds.length > 0) {
                await client.query(
                    `DELETE FROM analyst_player_ratings
                     WHERE matchid = ANY($1::INT[])`,
                    [ratingMatchIds]
                );
            }

            if (matchIds.length > 0) {
                if (await hasTable(client, 'match_live_events')) {
                    await client.query(`DELETE FROM match_live_events WHERE matchid = ANY($1::INT[])`, [matchIds]);
                }
                if (await hasTable(client, 'analyst_match_lineups')) {
                    await client.query(`DELETE FROM analyst_match_lineups WHERE matchid = ANY($1::INT[])`, [matchIds]);
                }
                if (await hasTable(client, 'statistics')) {
                    await client.query(`DELETE FROM statistics WHERE matchid = ANY($1::INT[])`, [matchIds]);
                }
                await client.query(`DELETE FROM analyst_player_ratings WHERE matchid = ANY($1::INT[])`, [matchIds]);
                await client.query(
                    `DELETE FROM matches
                     WHERE id = ANY($1::INT[])`,
                    [matchIds]
                );
            }

            if (footballerIds.length > 0) {
                if (await hasTable(client, 'statistics')) {
                    await client.query(`DELETE FROM statistics WHERE footballerid = ANY($1::INT[])`, [footballerIds]);
                }
                await client.query(`DELETE FROM analyst_player_ratings WHERE footballerid = ANY($1::INT[])`, [footballerIds]);
                await client.query(
                    `DELETE FROM footballers
                     WHERE id = ANY($1::INT[])`,
                    [footballerIds]
                );
            }

            if (clubIds.length > 0) {
                await client.query(
                    `DELETE FROM footballclubs
                     WHERE id = ANY($1::INT[])`,
                    [clubIds]
                );
            }
        }

        for (let idx = 0; idx < clubs.length; idx += 1) {
            const row = clubs[idx];
            const id = toInt(getFirst(row, ['id']), idx + 1);
            const name = String(getFirst(row, ['name', 'clubname']) || '').trim();
            const city = String(getFirst(row, ['city', 'town']) || '').trim();
            if (!id || !name) continue;

            await client.query(
                `INSERT INTO footballclubs (id, name, city)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (id)
                 DO UPDATE SET
                    name = EXCLUDED.name,
                    city = EXCLUDED.city`,
                [id, name, city || null]
            );
        }

        for (let idx = 0; idx < footballers.length; idx += 1) {
            const row = footballers[idx];
            const id = toInt(getFirst(row, ['id']), idx + 1);
            const firstName = String(getFirst(row, ['firstname', 'first_name', 'name']) || '').trim();
            const lastName = String(getFirst(row, ['lastname', 'last_name', 'surname']) || '').trim();
            const position = String(getFirst(row, ['position']) || '').trim() || 'MID';
            const footballClubId = toInt(getFirst(row, ['footballclubid', 'clubid', 'teamid']));
            const marketValue = toNumeric(getFirst(row, ['marketvalue', 'value', 'price']), 0);
            if (!id || !footballClubId || !firstName) continue;

            await client.query(
                `INSERT INTO footballers (id, firstname, lastname, position, footballclubid, marketvalue)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id)
                 DO UPDATE SET
                    firstname = EXCLUDED.firstname,
                    lastname = EXCLUDED.lastname,
                    position = EXCLUDED.position,
                    footballclubid = EXCLUDED.footballclubid,
                    marketvalue = EXCLUDED.marketvalue`,
                [id, firstName, lastName || null, position, footballClubId, marketValue]
            );
        }

        for (let idx = 0; idx < matches.length; idx += 1) {
            const row = matches[idx];
            const id = toInt(getFirst(row, ['id']), idx + 1);
            const homeClubId = toInt(getFirst(row, ['homeclubid', 'home_team_id', 'hometeamid']));
            const awayClubId = toInt(getFirst(row, ['awayclubid', 'away_team_id', 'awayteamid']));
            const date = String(getFirst(row, ['date', 'matchdate', 'kickoff']) || '').trim();
            const score = String(getFirst(row, ['score']) || '0:0').trim() || '0:0';
            const matchday = toInt(getFirst(row, ['matchday', 'gameweek']), 1);
            const status = String(getFirst(row, ['status']) || 'upcoming').trim().toLowerCase();
            if (!id || !homeClubId || !awayClubId || !date) continue;

            await client.query(
                `INSERT INTO matches (id, homeclubid, awayclubid, date, score, matchday, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (id)
                 DO UPDATE SET
                    homeclubid = EXCLUDED.homeclubid,
                    awayclubid = EXCLUDED.awayclubid,
                    date = EXCLUDED.date,
                    score = EXCLUDED.score,
                    matchday = EXCLUDED.matchday,
                    status = EXCLUDED.status`,
                [id, homeClubId, awayClubId, date, score, matchday, status]
            );
        }

        for (const row of ratings) {
            const matchId = toInt(getFirst(row, ['matchid', 'match_id']));
            const footballerId = toInt(getFirst(row, ['footballerid', 'playerid', 'footballer_id']));
            const rating = toInt(getFirst(row, ['rating', 'points']), 0);
            if (!matchId || !footballerId) continue;

            const relationCheck = await client.query(
                `SELECT
                    EXISTS(SELECT 1 FROM matches WHERE id = $1) AS match_exists,
                    EXISTS(SELECT 1 FROM footballers WHERE id = $2) AS footballer_exists`,
                [matchId, footballerId]
            );
            const rel = relationCheck.rows[0] || {};
            if (!rel.match_exists || !rel.footballer_exists) {
                continue;
            }

            await client.query(
                `INSERT INTO analyst_player_ratings (matchid, footballerid, rating, createdat, updatedat)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 ON CONFLICT (matchid, footballerid)
                 DO UPDATE SET
                    rating = EXCLUDED.rating,
                    updatedat = CURRENT_TIMESTAMP`,
                [matchId, footballerId, Math.max(1, Math.min(100, rating))]
            );
        }

        await client.query(`SELECT setval('footballclubs_id_seq', COALESCE((SELECT MAX(id) FROM footballclubs), 1), true)`);
        await client.query(`SELECT setval('footballers_id_seq', COALESCE((SELECT MAX(id) FROM footballers), 1), true)`);
        await client.query(`SELECT setval('matches_id_seq', COALESCE((SELECT MAX(id) FROM matches), 1), true)`);

        const dbInfo = await client.query(
            `SELECT
                current_database() AS database_name,
                (SELECT COUNT(*)::INT FROM footballclubs) AS clubs_count,
                (SELECT COUNT(*)::INT FROM footballers) AS footballers_count,
                (SELECT COUNT(*)::INT FROM matches) AS matches_count,
                (SELECT COUNT(*)::INT FROM analyst_player_ratings) AS ratings_count`
        );

        await client.query('COMMIT');
        return res.status(200).json({
            message: 'CSV-дані успішно імпортовано',
            imported: {
                clubs: clubs.length,
                footballers: footballers.length,
                matches: matches.length,
                ratings: ratings.length,
                replaceExisting
            },
            database: dbInfo.rows[0]
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ CSV import error:', err);
        return res.status(500).json({
            error: 'Помилка імпорту CSV',
            details: err.message
        });
    } finally {
        client.release();
    }
};
