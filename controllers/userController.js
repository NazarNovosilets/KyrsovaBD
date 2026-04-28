const db = require('../config/db');

exports.getAllUsers = async (req, res) => {
    try {
        console.log('📊 Отримання всіх користувачів');

        // 1. Отримуємо користувачів + їхні фентезі команди (LEFT JOIN)
        const usersResult = await db.query(
            `SELECT
                 u.id,
                 u.fullname,
                 u.email,
                 u.role,
                 ft.id AS team_id,
                 ft.totalseasonpoints AS teampoints
             FROM users u
                      LEFT JOIN fantasyteams ft ON u.id = ft.userid
             ORDER BY ft.totalseasonpoints DESC NULLS LAST, u.id ASC`
        );

        const users = usersResult.rows;

        // 2. Обчислюємо статистику
        const totalUsers = users.length;
        const premiumUsers = users.filter(u => u.role === 'premium').length;
        const adminUsers = users.filter(u => u.role === 'admin').length;

        // Рахуємо середні очки ТІЛЬКИ для тих, у кого є команда
        const usersWithTeams = users.filter(u => u.team_id !== null);
        const avgPoints = usersWithTeams.length > 0
            ? usersWithTeams.reduce((sum, u) => sum + (u.teampoints || 0), 0) / usersWithTeams.length
            : 0;

        const stats = {
            totalUsers,
            activeToday: adminUsers, // Залиште вашу логіку або змініть за потребою
            avgPoints,
            premiumUsers
        };

        console.log('✅ Користувачів завантажено:', totalUsers);

        res.status(200).json({
            message: 'Користувачів успішно отримано',
            users: users,
            stats: stats
        });
    } catch (err) {
        console.error('❌ Помилка при отриманні користувачів:', err);
        res.status(500).json({ error: 'Помилка бази даних: ' + err.message });
    }
};

exports.deleteUser = async (req, res) => {
    const { userId } = req.params;

    try {
        console.log(`🗑️ Видалення користувача: ${userId}`);

        // Перевіряємо чи існує користувач
        const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [userId]);

        if (userCheck.rows.length === 0) {
            console.log(`❌ Користувач ${userId} не знайдений`);
            return res.status(404).json({ error: 'Користувач не знайдений' });
        }

        // Видаляємо користувача
        await db.query('DELETE FROM users WHERE id = $1', [userId]);

        console.log(`✅ Користувач ${userId} видалено`);
        res.status(200).json({ message: 'Користувача успішно видалено' });
    } catch (err) {
        console.error('❌ Помилка при видаленні користувача:', err);
        res.status(500).json({ error: 'Помилка бази даних: ' + err.message });
    }
};

exports.updateUser = async (req, res) => {
    const { userId } = req.params;
    const { fullname, email, role } = req.body;

    try {
        console.log(`✏️ Редагування користувача: ${userId}`);

        const result = await db.query(
            `UPDATE users 
             SET fullname = COALESCE($1, fullname), 
                 email = COALESCE($2, email),
                 role = COALESCE($3, role)
             WHERE id = $4 
             RETURNING id, fullname, email, role`,
            [fullname, email, role, userId]
        );

        if (result.rows.length === 0) {
            console.log(`❌ Користувач ${userId} не знайдений`);
            return res.status(404).json({ error: 'Користувач не знайдений' });
        }

        console.log(`✅ Користувач ${userId} оновлено`);
        res.status(200).json({
            message: 'Користувача успішно оновлено',
            user: result.rows[0]
        });
    } catch (err) {
        console.error('❌ Помилка при оновленні користувача:', err);
        res.status(500).json({ error: 'Помилка бази даних: ' + err.message });
    }
};

module.exports = {
    getAllUsers: exports.getAllUsers,
    deleteUser: exports.deleteUser,
    updateUser: exports.updateUser
};

