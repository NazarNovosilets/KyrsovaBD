const db = require('./config/db');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function createAdmin() {
    try {
        console.log('🔐 Створення адміністратора...');

        // Дані адміністратора
        const adminData = {
            fullname: 'Admin',
            email: 'admin@gmail.com',
            password: 'admin123',
            role: 'admin'
        };

        // Хешування пароля
        const hashedPassword = await bcrypt.hash(adminData.password, 10);
        console.log('✅ Пароль захешований');

        // Вставка адміністратора в БД
        const result = await db.query(
            'INSERT INTO users (fullname, email, password, role, totalpoints) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, fullname, role',
            [adminData.fullname, adminData.email, hashedPassword, adminData.role, 0]
        );

        console.log('✅ Адміністратора успішно створено!');
        console.log('📊 Дані адміністратора:');
        console.log(`ID: ${result.rows[0].id}`);
        console.log(`Ім'я: ${result.rows[0].fullname}`);
        console.log(`Email: ${result.rows[0].email}`);
        console.log(`Role: ${result.rows[0].role}`);
        console.log('\n🔑 Для логіну використовуйте:');
        console.log(`Email: ${adminData.email}`);
        console.log(`Пароль: ${adminData.password}`);

        process.exit(0);
    } catch (err) {
        if (err.code === '23505') {
            console.error('❌ Користувач з таким email уже існує');
        } else {
            console.error('❌ Помилка при створенні адміністратора:', err.message);
        }
        process.exit(1);
    }
}

createAdmin();

