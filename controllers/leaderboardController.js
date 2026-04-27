const db = require('../config/db');

/**
 * 📊 Leaderboard Controller
 * Логіка отримання, парсингу та трансформації даних лідерборду
 */

exports.getLeaderboard = async (req, res) => {
    try {
        console.log('📊 Завантажуємо лідерборд...');

        // 1️⃣ SQL ЗАПИТ - Вибираємо користувачів з БД, сортуємо за балами
        const result = await db.query(
            `SELECT id, fullname, email, totalpoints 
             FROM users 
             ORDER BY totalpoints DESC, registrationdate DESC 
             LIMIT 5`
        );

        console.log(`✅ З БД отримано ${result.rows.length} користувачів`);
        console.log('🔍 Сирові дані з БД:', result.rows);

        if (result.rows.length > 0) {
            console.log('🔑 Ключи першого користувача:', Object.keys(result.rows[0]));
        }

        // Показуємо всіх користувачів (навіть з 0 балів)
        const filteredUsers = result.rows;

        console.log(`📊 Користувачів для лідерборду: ${filteredUsers.length}`);

        if (filteredUsers.length === 0) {
            console.log('⚠️  Користувачі не знайдені');
            return res.status(200).json({
                message: 'Лідерборд порожній',
                leaderboard: [],
                totalManagers: 0,
                rawData: result.rows
            });
        }

        // 2️⃣ ПАРСИНГ ДАНИХ - Трансформуємо дані для фронтенду
        const leaderboardWithTeams = await Promise.all(filteredUsers.map(async (user, index) => {
            const fullname = user.fullname || user.FullName || 'Unknown';
            const email = user.email || user.Email || 'unknown@email.com';
            const points = user.totalpoints || user.TotalPoints || 0;
            const id = user.id || user.Id || index;

            // 🔍 Отримуємо дані команди користувача
            let teamData = null;
            try {
                const teamResult = await db.query(
                    `SELECT ft.id, ft.teamname, ft.totalseasonpoints
                     FROM fantasyteams ft
                     WHERE ft.userid = $1`,
                    [id]
                );
                if (teamResult.rows.length > 0) {
                    teamData = {
                        id: teamResult.rows[0].id,
                        name: teamResult.rows[0].teamname,
                        points: teamResult.rows[0].totalseasonpoints || 0
                    };
                    console.log(`   ⚽ Команда: ${teamData.name} - ${teamData.points} поінтів`);
                }
            } catch (teamErr) {
                console.error(`   ⚠️ Помилка при отриманні команди користувача ${id}:`, teamErr.message);
            }

            console.log(`  ${index + 1}. ${fullname} - ${points} балів`);

            return {
                rank: index + 1,
                name: fullname,
                email: email,
                points: parseInt(points) || 0,
                id: id,
                team: teamData
            };
        }));

        // 3️⃣ ФІЛЬТРУВАННЯ - Показуємо тільки користувачів з командою
        const leaderboard = leaderboardWithTeams.filter((manager, index) => {
            if (!manager.team) {
                console.log(`   ⏭️  Пропускаємо ${manager.name} - немає команди`);
                return false;
            }
            return true;
        }).map((manager, index) => ({
            ...manager,
            rank: index + 1
        }));

        console.log('✅ Дані парсенні успішно');

        // 3️⃣ HTTP ВІДПОВІДЬ - Відправляємо парсенні дані
        res.status(200).json({
            message: 'Лідерборд успішно отримано',
            leaderboard: leaderboard,
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
 * Отримує статистику конкретного користувача
 */
exports.getUserStats = async (req, res) => {
    const { userId } = req.params;

    try {
        console.log(`📊 Отримуємо статистику для користувача ID: ${userId}`);

        if (!userId) {
            return res.status(400).json({ error: 'userId не надано' });
        }

        // 1️⃣ SQL ЗАПИТ - Вибираємо дані користувача
        const result = await db.query(
            `SELECT id, fullname, email, totalpoints
             FROM users 
             WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            console.log(`⚠️  Користувач з ID ${userId} не знайдений`);
            return res.status(404).json({ error: 'Користувач не знайдений' });
        }

        const user = result.rows[0];
        console.log(`✅ Користувач знайдений: ${user.fullname}`);

        // 2️⃣ SQL ЗАПИТ - Отримаємо загальну кількість користувачів
        const countResult = await db.query('SELECT COUNT(*) as total FROM users');
        const totalManagers = parseInt(countResult.rows[0].total) || 0;

        // 3️⃣ SQL ЗАПИТ - Розраховуємо рейтинг користувача
        const rankResult = await db.query(
            `SELECT COUNT(*) as rank FROM users 
             WHERE totalpoints > $1 OR (totalpoints = $1 AND id < $2)`,
            [user.totalpoints, user.id]
        );
        const userRank = parseInt(rankResult.rows[0].rank) + 1;

        // 4️⃣ ПАРСИНГ ДАНИХ - Формуємо результат
        const stats = {
            id: user.id,
            name: user.fullname,
            email: user.email,
            points: parseInt(user.totalpoints) || 0,
            rank: userRank,
            totalManagers: totalManagers
        };

        console.log(`✅ Статистика парсена успішно. Рейтинг: ${userRank}/${totalManagers}`);

        // 5️⃣ HTTP ВІДПОВІДЬ
        res.status(200).json({
            message: 'Статистика користувача отримана',
            stats: stats
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
 * Отримує топ менеджерів по балам
 */
exports.getTopManagers = async (req, res) => {
    const limit = req.query.limit || 10;

    try {
        console.log(`🏆 Завантажуємо топ ${limit} менеджерів...`);

        const result = await db.query(
            `SELECT id, fullname, email, totalpoints 
             FROM users 
             ORDER BY totalpoints DESC, registrationdate DESC
             LIMIT $1`,
            [limit]
        );

        console.log(`✅ З БД отримано ${result.rows.length} менеджерів`);

        const topManagers = result.rows.map((user, index) => ({
            rank: index + 1,
            name: user.fullname,
            email: user.email,
            points: parseInt(user.totalpoints) || 0,
            id: user.id
        }));

        res.status(200).json({
            message: 'Топ менеджери отримані',
            topManagers: topManagers,
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

