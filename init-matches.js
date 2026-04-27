/**
 * 🎯 Initialize Matches
 * Ініціалізує таблицю матчів з тестовими даними
 */

const db = require('./config/db');

async function initializeMatches() {
    try {
        console.log('🎯 Ініціалізуємо таблицю матчів...');

        // 1. Перевіримо чи існує таблиця
        const tableCheck = await db.query(
            `SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'matches'
            )`
        );

        if (tableCheck.rows[0].exists) {
            console.log('✅ Таблиця matches уже існує');

            // Перевіримо кількість записів
            const countResult = await db.query('SELECT COUNT(*) as count FROM matches');
            const count = parseInt(countResult.rows[0].count);

            if (count > 0) {
                console.log(`✅ Таблиця містить ${count} матчів`);
                return;
            }
        } else {
            console.log('📝 Створюємо таблицю matches...');

            await db.query(`
                CREATE TABLE matches (
                    id SERIAL PRIMARY KEY,
                    hometeamid INT,
                    awayteamid INT,
                    hometeam VARCHAR(100) NOT NULL,
                    awayteam VARCHAR(100) NOT NULL,
                    homecode VARCHAR(10) NOT NULL,
                    awaycode VARCHAR(10) NOT NULL,
                    matchdate DATE NOT NULL,
                    matchtime TIME NOT NULL,
                    status VARCHAR(20) DEFAULT 'upcoming',
                    gameweek INT,
                    homelayout VARCHAR(50),
                    awaylayout VARCHAR(50),
                    homegoals INT DEFAULT 0,
                    awaygoals INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            console.log('✅ Таблиця matches створена');
        }

        // 2. Додаємо індекси
        console.log('📝 Додаємо індекси...');
        await db.query(`CREATE INDEX IF NOT EXISTS idx_matches_gameweek ON matches(gameweek)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(matchdate)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status)`);

        // 3. Вставляємо тестові дані
        console.log('📝 Вставляємо тестові матчи...');

        const testMatches = [
            {
                homeTeam: 'Shakhtar Donetsk',
                awayTeam: 'Dnipro-1',
                homeCode: 'SHA',
                awayCode: 'DNP',
                matchDate: '2026-04-05',
                matchTime: '15:00',
                gameweek: 25,
                homeLayout: '3-4-3',
                awayLayout: '4-2-3-1'
            },
            {
                homeTeam: 'Zorya Luhansk',
                awayTeam: 'Dynamo Kyiv',
                homeCode: 'ZOR',
                awayCode: 'DYN',
                matchDate: '2026-04-05',
                matchTime: '17:30',
                gameweek: 25,
                homeLayout: '4-2-3-1',
                awayLayout: '3-5-2'
            },
            {
                homeTeam: 'Oleksandriya',
                awayTeam: 'Shakhtar Donetsk',
                homeCode: 'OLE',
                awayCode: 'SHA',
                matchDate: '2026-04-06',
                matchTime: '14:00',
                gameweek: 25,
                homeLayout: '4-3-3',
                awayLayout: '3-4-3'
            },
            {
                homeTeam: 'Kolos Kovalivka',
                awayTeam: 'Vorskla Poltava',
                homeCode: 'KOL',
                awayCode: 'VOR',
                matchDate: '2026-04-06',
                matchTime: '16:30',
                gameweek: 25,
                homeLayout: '4-2-3-1',
                awayLayout: '4-2-3-1'
            },
            {
                homeTeam: 'Chornomorets',
                awayTeam: 'Metalurh',
                homeCode: 'CHO',
                awayCode: 'MET',
                matchDate: '2026-04-07',
                matchTime: '19:00',
                gameweek: 25,
                homeLayout: '5-3-2',
                awayLayout: '4-4-2'
            },
            {
                homeTeam: 'Veres',
                awayTeam: 'Polissya',
                homeCode: 'VER',
                awayCode: 'POL',
                matchDate: '2026-04-07',
                matchTime: '18:00',
                gameweek: 25,
                homeLayout: '4-3-3',
                awayLayout: '4-3-3'
            }
        ];

        for (const match of testMatches) {
            await db.query(
                `INSERT INTO matches (hometeam, awayteam, homecode, awaycode, matchdate, matchtime, status, gameweek, homelayout, awaylayout)
                 VALUES ($1, $2, $3, $4, $5, $6, 'upcoming', $7, $8, $9)
                 ON CONFLICT DO NOTHING`,
                [
                    match.homeTeam,
                    match.awayTeam,
                    match.homeCode,
                    match.awayCode,
                    match.matchDate,
                    match.matchTime,
                    match.gameweek,
                    match.homeLayout,
                    match.awayLayout
                ]
            );
        }

        console.log('✅ Тестові матчи додані успішно');

        // 4. Перевіримо дані
        const result = await db.query('SELECT COUNT(*) as count FROM matches');
        console.log(`✅ Всього матчів у таблиці: ${result.rows[0].count}`);

    } catch (err) {
        console.error('❌ Помилка при ініціалізації матчів:', err);
    }
}

// Запускаємо ініціалізацію
initializeMatches().then(() => {
    console.log('✅ Ініціалізація завершена');
    process.exit(0);
}).catch(err => {
    console.error('❌ Помилка:', err);
    process.exit(1);
});

