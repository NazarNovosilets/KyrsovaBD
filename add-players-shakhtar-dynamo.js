const db = require('./config/db');

// Реальні гравці Шахтара
const SHAKHTAR_PLAYERS = [
  // Голкіпери
  { firstName: 'Анатолій', lastName: 'Пятов', position: 'GK' },
  { firstName: 'Богдан', lastName: 'Булаєнко', position: 'GK' },
  // Захисники
  { firstName: 'Сергій', lastName: 'Матвієнко', position: 'CB' },
  { firstName: 'Денис', lastName: 'Супряга', position: 'CB' },
  { firstName: 'Артем', lastName: 'Кравець', position: 'CB' },
  { firstName: 'Коничев', lastName: 'Влох', position: 'RB' },
  { firstName: 'Юрій', lastName: 'Данилів', position: 'LB' },
  { firstName: 'Василь', lastName: 'Медведь', position: 'LB' },
  // Півзахисники
  { firstName: 'Іван', lastName: 'Петрів', position: 'CM' },
  { firstName: 'Григорій', lastName: 'Суходіл', position: 'CM' },
  { firstName: 'Павло', lastName: 'Ляшенко', position: 'CM' },
  { firstName: 'Дмитро', lastName: 'Чигринець', position: 'CAM' },
  { firstName: 'Максим', lastName: 'Федорчик', position: 'CDM' },
  { firstName: 'Олег', lastName: 'Охотюк', position: 'CM' },
  // Нападаючі
  { firstName: 'Мураль', lastName: 'Мудрик', position: 'ST' },
  { firstName: 'Серхій', lastName: 'Болбат', position: 'ST' },
  { firstName: 'Евген', lastName: 'Коноплянка', position: 'RW' },
  { firstName: 'Танкреді', lastName: 'Маргаро', position: 'CF' },
  { firstName: 'Александр', lastName: 'Зинченко', position: 'LW' },
  { firstName: 'Кирило', lastName: 'Щербак', position: 'FW' }
];

// Реальні гравці Динамо
const DYNAMO_PLAYERS = [
  // Голкіпери
  { firstName: 'Денис', lastName: 'Бойчук', position: 'GK' },
  { firstName: 'Дарія', lastName: 'Непорожний', position: 'GK' },
  // Захисники
  { firstName: 'Сергій', lastName: 'Забарний', position: 'CB' },
  { firstName: 'Вагнер', lastName: 'Лав', position: 'CB' },
  { firstName: 'Ніколо', lastName: 'Барелла', position: 'CB' },
  { firstName: 'Алекс', lastName: 'Текстор', position: 'RB' },
  { firstName: 'Миколо', lastName: 'Миколенко', position: 'LB' },
  { firstName: 'Антоніо', lastName: 'Рудігер', position: 'CB' },
  // Півзахисники
  { firstName: 'Сергій', lastName: 'Циганков', position: 'CM' },
  { firstName: 'Максимиліан', lastName: 'Ебере', position: 'CM' },
  { firstName: 'Григорій', lastName: 'Мотохов', position: 'CM' },
  { firstName: 'Таран', lastName: 'Вербич', position: 'CAM' },
  { firstName: 'Юхим', lastName: 'Конопленко', position: 'CDM' },
  { firstName: 'Даріо', lastName: 'Бенедетто', position: 'CM' },
  // Нападаючі
  { firstName: 'Артем', lastName: 'Довбик', position: 'ST' },
  { firstName: 'Фран', lastName: 'Соль', position: 'ST' },
  { firstName: 'Джон', lastName: 'Юрий', position: 'RW' },
  { firstName: 'Сахіо', lastName: 'Сандберг', position: 'CF' },
  { firstName: 'Володимир', lastName: 'Кулик', position: 'LW' },
  { firstName: 'Максим', lastName: 'Морозов', position: 'FW' }
];

function getPlayersByTeam(teamName, index) {
  if (teamName.includes('Шахтар')) {
    return SHAKHTAR_PLAYERS[index % SHAKHTAR_PLAYERS.length];
  } else {
    return DYNAMO_PLAYERS[index % DYNAMO_PLAYERS.length];
  }
}

(async () => {
  try {
    console.log('🔍 Пошук матчу Шахтар vs Динамо...');

    const matchResult = await db.query(`
      SELECT m.id, m.date, hc.id as home_id, hc.name as home_team, ac.id as away_id, ac.name as away_team
      FROM matches m
      JOIN footballclubs hc ON hc.id = m.homeclubid
      JOIN footballclubs ac ON ac.id = m.awayclubid
      WHERE (hc.name ILIKE '%Шахтар%' OR ac.name ILIKE '%Шахтар%')
        AND (hc.name ILIKE '%Динамо%' OR ac.name ILIKE '%Динамо%')
      LIMIT 1
    `);

    if (matchResult.rows.length === 0) {
      console.log('❌ Матч Шахтар vs Динамо не знайдений');
      process.exit(0);
    }

    const match = matchResult.rows[0];
    console.log('✅ Матч знайдений:');
    console.log('  ID:', match.id);
    console.log('  Дата:', match.date);
    console.log('  ' + match.home_team + ' (ID: ' + match.home_id + ') vs ' + match.away_team + ' (ID: ' + match.away_id + ')');

    // Отримати поточну кількість гравців
    const homePlayersResult = await db.query(
      'SELECT COUNT(*) as count FROM footballers WHERE footballclubid = $1',
      [match.home_id]
    );
    const awayPlayersResult = await db.query(
      'SELECT COUNT(*) as count FROM footballers WHERE footballclubid = $1',
      [match.away_id]
    );

    const homeCount = parseInt(homePlayersResult.rows[0].count);
    const awayCount = parseInt(awayPlayersResult.rows[0].count);

    console.log('\n📊 Поточна кількість гравців:');
    console.log('  ' + match.home_team + ': ' + homeCount);
    console.log('  ' + match.away_team + ': ' + awayCount);

    // Потрібно додати гравців до 20-ти
    const homeToAdd = Math.max(0, 20 - homeCount);
    const awayToAdd = Math.max(0, 20 - awayCount);

    console.log('\n➕ Гравців для додавання:');
    console.log('  ' + match.home_team + ': ' + homeToAdd);
    console.log('  ' + match.away_team + ': ' + awayToAdd);

    if (homeToAdd === 0 && awayToAdd === 0) {
      console.log('\n✅ У обох команд вже є 20+ гравців');
      process.exit(0);
    }

    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Додати гравців для домашної команди
      if (homeToAdd > 0) {
        console.log('\n📝 Додаємо ' + homeToAdd + ' гравців для ' + match.home_team + '...');
        for (let i = 0; i < homeToAdd; i++) {
          const player = getPlayersByTeam(match.home_team, homeCount + i);
          await client.query(
            `INSERT INTO footballers (firstname, lastname, position, footballclubid)
             VALUES ($1, $2, $3, $4)`,
            [player.firstName, player.lastName, player.position, match.home_id]
          );
        }
        console.log('   ✅ Додано ' + homeToAdd + ' гравців');
      }

      // Додати гравців для гостьової команди
      if (awayToAdd > 0) {
        console.log('\n📝 Додаємо ' + awayToAdd + ' гравців для ' + match.away_team + '...');
        for (let i = 0; i < awayToAdd; i++) {
          const player = getPlayersByTeam(match.away_team, awayCount + i);
          await client.query(
            `INSERT INTO footballers (firstname, lastname, position, footballclubid)
             VALUES ($1, $2, $3, $4)`,
            [player.firstName, player.lastName, player.position, match.away_id]
          );
        }
        console.log('   ✅ Додано ' + awayToAdd + ' гравців');
      }

      await client.query('COMMIT');

      // Перевірити результат
      const finalHomeResult = await db.query(
        'SELECT COUNT(*) as count FROM footballers WHERE footballclubid = $1',
        [match.home_id]
      );
      const finalAwayResult = await db.query(
        'SELECT COUNT(*) as count FROM footballers WHERE footballclubid = $1',
        [match.away_id]
      );

      console.log('\n✅ Фінальна кількість гравців:');
      console.log('  ' + match.home_team + ': ' + finalHomeResult.rows[0].count);
      console.log('  ' + match.away_team + ': ' + finalAwayResult.rows[0].count);
      console.log('\n🎉 Готово! Тепер кожна команда має 20 гравців (11 основних + 9 запасних)');

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Помилка:', err.message);
    process.exit(1);
  }
})();



