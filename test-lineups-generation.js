const db = require('./config/db');

// Скопійовані функції з analyticsController.js
const RANDOM_FORMATIONS = [
    { label: '4-3-3', DEF: 4, MID: 3, FWD: 3 },
    { label: '4-4-2', DEF: 4, MID: 4, FWD: 2 },
    { label: '3-5-2', DEF: 3, MID: 5, FWD: 2 },
    { label: '5-3-2', DEF: 5, MID: 3, FWD: 2 },
    { label: '3-4-3', DEF: 3, MID: 4, FWD: 3 }
];

function shuffle(items) {
    const array = [...items];
    for (let i = array.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function normalizePosition(position = '') {
    const value = String(position).trim().toUpperCase();
    if (['GK', 'GOALKEEPER', 'ВРТ', 'ВОРОТАР'].includes(value)) return 'GK';
    if (['DEF', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'ЗАХ', 'ЗАХИСНИК'].includes(value)) return 'DEF';
    if (['MID', 'CM', 'CDM', 'CAM', 'RM', 'LM', 'ПЗ', 'ПІВЗАХИСНИК'].includes(value)) return 'MID';
    if (['FWD', 'FW', 'ST', 'CF', 'STR', 'НАП', 'НАПАДНИК'].includes(value)) return 'FWD';
    if (value.includes('GK') || value.includes('GOAL')) return 'GK';
    if (value.includes('DEF') || value.includes('BACK')) return 'DEF';
    if (value.includes('MID')) return 'MID';
    if (value.includes('FWD') || value.includes('STR') || value.includes('FORWARD')) return 'FWD';
    return 'MID';
}

function pickPlayers(pool, amount) {
    const shuffled = shuffle(pool);
    return shuffled.slice(0, amount);
}

function splitByPosition(players) {
    const grouped = { GK: [], DEF: [], MID: [], FWD: [] };
    players.forEach((player) => {
        const normalized = normalizePosition(player.position);
        grouped[normalized].push(player);
    });
    return grouped;
}

function buildRandomLineup(players) {
    const enriched = players.map((player) => ({
        ...player,
        normalizedPosition: normalizePosition(player.position)
    }));

    const formation = RANDOM_FORMATIONS[Math.floor(Math.random() * RANDOM_FORMATIONS.length)];
    const grouped = {
        GK: enriched.filter((player) => player.normalizedPosition === 'GK'),
        DEF: enriched.filter((player) => player.normalizedPosition === 'DEF'),
        MID: enriched.filter((player) => player.normalizedPosition === 'MID'),
        FWD: enriched.filter((player) => player.normalizedPosition === 'FWD')
    };

    const starters = {
        GK: pickPlayers(grouped.GK, 1),
        DEF: pickPlayers(grouped.DEF, formation.DEF),
        MID: pickPlayers(grouped.MID, formation.MID),
        FWD: pickPlayers(grouped.FWD, formation.FWD)
    };

    const starterIds = new Set([
        ...starters.GK.map((player) => player.id),
        ...starters.DEF.map((player) => player.id),
        ...starters.MID.map((player) => player.id),
        ...starters.FWD.map((player) => player.id)
    ]);

    const fallbackPool = shuffle(enriched.filter((player) => !starterIds.has(player.id)));
    const desiredStarterCount = Math.min(11, enriched.length);

    while (starterIds.size < desiredStarterCount && fallbackPool.length > 0) {
        const nextPlayer = fallbackPool.shift();
        const position = nextPlayer.normalizedPosition;
        starters[position].push(nextPlayer);
        starterIds.add(nextPlayer.id);
    }

    const bench = shuffle(enriched.filter((player) => !starterIds.has(player.id)));

    const stripMeta = (player) => ({
        id: player.id,
        name: player.name,
        position: player.position,
        footballClubId: player.footballClubId,
        rating: player.rating
    });

    return {
        formation: formation.label,
        starters: {
            GK: starters.GK.map(stripMeta),
            DEF: starters.DEF.map(stripMeta),
            MID: starters.MID.map(stripMeta),
            FWD: starters.FWD.map(stripMeta)
        },
        starterIds: Array.from(starterIds),
        bench: bench.map(stripMeta),
        startersCount: starterIds.size,
        totalPlayers: enriched.length
    };
}

async function ensureAnalystLineupsTable() {
    await db.query(
        `CREATE TABLE IF NOT EXISTS analyst_match_lineups (
            matchid INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
            teamclubid INTEGER NOT NULL REFERENCES footballclubs(id) ON DELETE CASCADE,
            formation VARCHAR(10) NOT NULL,
            starterids INTEGER[] NOT NULL DEFAULT '{}',
            createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (matchid, teamclubid)
        )`
    );
}

(async () => {
  try {
    console.log('🔍 Пошук матчу Шахтар vs Динамо...\n');

    const matchResult = await db.query(`
      SELECT m.id, hc.id as home_id, hc.name as home_team, ac.id as away_id, ac.name as away_team
      FROM matches m
      JOIN footballclubs hc ON hc.id = m.homeclubid
      JOIN footballclubs ac ON ac.id = m.awayclubid
      WHERE hc.name ILIKE '%Шахтар%' AND ac.name ILIKE '%Динамо%'
      LIMIT 1
    `);

    if (matchResult.rows.length === 0) {
      console.log('❌ Матч не знайдений');
      process.exit(1);
    }

    const match = matchResult.rows[0];
    console.log('✅ Матч знайдений:');
    console.log('   ID: ' + match.id);
    console.log('   ' + match.home_team + ' vs ' + match.away_team + '\n');

    // Отримати всіх гравців обох команд
    const playersResult = await db.query(`
      SELECT f.id, f.firstname, f.lastname, f.position, f.footballclubid
      FROM footballers f
      WHERE f.footballclubid IN ($1, $2)
      ORDER BY f.footballclubid, f.position
    `, [match.home_id, match.away_id]);

    const mapPlayer = (row) => ({
      id: row.id,
      name: (row.firstname + ' ' + row.lastname).trim(),
      position: row.position,
      footballClubId: row.footballclubid
    });

    const homePlayers = playersResult.rows.filter(p => p.footballclubid === match.home_id).map(mapPlayer);
    const awayPlayers = playersResult.rows.filter(p => p.footballclubid === match.away_id).map(mapPlayer);

    console.log('📊 Гравці:');
    console.log('   ' + match.home_team + ': ' + homePlayers.length);
    console.log('   ' + match.away_team + ': ' + awayPlayers.length + '\n');

    // Генерувати рандомні лінійки
    console.log('🎲 Генерування рандомних лінійок...\n');

    const homeLineup = buildRandomLineup(homePlayers);
    const awayLineup = buildRandomLineup(awayPlayers);

    console.log('📋 ' + match.home_team + ':');
    console.log('   Формація: ' + homeLineup.formation);
    console.log('   Основний склад (' + homeLineup.startersCount + '):');

    const showStarters = (lineup) => {
      console.log('     GK: ' + lineup.starters.GK.map(p => p.name).join(', '));
      console.log('     DEF (' + lineup.starters.DEF.length + '): ' + lineup.starters.DEF.map(p => p.name).join(', '));
      console.log('     MID (' + lineup.starters.MID.length + '): ' + lineup.starters.MID.map(p => p.name).join(', '));
      console.log('     FWD (' + lineup.starters.FWD.length + '): ' + lineup.starters.FWD.map(p => p.name).join(', '));
    };

    showStarters(homeLineup);
    console.log('   Запасні (' + homeLineup.bench.length + '): ' + homeLineup.bench.slice(0, 3).map(p => p.name).join(', ') + (homeLineup.bench.length > 3 ? '...' : ''));

    console.log('\n📋 ' + match.away_team + ':');
    console.log('   Формація: ' + awayLineup.formation);
    console.log('   Основний склад (' + awayLineup.startersCount + '):');

    showStarters(awayLineup);
    console.log('   Запасні (' + awayLineup.bench.length + '): ' + awayLineup.bench.slice(0, 3).map(p => p.name).join(', ') + (awayLineup.bench.length > 3 ? '...' : ''));

    // Зберегти лінійки в БД
    console.log('\n💾 Збереження лінійок в БД...\n');

    await ensureAnalystLineupsTable();

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO analyst_match_lineups (matchid, teamclubid, formation, starterids, createdat, updatedat)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (matchid, teamclubid)
         DO UPDATE SET
           formation = EXCLUDED.formation,
           starterids = EXCLUDED.starterids,
           updatedat = CURRENT_TIMESTAMP`,
        [match.id, match.home_id, homeLineup.formation, homeLineup.starterIds]
      );

      await client.query(
        `INSERT INTO analyst_match_lineups (matchid, teamclubid, formation, starterids, createdat, updatedat)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (matchid, teamclubid)
         DO UPDATE SET
           formation = EXCLUDED.formation,
           starterids = EXCLUDED.starterids,
           updatedat = CURRENT_TIMESTAMP`,
        [match.id, match.away_id, awayLineup.formation, awayLineup.starterIds]
      );

      await client.query('COMMIT');

      console.log('✅ Лінійки успішно збережені в БД!');
      console.log('\n🎉 Готово! Аналітик тепер може:');
      console.log('   1️⃣  Перейти на /analytics');
      console.log('   2️⃣  Клікнути на матч Шахтар vs Динамо');
      console.log('   3️⃣  Побачити випадково генеровані лінійки обох команд');
      console.log('   4️⃣  Ставити оцінки гравцям від 1 до 10');

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


