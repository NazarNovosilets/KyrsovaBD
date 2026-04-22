const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

console.log('🔍 Перевіряємо БД...');
console.log('Параметри:', {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
});

pool.query('SELECT * FROM information_schema.tables WHERE table_schema = \'public\' ORDER BY table_name', (err, res) => {
    if (err) {
        console.error('❌ Помилка:', err.message);
        process.exit(1);
    }

    console.log('\n✅ Успішне підключення до БД!');
    console.log('\n📋 Таблиці:');
    res.rows.forEach(row => console.log('  -', row.table_name));
    pool.end();
});

