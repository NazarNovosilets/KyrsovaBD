const db = require('../config/db');

const VALID_POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

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

    return value;
}

async function ensureAnalystRatingsTable() {
    await db.query(
        `CREATE TABLE IF NOT EXISTS analyst_player_ratings (
            matchid INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
            footballerid INTEGER NOT NULL REFERENCES footballers(id) ON DELETE CASCADE,
            rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 100),
            createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (matchid, footballerid)
        )`
    );
}

/**
 * 👥 Team Controller
 * Логіка для управління командою гравця
 */

// Отримати всіх гравців за позицією
exports.getPlayersByPosition = async (req, res) => {
    const requestedPosition = normalizePosition(req.params.position);

    try {
        await ensureAnalystRatingsTable();
        console.log(`🔍 Завантажуємо гравців позиції: ${requestedPosition}`);

        const result = await db.query(
            `SELECT f.id, 
                    CONCAT(f.firstname, ' ', f.lastname) as name, 
                    CASE
                        WHEN UPPER(COALESCE(f.position, '')) IN ('GK', 'GOALKEEPER', 'ВРТ', 'ВОРОТАР') THEN 'GK'
                        WHEN UPPER(COALESCE(f.position, '')) IN ('DEF', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'ЗАХ', 'ЗАХИСНИК') THEN 'DEF'
                        WHEN UPPER(COALESCE(f.position, '')) IN ('MID', 'CM', 'CDM', 'CAM', 'RM', 'LM', 'ПЗ', 'ПІВЗАХИСНИК') THEN 'MID'
                        WHEN UPPER(COALESCE(f.position, '')) IN ('FWD', 'FW', 'ST', 'CF', 'STR', 'НАП', 'НАПАДНИК') THEN 'FWD'
                        ELSE UPPER(COALESCE(f.position, ''))
                    END AS position,
                    fc.name as team, 
                    CAST(f.marketvalue AS DECIMAL) as price,
                    COALESCE(apr.points, 0)::INTEGER as points
             FROM footballers f
             LEFT JOIN footballclubs fc ON f.footballclubid = fc.id
             LEFT JOIN (
                SELECT footballerid, ROUND(AVG(rating))::INTEGER AS points
                FROM analyst_player_ratings
                GROUP BY footballerid
             ) apr ON apr.footballerid = f.id
             WHERE CASE
                        WHEN UPPER(COALESCE(f.position, '')) IN ('GK', 'GOALKEEPER', 'ВРТ', 'ВОРОТАР') THEN 'GK'
                        WHEN UPPER(COALESCE(f.position, '')) IN ('DEF', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'ЗАХ', 'ЗАХИСНИК') THEN 'DEF'
                        WHEN UPPER(COALESCE(f.position, '')) IN ('MID', 'CM', 'CDM', 'CAM', 'RM', 'LM', 'ПЗ', 'ПІВЗАХИСНИК') THEN 'MID'
                        WHEN UPPER(COALESCE(f.position, '')) IN ('FWD', 'FW', 'ST', 'CF', 'STR', 'НАП', 'НАПАДНИК') THEN 'FWD'
                        ELSE UPPER(COALESCE(f.position, ''))
                   END = $1
             ORDER BY f.firstname`,
            [requestedPosition]
        );

        console.log(`✅ Знайдено ${result.rows.length} гравців позиції ${requestedPosition}`);

        // Конвертуємо price в число
        const players = result.rows.map(p => ({
            ...p,
            position: normalizePosition(p.position),
            price: parseFloat(p.price)
        })).filter(p => VALID_POSITIONS.includes(p.position));

        res.status(200).json({
            message: 'Гравці отримані',
            players: players,
            total: players.length
        });

    } catch (err) {
        console.error('❌ Помилка при отриманні гравців:', err);
        res.status(500).json({
            error: 'Помилка при отриманні гравців',
            details: err.message
        });
    }
};

// Отримати всіх гравців
exports.getAllPlayers = async (req, res) => {
    try {
        await ensureAnalystRatingsTable();
        console.log('🔍 Завантажуємо всіх гравців...');

        // Спочатку перевіримо чи є гравці
        const countResult = await db.query('SELECT COUNT(*) as count FROM footballers');
        const playerCount = parseInt(countResult.rows[0].count);

        console.log(`📊 Гравців в БД: ${playerCount}`);

        // Якщо немає гравців, одразу генеруємо mock
        if (playerCount === 0) {
            console.log('⚠️ Гравців не знайдено, генеруємо mock дані...');
            const mockPlayers = [];
            const clubs = ['Динамо', 'Шахтар', 'Металіст', 'Зоря'];
            const positions = ['GK', 'DEF', 'MID', 'FWD'];
            let playerId = 1;

            positions.forEach((pos, pi) => {
                const cnt = [2, 8, 8, 5][pi];
                for (let i = 0; i < cnt; i++) {
                    mockPlayers.push({
                        id: playerId++,
                        name: `Player ${playerId}`,
                        position: pos,
                        team: clubs[Math.floor(Math.random() * clubs.length)],
                        price: Math.random() * 3 + 4,
                        points: Math.floor(Math.random() * 80) + 20
                    });
                }
            });

            return res.status(200).json({
                message: 'Mock гравці завантажені',
                players: mockPlayers,
                total: mockPlayers.length
            });
        }

        // Отримуємо гравців з БД - без JOIN на статистику для простоти
        const result = await db.query(
            `SELECT f.id, 
                    CONCAT(f.firstname, ' ', f.lastname) as name, 
                    CASE
                        WHEN UPPER(COALESCE(f.position, '')) IN ('GK', 'GOALKEEPER', 'ВРТ', 'ВОРОТАР') THEN 'GK'
                        WHEN UPPER(COALESCE(f.position, '')) IN ('DEF', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'ЗАХ', 'ЗАХИСНИК') THEN 'DEF'
                        WHEN UPPER(COALESCE(f.position, '')) IN ('MID', 'CM', 'CDM', 'CAM', 'RM', 'LM', 'ПЗ', 'ПІВЗАХИСНИК') THEN 'MID'
                        WHEN UPPER(COALESCE(f.position, '')) IN ('FWD', 'FW', 'ST', 'CF', 'STR', 'НАП', 'НАПАДНИК') THEN 'FWD'
                        ELSE UPPER(COALESCE(f.position, ''))
                    END AS position,
                    fc.name as team, 
                    CAST(f.marketvalue AS DECIMAL) as price,
                    COALESCE(apr.points, 0)::INTEGER as points
             FROM footballers f
             LEFT JOIN footballclubs fc ON f.footballclubid = fc.id
             LEFT JOIN (
                SELECT footballerid, ROUND(AVG(rating))::INTEGER AS points
                FROM analyst_player_ratings
                GROUP BY footballerid
             ) apr ON apr.footballerid = f.id
             ORDER BY f.position, f.firstname`
        );

        console.log(`✅ Знайдено ${result.rows.length} гравців з БД`);

        // Конвертуємо price в число
        const players = result.rows.map(p => ({
            ...p,
            position: normalizePosition(p.position),
            price: parseFloat(p.price)
        })).filter(p => VALID_POSITIONS.includes(p.position));

        res.status(200).json({
            message: 'Всі гравці отримані з БД',
            players: players,
            total: players.length
        });

    } catch (err) {
        console.error('❌ Помилка при отриманні гравців:', err);

        // У разі помилки, генеруємо mock дані
        console.log('⚠️ Генеруємо mock дані через помилку...');
        const mockPlayers = [];
        const clubs = ['Динамо', 'Шахтар', 'Металіст', 'Зоря'];
        const positions = ['GK', 'DEF', 'MID', 'FWD'];
        let playerId = 1;

        positions.forEach((pos, pi) => {
            const cnt = [2, 8, 8, 5][pi];
            for (let i = 0; i < cnt; i++) {
                mockPlayers.push({
                    id: playerId++,
                    name: `Player ${playerId}`,
                    position: pos,
                    team: clubs[Math.floor(Math.random() * clubs.length)],
                    price: Math.random() * 3 + 4,
                    points: Math.floor(Math.random() * 80) + 20
                });
            }
        });

        res.status(200).json({
            message: 'Mock гравці завантажені (помилка в БД)',
            players: mockPlayers,
            total: mockPlayers.length
        });
    }
};

// Сохранити команду користувача
exports.saveUserTeam = async (req, res) => {
    const { userId } = req.params;
    const { players, formation, teamName } = req.body;

    try {
        console.log(`💾 Зберігаємо команду користувача ${userId}...`);
        console.log(`   Players: ${players ? players.length : 0}`);
        console.log(`   Formation: ${formation}`);
        console.log(`   Team Name: ${teamName}`);

        if (!players || players.length === 0) {
            return res.status(400).json({ error: 'Команда повинна містити гравців' });
        }

        // Розраховуємо загальну вартість команди
        const totalValue = players.reduce((sum, p) => sum + (p.price || 0), 0);
        const totalPoints = players.reduce((sum, p) => sum + (p.points || 0), 0);

        // Перевіряємо чи команда вже існує
        const existingTeam = await db.query(
            'SELECT id FROM fantasyteams WHERE userid = $1',
            [userId]
        );

        let result;
        let teamId;

        if (existingTeam.rows.length > 0) {
            // Оновлюємо існуючу команду
            teamId = existingTeam.rows[0].id;
            result = await db.query(
                `UPDATE fantasyteams 
                 SET teamname = $1, totalseasonpoints = $2, formation = $3
                 WHERE id = $4
                 RETURNING *`,
                [teamName, totalPoints, formation, teamId]
            );

            // Видаляємо старих гравців
            await db.query('DELETE FROM fantasyteam_footballer WHERE fantasyteamid = $1', [teamId]);

            console.log(`✅ Команду оновлено`);
        } else {
            // Створюємо нову команду
            const teamResult = await db.query(
                `INSERT INTO fantasyteams (userid, teamname, totalseasonpoints, formation)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, userid, teamname, totalseasonpoints, formation`,
                [userId, teamName, totalPoints, formation]
            );
            result = teamResult;
            teamId = teamResult.rows[0].id;
            console.log(`✅ Команду створено`);
        }

        // Додаємо гравців в команду
        for (const player of players) {
            await db.query(
                `INSERT INTO fantasyteam_footballer (fantasyteamid, footballerid)
                 VALUES ($1, $2)`,
                [teamId, player.id]
            );
        }

        res.status(200).json({
            message: 'Команда збережена',
            team: result.rows[0],
            teamValue: totalValue,
            teamPoints: totalPoints
        });

    } catch (err) {
        console.error('❌ Помилка при збереженні команди:', err);
        res.status(500).json({
            error: 'Помилка при збереженні команди',
            details: err.message
        });
    }
};

// Отримати команду користувача
exports.getUserTeam = async (req, res) => {
    const { userId } = req.params;

    try {
        await ensureAnalystRatingsTable();
        console.log(`🔍 Завантажуємо команду користувача ${userId}...`);

        const result = await db.query(
            `SELECT ft.id, ft.userid, ft.teamname, ft.totalseasonpoints, ft.formation
              FROM fantasyteams ft
              WHERE ft.userid = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(200).json({
                message: 'Команди не знайдено',
                team: null
            });
        }

        const team = result.rows[0];

        // Отримуємо гравців команди
        const playersResult = await db.query(
            `SELECT f.id, 
                    CONCAT(f.firstname, ' ', f.lastname) as name, 
                    CASE
                        WHEN UPPER(COALESCE(f.position, '')) IN ('GK', 'GOALKEEPER', 'ВРТ', 'ВОРОТАР') THEN 'GK'
                        WHEN UPPER(COALESCE(f.position, '')) IN ('DEF', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'ЗАХ', 'ЗАХИСНИК') THEN 'DEF'
                        WHEN UPPER(COALESCE(f.position, '')) IN ('MID', 'CM', 'CDM', 'CAM', 'RM', 'LM', 'ПЗ', 'ПІВЗАХИСНИК') THEN 'MID'
                        WHEN UPPER(COALESCE(f.position, '')) IN ('FWD', 'FW', 'ST', 'CF', 'STR', 'НАП', 'НАПАДНИК') THEN 'FWD'
                        ELSE UPPER(COALESCE(f.position, ''))
                    END AS position,
                    fc.name as team, 
                    CAST(f.marketvalue AS DECIMAL) as price,
                    COALESCE(apr.points, 0)::INTEGER as points
             FROM fantasyteam_footballer ftf
             JOIN footballers f ON ftf.footballerid = f.id
             LEFT JOIN footballclubs fc ON f.footballclubid = fc.id
             LEFT JOIN (
                SELECT footballerid, ROUND(AVG(rating))::INTEGER AS points
                FROM analyst_player_ratings
                GROUP BY footballerid
             ) apr ON apr.footballerid = f.id
             WHERE ftf.fantasyteamid = $1`,
            [team.id]
        );

         team.players = playersResult.rows
            .filter(p => p && p.position && ['GK', 'DEF', 'MID', 'FWD'].includes(String(p.position).toUpperCase()))
            .map(p => ({
            ...p,
            position: normalizePosition(p.position),
            price: parseFloat(p.price) || 0,
            points: Number(p.points) || 0
         }));

        console.log(`✅ Команду отримано`);

        res.status(200).json({
            message: 'Команда отримана',
            team: team
        });

    } catch (err) {
        console.error('❌ Помилка при отриманні команди:', err);
        res.status(500).json({
            error: 'Помилка при отриманні команди',
            details: err.message
        });
    }
};

// Отримати 3 найкращих гравців за позицією (для recommendations)
exports.getTopPlayersByPosition = async (req, res) => {
    const requestedPosition = normalizePosition(req.params.position);

    try {
        await ensureAnalystRatingsTable();
        console.log(`🏆 Завантажуємо топ гравців позиції: ${requestedPosition}`);

        const result = await db.query(
            `SELECT f.id, 
                    CONCAT(f.firstname, ' ', f.lastname) as name, 
                    CASE
                        WHEN UPPER(COALESCE(f.position, '')) IN ('GK', 'GOALKEEPER', 'ВРТ', 'ВОРОТАР') THEN 'GK'
                        WHEN UPPER(COALESCE(f.position, '')) IN ('DEF', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'ЗАХ', 'ЗАХИСНИК') THEN 'DEF'
                        WHEN UPPER(COALESCE(f.position, '')) IN ('MID', 'CM', 'CDM', 'CAM', 'RM', 'LM', 'ПЗ', 'ПІВЗАХИСНИК') THEN 'MID'
                        WHEN UPPER(COALESCE(f.position, '')) IN ('FWD', 'FW', 'ST', 'CF', 'STR', 'НАП', 'НАПАДНИК') THEN 'FWD'
                        ELSE UPPER(COALESCE(f.position, ''))
                    END AS position,
                    fc.name as team, 
                    CAST(f.marketvalue AS DECIMAL) as price,
                    COALESCE(apr.points, 0)::INTEGER as points
             FROM footballers f
             LEFT JOIN footballclubs fc ON f.footballclubid = fc.id
             LEFT JOIN (
                SELECT footballerid, ROUND(AVG(rating))::INTEGER AS points
                FROM analyst_player_ratings
                GROUP BY footballerid
             ) apr ON apr.footballerid = f.id
             WHERE CASE
                        WHEN UPPER(COALESCE(f.position, '')) IN ('GK', 'GOALKEEPER', 'ВРТ', 'ВОРОТАР') THEN 'GK'
                        WHEN UPPER(COALESCE(f.position, '')) IN ('DEF', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'ЗАХ', 'ЗАХИСНИК') THEN 'DEF'
                        WHEN UPPER(COALESCE(f.position, '')) IN ('MID', 'CM', 'CDM', 'CAM', 'RM', 'LM', 'ПЗ', 'ПІВЗАХИСНИК') THEN 'MID'
                        WHEN UPPER(COALESCE(f.position, '')) IN ('FWD', 'FW', 'ST', 'CF', 'STR', 'НАП', 'НАПАДНИК') THEN 'FWD'
                        ELSE UPPER(COALESCE(f.position, ''))
                   END = $1
             ORDER BY f.firstname
             LIMIT 3`,
            [requestedPosition]
        );

        // Конвертуємо price в число
        const players = result.rows.map(p => ({
            ...p,
            position: normalizePosition(p.position),
            price: parseFloat(p.price)
        })).filter(p => VALID_POSITIONS.includes(p.position));

        res.status(200).json({
            message: 'Топ гравці отримані',
            players: players
        });

    } catch (err) {
        console.error('❌ Помилка при отриманні топ гравців:', err);
        res.status(500).json({
            error: 'Помилка при отриманні топ гравців',
            details: err.message
        });
    }
};

