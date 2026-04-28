const db = require('../config/db');

exports.getAllFootballers = async (req, res) => {
    try {
        console.log('🏈 Отримання всіх футболістів');

        const result = await db.query(
            `SELECT f.id, 
                    CONCAT(f.firstname, ' ', f.lastname) as name, 
                    f.position, 
                    fc.name as club, 
                    CAST(f.marketvalue AS DECIMAL) as price,
                    FLOOR(RANDOM() * 80 + 20)::INTEGER as points
             FROM footballers f
             LEFT JOIN footballclubs fc ON f.footballclubid = fc.id
             ORDER BY f.position, f.firstname`
        );

        const footballers = result.rows;

        // Обчислюємо статистику
        const totalPlayers = footballers.length;
        const goalkeepers = footballers.filter(p => p.position === 'GK').length;
        const defenders = footballers.filter(p => p.position === 'DEF').length;
        const attackers = footballers.filter(p => p.position === 'FWD' || p.position === 'MID').length;

        const stats = {
            totalPlayers,
            goalkeepers,
            defenders,
            attackers
        };

        console.log('✅ Футболістів завантажено:', totalPlayers);
        console.log('📈 Статистика:', stats);

        res.status(200).json({
            message: 'Футболістів успішно отримано',
            footballers: footballers.map(f => ({
                ...f,
                price: parseFloat(f.price)
            })),
            stats: stats
        });
    } catch (err) {
        console.error('❌ Помилка при отриманні футболістів:', err);

        // Генеруємо mock дані у разі помилки
        console.log('⚠️ Генеруємо mock дані...');
        const mockFootballers = [];
        const clubs = ['Динамо', 'Шахтар', 'Металіст', 'Зоря', 'Ворскла', 'Колос'];
        const firstNames = ['Ігор', 'Віталій', 'Олександр', 'Сергій', 'Геннадій', 'Анатолій', 'Валерій', 'Дмитро'];
        const lastNames = ['Бущан', 'Тимчик', 'Сирота', 'Буялський', 'Шепельов', 'Ванат', 'Трубін', 'Матвієнко'];
        const positions = ['GK', 'DEF', 'MID', 'FWD'];
        let id = 1;

        positions.forEach((pos) => {
            const count = pos === 'GK' ? 5 : pos === 'DEF' ? 6 : pos === 'MID' ? 8 : 12;
            for (let i = 0; i < count; i++) {
                mockFootballers.push({
                    id: id++,
                    name: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
                    position: pos,
                    club: clubs[Math.floor(Math.random() * clubs.length)],
                    price: Math.random() * 4 + 4.5,
                    points: Math.floor(Math.random() * 80 + 20)
                });
            }
        });

        const totalPlayers = mockFootballers.length;
        const stats = {
            totalPlayers,
            goalkeepers: mockFootballers.filter(p => p.position === 'GK').length,
            defenders: mockFootballers.filter(p => p.position === 'DEF').length,
            attackers: mockFootballers.filter(p => p.position === 'FWD' || p.position === 'MID').length
        };

        res.status(200).json({
            message: 'Mock футболісти завантажені',
            footballers: mockFootballers,
            stats: stats
        });
    }
};

exports.deleteFootballer = async (req, res) => {
    const { footballerId } = req.params;

    try {
        console.log(`🗑️ Видалення футболіста: ${footballerId}`);

        await db.query('DELETE FROM footballers WHERE id = $1', [footballerId]);

        console.log(`✅ Футболіста ${footballerId} видалено`);
        res.status(200).json({ message: 'Футболіста успішно видалено' });
    } catch (err) {
        console.error('❌ Помилка при видаленні футболіста:', err);
        res.status(500).json({ error: 'Помилка бази даних: ' + err.message });
    }
};

exports.addFootballer = async (req, res) => {
    const { firstname, lastname, position, footballclubid, marketvalue } = req.body;

    try {
        console.log(`➕ Додання нового футболіста: ${firstname} ${lastname}`);

        const result = await db.query(
            'INSERT INTO footballers (firstname, lastname, position, footballclubid, marketvalue) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [firstname, lastname, position, footballclubid, marketvalue]
        );

        console.log(`✅ Футболіста ${result.rows[0].id} успішно додано`);
        res.status(201).json({
            message: 'Футболіста успішно додано',
            footballerId: result.rows[0].id
        });
    } catch (err) {
        console.error('❌ Помилка при додаванні футболіста:', err);
        res.status(500).json({ error: 'Помилка бази даних: ' + err.message });
    }
};

exports.updateFootballer = async (req, res) => {
    const { footballerId } = req.params;
    const { firstname, lastname, position, marketvalue } = req.body;

    try {
        console.log(`✏️ Оновлення футболіста: ${footballerId}`);

        const result = await db.query(
            `UPDATE footballers 
             SET firstname = COALESCE($1, firstname), 
                 lastname = COALESCE($2, lastname),
                 position = COALESCE($3, position),
                 marketvalue = COALESCE($4, marketvalue)
             WHERE id = $5 
             RETURNING id, firstname, lastname, position, marketvalue`,
            [firstname, lastname, position, marketvalue, footballerId]
        );

        if (result.rows.length === 0) {
            console.log(`❌ Футболіст ${footballerId} не знайдений`);
            return res.status(404).json({ error: 'Футболіст не знайдений' });
        }

        console.log(`✅ Футболіста ${footballerId} оновлено`);
        res.status(200).json({
            message: 'Футболіста успішно оновлено',
            footballer: result.rows[0]
        });
    } catch (err) {
        console.error('❌ Помилка при оновленні футболіста:', err);
        res.status(500).json({ error: 'Помилка бази даних: ' + err.message });
    }
};

module.exports = {
    getAllFootballers: exports.getAllFootballers,
    deleteFootballer: exports.deleteFootballer,
    addFootballer: exports.addFootballer,
    updateFootballer: exports.updateFootballer
};
