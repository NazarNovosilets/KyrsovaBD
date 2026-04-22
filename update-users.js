const db = require('./config/db');
require('dotenv').config();

async function updateUsers() {
    try {
        console.log('⏳ Оновлюємо користувачів...');

        // Оновлюємо бали для кожного користувача
        const updates = [
            { id: 1, points: 1000 },
            { id: 3, points: 680 },
            { id: 4, points: 400 },
            { id: 6, points: 1080 }
        ];

        for (const update of updates) {
            await db.query(
                'UPDATE users SET totalpoints = $1 WHERE id = $2',
                [update.points, update.id]
            );
            console.log(`✅ Користувач ID ${update.id} отримав ${update.points} балів`);
        }

        // Виводимо всіх користувачів
        const result = await db.query(
            'SELECT id, fullname, email, totalpoints FROM users ORDER BY totalpoints DESC'
        );

        console.log('\n📊 Всі користувачі:');
        result.rows.forEach((user, index) => {
            console.log(`${index + 1}. ${user.fullname} (${user.email}) - ${user.totalpoints} балів`);
        });

        console.log('\n✅ Оновлення завершено!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Помилка:', err);
        process.exit(1);
    }
}

updateUsers();
