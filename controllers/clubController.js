const db = require('../config/db');

exports.getAllClubs = async (req, res) => {
    try {
        console.log('🏢 Завантаження всіх клубів...');
        const result = await db.query(
            `SELECT Id, Name, City 
             FROM FootballClubs 
             ORDER BY Id ASC`
        );

        res.status(200).json({
            message: 'Клуби успішно завантажено',
            clubs: result.rows,
            total: result.rows.length
        });
    } catch (err) {
        console.error('❌ Помилка при завантаженні клубів:', err);
        res.status(500).json({ error: 'Помилка бази даних: ' + err.message });
    }
};

exports.deleteClub = async (req, res) => {
    const { id } = req.params;

    try {
        console.log(`🗑️ Спроба видалити клуб з ID: ${id}`);

        // Відправляємо запит на видалення. Усю магію робить тригер у БД.
        await db.query('DELETE FROM FootballClubs WHERE Id = $1', [id]);

        console.log(`✅ Клуб ${id}, його гравці та минулі матчі успішно видалені.`);
        res.status(200).json({ message: 'Клуб успішно видалено' });

    } catch (err) {
        console.error('❌ Помилка видалення клубу:', err);

        // P0001 - це код кастомної помилки (RAISE EXCEPTION), яку ми написали в тригері
        if (err.code === 'P0001') {
            return res.status(400).json({
                error: err.message // Передаємо текст: "Неможливо видалити клуб: у нього є..."
            });
        }

        // Інші непередбачувані помилки бази даних
        res.status(500).json({ error: 'Помилка сервера: ' + err.message });
    }
};


exports.addClub = async (req, res) => {
    const { name, city } = req.body;

    if (!name || !city) {
        return res.status(400).json({ error: 'Назва та місто обов\'язкові для заповнення' });
    }

    try {
        console.log(`➕ Спроба додати клуб: ${name} (${city})`);

        // Викликаємо нашу збережену SQL-функцію
        const result = await db.query(
            'SELECT add_football_club($1, $2) AS new_id',
            [name.trim(), city.trim()]
        );

        res.status(201).json({
            message: 'Клуб успішно додано',
            clubId: result.rows[0].new_id
        });

    } catch (err) {
        console.error('❌ Помилка додавання клубу:', err);

        // P0001 - код нашого RAISE EXCEPTION (коли клуб вже існує)
        if (err.code === 'P0001') {
            return res.status(400).json({ error: err.message });
        }

        res.status(500).json({ error: 'Помилка сервера: ' + err.message });
    }
};