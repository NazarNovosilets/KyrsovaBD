const db = require('../config/db');

/**
 * 📊 Leaderboard Controller
 * Працює з користувачами, які вже створили власну фентезі-команду.
 */

exports.getLeaderboard = async (req, res) => {
    try {
        console.log('📊 Завантажуємо лідерборд команд...');

        const result = await db.query(
            `SELECT
                u.id,
                u.fullname,
                u.email,
                u.registrationdate,
                ft.id AS team_id,
                ft.teamname,
                COALESCE(ft.totalseasonpoints, 0) AS team_points,
                ROW_NUMBER() OVER (
                    ORDER BY COALESCE(ft.totalseasonpoints, 0) DESC, u.registrationdate ASC, u.id ASC
                ) AS rank
             FROM users u
             JOIN fantasyteams ft ON ft.userid = u.id
             ORDER BY COALESCE(ft.totalseasonpoints, 0) DESC, u.registrationdate ASC, u.id ASC`
        );

        const leaderboard = result.rows.map((row) => ({
            rank: Number(row.rank),
            id: Number(row.id),
            name: row.fullname || row.email || 'Unknown manager',
            email: row.email,
            points: Number(row.team_points) || 0,
            team: {
                id: Number(row.team_id),
                name: row.teamname || 'My Team',
                points: Number(row.team_points) || 0
            }
        }));

        res.status(200).json({
            message: leaderboard.length
                ? 'Лідерборд успішно отримано'
                : 'Лідерборд порожній',
            leaderboard,
            totalManagers: leaderboard.length
        });
    } catch (err) {
        console.error('❌ Помилка при отриманні лідерборду:', err);
        res.status(500).json({
            error: 'Помилка при отриманні лідерборду',
            details: err.message
        });
    }
};

/**
 * 📈 Get User Stats
 * Отримує статистику користувача з урахуванням його фентезі-команди.
 */
exports.getUserStats = async (req, res) => {
    const { userId } = req.params;

    try {
        console.log(`📊 Отримуємо статистику для користувача ID: ${userId}`);

        if (!userId) {
            return res.status(400).json({ error: 'userId не надано' });
        }

        const userResult = await db.query(
            `SELECT
                u.id,
                u.fullname,
                u.email,
                ft.id AS team_id,
                ft.teamname,
                COALESCE(ft.totalseasonpoints, 0) AS team_points
             FROM users u
             LEFT JOIN fantasyteams ft ON ft.userid = u.id
             WHERE u.id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            console.log(`⚠️  Користувач з ID ${userId} не знайдений`);
            return res.status(404).json({ error: 'Користувач не знайдений' });
        }

        const user = userResult.rows[0];

        const totalManagersResult = await db.query(
            'SELECT COUNT(*) AS total FROM fantasyteams'
        );
        const totalManagers = Number(totalManagersResult.rows[0].total) || 0;

        let userRank = 0;

        if (user.team_id) {
            const rankResult = await db.query(
                `SELECT COUNT(*) AS better_count
                 FROM users u
                 JOIN fantasyteams ft ON ft.userid = u.id
                 WHERE
                    COALESCE(ft.totalseasonpoints, 0) > $1
                    OR (
                        COALESCE(ft.totalseasonpoints, 0) = $1
                        AND (
                            u.registrationdate < (SELECT registrationdate FROM users WHERE id = $2)
                            OR (
                                u.registrationdate = (SELECT registrationdate FROM users WHERE id = $2)
                                AND u.id < $2
                            )
                        )
                    )`,
                [Number(user.team_points) || 0, user.id]
            );

            userRank = (Number(rankResult.rows[0].better_count) || 0) + 1;
        }

        const stats = {
            id: Number(user.id),
            name: user.fullname || user.email,
            email: user.email,
            points: Number(user.team_points) || 0,
            rank: userRank,
            totalManagers,
            hasTeam: Boolean(user.team_id),
            team: user.team_id
                ? {
                    id: Number(user.team_id),
                    name: user.teamname || 'My Team',
                    points: Number(user.team_points) || 0
                }
                : null
        };

        res.status(200).json({
            message: 'Статистика користувача отримана',
            stats
        });
    } catch (err) {
        console.error('❌ Помилка при отриманні статистики:', err);
        res.status(500).json({
            error: 'Помилка при отриманні статистики',
            details: err.message
        });
    }
};

/**
 * 🏆 Get Top Managers
 * Отримує менеджерів із командами, відсортованих за балами команди.
 */
exports.getTopManagers = async (req, res) => {
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
        ? requestedLimit
        : 10;

    try {
        console.log(`🏆 Завантажуємо топ ${limit} менеджерів...`);

        const result = await db.query(
            `SELECT
                u.id,
                u.fullname,
                u.email,
                ft.id AS team_id,
                ft.teamname,
                COALESCE(ft.totalseasonpoints, 0) AS team_points,
                ROW_NUMBER() OVER (
                    ORDER BY COALESCE(ft.totalseasonpoints, 0) DESC, u.registrationdate ASC, u.id ASC
                ) AS rank
             FROM users u
             JOIN fantasyteams ft ON ft.userid = u.id
             ORDER BY COALESCE(ft.totalseasonpoints, 0) DESC, u.registrationdate ASC, u.id ASC
             LIMIT $1`,
            [limit]
        );

        const topManagers = result.rows.map((row) => ({
            rank: Number(row.rank),
            id: Number(row.id),
            name: row.fullname || row.email || 'Unknown manager',
            email: row.email,
            points: Number(row.team_points) || 0,
            team: {
                id: Number(row.team_id),
                name: row.teamname || 'My Team',
                points: Number(row.team_points) || 0
            }
        }));

        res.status(200).json({
            message: 'Топ менеджери отримані',
            topManagers,
            total: topManagers.length
        });
    } catch (err) {
        console.error('❌ Помилка при отриманні топ менеджерів:', err);
        res.status(500).json({
            error: 'Помилка при отриманні топ менеджерів',
            details: err.message
        });
    }
};

