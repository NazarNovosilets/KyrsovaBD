const db = require('../config/db');
const bcrypt = require('bcrypt');

exports.register = async (req, res) => {
    const { username, email, password } = req.body;

    const defaultRole = 'user';

    try {
        console.log(`📝 Реєстрація: ${username} (${email})`);

        // 1️⃣ Хешування пароля
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log(`🔐 Пароль захешований`);

        // 2️⃣ Вставка користувача в БД
        const result = await db.query(
            'INSERT INTO users (fullname, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, email, fullname, role',
            [username, email, hashedPassword, defaultRole]
        );

        console.log(`✅ Користувач створено: ID ${result.rows[0].id}`);

        // 3️⃣ Формування відповіді
        res.status(201).json({
            message: 'Користувача зареєстровано!',
            userId: result.rows[0].id,
            email: result.rows[0].email,
            fullName: result.rows[0].fullname,
            role: result.rows[0].role
        });
    } catch (err) {
        console.error('❌ Помилка при реєстрації:', err);
        if (err.code === '23505') {
            console.log(`⚠️  Email ${email} вже існує`);
            return res.status(400).json({ error: 'Користувач з таким Email вже існує' });
        }
        res.status(500).json({ error: 'Помилка бази даних: ' + err.message });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        console.log(`🔐 Логіння: ${email}`);

        // 1️⃣ Пошук користувача в БД
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            console.log(`❌ Користувач з email ${email} не знайдений`);
            return res.status(401).json({ error: 'Невірна пошта або пароль' });
        }

        const user = result.rows[0];
        console.log(`✅ Користувач знайдений: ${user.fullname}`);

        // 2️⃣ Перевірка пароля
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            console.log(`❌ Невірний пароль для ${email}`);
            return res.status(401).json({ error: 'Невірна пошта або пароль' });
        }

        console.log(`✅ Пароль правильний, користувач увійшов`);

        // 3️⃣ Формування відповіді
        res.status(200).json({
            message: 'Ви успішно увійшли!',
            userId: user.id,
            email: user.email,
            fullName: user.fullname,
            role: user.role
        });
    } catch (err) {
        console.error('❌ Помилка при логіну:', err);
        res.status(500).json({ error: 'Помилка бази даних: ' + err.message });
    }
};

module.exports = { register: exports.register, login: exports.login };
