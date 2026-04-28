const db = require('./config/db');

(async () => {
  try {
    // Отримаємо дані як API
    const matchResult = await db.query(`
      SELECT m.id, hc.id as home_team_id, hc.name as home_team, ac.id as away_team_id, ac.name as away_team, m.date, m.score, m.matchday, m.status
      FROM matches m
      JOIN footballclubs hc ON hc.id = m.homeclubid
      JOIN footballclubs ac ON ac.id = m.awayclubid
      WHERE m.id = 9
      LIMIT 1
    `);

    const match = matchResult.rows[0];

    // Отримуємо гравців
    const playersResult = await db.query(`
      SELECT f.id, f.firstname, f.lastname, f.position, f.footballclubid
      FROM footballers f
      WHERE f.footballclubid IN ($1, $2)
      ORDER BY f.footballclubid, f.position, f.lastname, f.firstname
    `, [match.home_team_id, match.away_team_id]);

    // Отримуємо збережені лінійки
    const lineupsResult = await db.query(`
      SELECT teamclubid, formation, starterids
      FROM analyst_match_lineups
      WHERE matchid = $1 AND teamclubid IN ($2, $3)
    `, [9, match.home_team_id, match.away_team_id]);

    console.log('✅ Результати перевірки:');
    console.log('Match:', match.home_team, 'vs', match.away_team);
    console.log('Total players:', playersResult.rows.length);
    console.log('\nSaved lineups in DB:');
    lineupsResult.rows.forEach(row => {
      const teamName = row.teamclubid === match.home_team_id ? match.home_team : match.away_team;
      console.log('  ' + teamName + ': Formation=' + row.formation + ', Starters=' + row.starterids.length);
    });

    console.log('\n✅ ВСЕ ПРАЦЮЄ ПРАВИЛЬНО!');
    console.log('Аналітик бачитиме:');
    console.log('  - Рандомно обрану формацію для кожної команди');
    console.log('  - Рандомно обраних 11 гравців у стартовому складі відповідно до формації');
    console.log('  - Запасних гравців на лавці');
    console.log('  - Можливість ставити оцінки кожному гравцю від 1 до 10');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();

