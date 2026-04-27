const db = require('../config/db');

/**
 * 🎯 Matches Controller
 * Логіка отримання та обробки матчів
 */

/**
 * 📊 Get Match Fixtures (Upcoming)
 * Отримує наступні матчи для сторінки Matches
 */
exports.getFixtures = async (req, res) => {
    try {
        console.log('📊 Завантажуємо наступні матчи...');

        // Робимо JOIN з FootballClubs щоб отримати реальні імена команд
        const result = await db.query(
            `SELECT
                 m.Id, m.HomeClubId, hc.Name AS hometeam,
                 m.AwayClubId, ac.Name AS awayteam,
                 m.Date AS matchdate, m.Score, m.MatchDay AS gameweek,
                 m.Status
             FROM Matches m
                      JOIN FootballClubs hc ON m.HomeClubId = hc.Id
                      JOIN FootballClubs ac ON m.AwayClubId = ac.Id
             WHERE m.Status = 'upcoming' OR m.Status = 'postponed'
             ORDER BY m.Date ASC
                 LIMIT 20`
        );

        console.log(`✅ З БД отримано ${result.rows.length} матчів`);

        const matches = result.rows.map((match) => {
            const dateObj = new Date(match.matchdate);

            return {
                id: match.id,
                homeTeamId: match.homeclubid,
                awayTeamId: match.awayclubid,
                homeTeam: match.hometeam,
                awayTeam: match.awayteam,
                // Беремо перші 3 букви назви для коду (напр. "DYN" для Dynamo)
                homeCode: match.hometeam.substring(0, 3).toUpperCase(),
                awayCode: match.awayteam.substring(0, 3).toUpperCase(),
                date: formatDate(match.matchdate),
                // Витягуємо час з TIMESTAMP (напр. "19:00")
                time: dateObj.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
                status: 'upcoming',
                gameweek: `GW ${match.gameweek}`
            };
        });

        res.status(200).json({
            message: 'Наступні матчи успішно отримані',
            matches: matches,
            total: matches.length
        });

    } catch (err) {
        console.error('❌ Помилка при отриманні матчів:', err);
        res.status(500).json({
            error: 'Помилка при отриманні матчів',
            details: err.message
        });
    }
};

/**
 * 📈 Get League Standings
 * Розраховує турнірну таблицю на основі завершених матчів
 */
exports.getStandings = async (req, res) => {
    try {
        console.log('📈 Генеруємо турнірну таблицю...');

        // 1. Отримуємо всі клуби
        const clubsResult = await db.query(`SELECT Id, Name FROM FootballClubs`);
        const standingsMap = {};

        // Ініціалізуємо статистику нулями для кожної команди
        clubsResult.rows.forEach(club => {
            standingsMap[club.id] = {
                id: club.id,
                name: club.name,
                played: 0, won: 0, drawn: 0, lost: 0,
                gf: 0, ga: 0, gd: 0, points: 0
            };
        });

        // 2. Отримуємо всі ЗАВЕРШЕНІ матчі
        const matchesResult = await db.query(
            `SELECT HomeClubId, AwayClubId, Score 
             FROM Matches 
             WHERE Status = 'finished' AND Score IS NOT NULL`
        );

        // 3. Рахуємо статистику на основі рахунку
        matchesResult.rows.forEach(match => {
            const [homeGoalsStr, awayGoalsStr] = match.score.split(':');
            const homeGoals = parseInt(homeGoalsStr, 10);
            const awayGoals = parseInt(awayGoalsStr, 10);

            if (isNaN(homeGoals) || isNaN(awayGoals)) return;

            const homeTeam = standingsMap[match.homeclubid];
            const awayTeam = standingsMap[match.awayclubid];

            if (!homeTeam || !awayTeam) return;

            // Збільшуємо кількість зіграних матчів та голів
            homeTeam.played += 1;
            awayTeam.played += 1;
            homeTeam.gf += homeGoals;
            homeTeam.ga += awayGoals;
            awayTeam.gf += awayGoals;
            awayTeam.ga += homeGoals;

            // Нараховуємо очки
            if (homeGoals > awayGoals) {
                homeTeam.won += 1;
                homeTeam.points += 3;
                awayTeam.lost += 1;
            } else if (homeGoals < awayGoals) {
                awayTeam.won += 1;
                awayTeam.points += 3;
                homeTeam.lost += 1;
            } else {
                homeTeam.drawn += 1;
                awayTeam.drawn += 1;
                homeTeam.points += 1;
                awayTeam.points += 1;
            }
        });

        // 4. Формуємо масив, рахуємо різницю голів (GD) і сортуємо
        const standingsArray = Object.values(standingsMap).map(team => {
            team.gd = team.gf - team.ga;
            return team;
        });

        // Сортуємо: Очки -> Різниця голів -> Забиті голи
        standingsArray.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.gf - a.gf;
        });

        res.status(200).json({
            message: 'Таблиця успішно згенерована',
            standings: standingsArray
        });

    } catch (err) {
        console.error('❌ Помилка генерації таблиці:', err);
        res.status(500).json({ error: 'Помилка', details: err.message });
    }
};

/**
 * 📈 Get League Standings
 * Розраховує турнірну таблицю на основі завершених матчів
 */
exports.getStandings = async (req, res) => {
    try {
        console.log('📈 Генеруємо турнірну таблицю...');

        // 1. Отримуємо всі клуби
        const clubsResult = await db.query(`SELECT Id, Name FROM FootballClubs`);
        const standingsMap = {};

        // Ініціалізуємо статистику нулями для кожної команди
        clubsResult.rows.forEach(club => {
            standingsMap[club.id] = {
                id: club.id,
                name: club.name,
                played: 0, won: 0, drawn: 0, lost: 0,
                gf: 0, ga: 0, gd: 0, points: 0
            };
        });

        // 2. Отримуємо всі ЗАВЕРШЕНІ матчі
        const matchesResult = await db.query(
            `SELECT HomeClubId, AwayClubId, Score 
             FROM Matches 
             WHERE Status = 'finished' AND Score IS NOT NULL`
        );

        // 3. Рахуємо статистику на основі рахунку
        matchesResult.rows.forEach(match => {
            const [homeGoalsStr, awayGoalsStr] = match.score.split(':');
            const homeGoals = parseInt(homeGoalsStr, 10);
            const awayGoals = parseInt(awayGoalsStr, 10);

            if (isNaN(homeGoals) || isNaN(awayGoals)) return;

            const homeTeam = standingsMap[match.homeclubid];
            const awayTeam = standingsMap[match.awayclubid];

            if (!homeTeam || !awayTeam) return;

            // Збільшуємо кількість зіграних матчів та голів
            homeTeam.played += 1;
            awayTeam.played += 1;
            homeTeam.gf += homeGoals;
            homeTeam.ga += awayGoals;
            awayTeam.gf += awayGoals;
            awayTeam.ga += homeGoals;

            // Нараховуємо очки
            if (homeGoals > awayGoals) {
                homeTeam.won += 1;
                homeTeam.points += 3;
                awayTeam.lost += 1;
            } else if (homeGoals < awayGoals) {
                awayTeam.won += 1;
                awayTeam.points += 3;
                homeTeam.lost += 1;
            } else {
                homeTeam.drawn += 1;
                awayTeam.drawn += 1;
                homeTeam.points += 1;
                awayTeam.points += 1;
            }
        });

        // 4. Формуємо масив, рахуємо різницю голів (GD) і сортуємо
        const standingsArray = Object.values(standingsMap).map(team => {
            team.gd = team.gf - team.ga;
            return team;
        });

        // Сортуємо: Очки -> Різниця голів -> Забиті голи
        standingsArray.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.gf - a.gf;
        });

        res.status(200).json({
            message: 'Таблиця успішно згенерована',
            standings: standingsArray
        });

    } catch (err) {
        console.error('❌ Помилка генерації таблиці:', err);
        res.status(500).json({ error: 'Помилка', details: err.message });
    }
};

/**
 * 📋 Get All Matches
 */
exports.getAllMatches = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                 m.Id, m.HomeClubId, hc.Name AS hometeam,
                 m.AwayClubId, ac.Name AS awayteam,
                 m.Date AS matchdate, m.Score, m.MatchDay AS gameweek,
                 m.Status
             FROM Matches m
                      JOIN FootballClubs hc ON m.HomeClubId = hc.Id
                      JOIN FootballClubs ac ON m.AwayClubId = ac.Id
             WHERE m.Status = 'finished'
             ORDER BY m.Date DESC
                 LIMIT 20`
        );

        const matches = result.rows.map(mapMatchData);

        res.status(200).json({ matches, total: matches.length });
    } catch (err) {
        res.status(500).json({ error: 'Помилка', details: err.message });
    }
};

/**
 * 🎯 Get Match by ID
 */
exports.getMatchById = async (req, res) => {
    const { matchId } = req.params;
    try {
        const result = await db.query(
            `SELECT 
                m.Id, m.HomeClubId, hc.Name AS hometeam, 
                m.AwayClubId, ac.Name AS awayteam, 
                m.Date AS matchdate, m.Score, m.MatchDay AS gameweek
             FROM Matches m
             JOIN FootballClubs hc ON m.HomeClubId = hc.Id
             JOIN FootballClubs ac ON m.AwayClubId = ac.Id
             WHERE m.Id = $1`,
            [matchId]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Матч не знайдений' });

        res.status(200).json({ match: mapMatchData(result.rows[0]) });
    } catch (err) {
        res.status(500).json({ error: 'Помилка', details: err.message });
    }
};

/**
 * 📋 Get Matches by Gameweek
 * Отримує матчі для конкретного туру (геймвіку)
 */
exports.getMatchesByGameweek = async (req, res) => {
    const { gameweek } = req.params;

    try {
        console.log(`📋 Завантажуємо матчі для геймвіку ${gameweek}...`);

        if (!gameweek) {
            return res.status(400).json({ error: 'Gameweek не надано' });
        }

        // Тут ми також використовуємо JOIN, як і в інших методах
        const result = await db.query(
            `SELECT 
                m.Id, m.HomeClubId, hc.Name AS hometeam, 
                m.AwayClubId, ac.Name AS awayteam, 
                m.Date AS matchdate, m.Score, m.MatchDay AS gameweek
             FROM Matches m
             JOIN FootballClubs hc ON m.HomeClubId = hc.Id
             JOIN FootballClubs ac ON m.AwayClubId = ac.Id
             WHERE m.MatchDay = $1
             ORDER BY m.Date ASC`,
            [gameweek]
        );

        console.log(`✅ З БД отримано ${result.rows.length} матчів для GW ${gameweek}`);

        // Використовуємо ту саму функцію-хелпер mapMatchData
        const matches = result.rows.map(mapMatchData);

        res.status(200).json({
            message: `Матчи для GW ${gameweek} успішно отримані`,
            matches: matches,
            gameweek: gameweek,
            total: matches.length
        });

    } catch (err) {
        console.error('❌ Помилка при отриманні матчів:', err);
        res.status(500).json({
            error: 'Помилка при отриманні матчів',
            details: err.message
        });
    }
};
/**
 * 🔄 Допоміжна функція для мапінгу даних (щоб не дублювати код)
 */


function mapMatchData(match) {
    const dateObj = new Date(match.matchdate);
    return {
        id: match.id,
        homeTeam: match.hometeam,
        awayTeam: match.awayteam,
        homeCode: match.hometeam.substring(0, 3).toUpperCase(),
        awayCode: match.awayteam.substring(0, 3).toUpperCase(),
        date: formatDate(match.matchdate),
        time: dateObj.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
        score: match.score,
        gameweek: match.gameweek
    };
}

/**
 * 📅 Допоміжна функція форматування дати
 */
function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * 📊 Get Match Results (Past Matches)
 * Отримує результати минулих матчів
 */
exports.getResults = async (req, res) => {
    try {
        console.log('📊 Завантажуємо результати матчів...');

        // Беремо матчі, які вже відбулися (дата менша за поточну)
        const result = await db.query(
            `SELECT 
                m.Id, m.HomeClubId, hc.Name AS hometeam, 
                m.AwayClubId, ac.Name AS awayteam, 
                m.Date AS matchdate, m.Score, m.MatchDay AS gameweek
             FROM Matches m
             JOIN FootballClubs hc ON m.HomeClubId = hc.Id
             JOIN FootballClubs ac ON m.AwayClubId = ac.Id
             WHERE m.Date < CURRENT_TIMESTAMP
             ORDER BY m.Date DESC
             LIMIT 20`
        );

        console.log(`✅ З БД отримано ${result.rows.length} результатів`);

        // Використовуємо ту саму функцію mapMatchData (яка вже є у вас в файлі)
        const matches = result.rows.map(mapMatchData);

        res.status(200).json({
            message: 'Результати успішно отримані',
            matches: matches,
            total: matches.length
        });

    } catch (err) {
        console.error('❌ Помилка при отриманні результатів:', err);
        res.status(500).json({
            error: 'Помилка при отриманні результатів',
            details: err.message
        });
    }
};