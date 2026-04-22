const db = require('../config/db');
const bcrypt = require('bcrypt');

exports.register = async (req, res) => {
    const { username, email, password } = req.body;

    const defaultRole = 'user';

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.query(
            'INSERT INTO Users (FullName, Email, Password, role) VALUES ($1, $2, $3, $4) RETURNING id, email, fullname, role',
            [username, email, hashedPassword, defaultRole]
        );

        res.status(201).json({
            message: 'Користувача зареєстровано!',
            userId: result.rows[0].id,
            email: result.rows[0].email,
            fullName: result.rows[0].fullname,
            role: result.rows[0].role
        });
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Користувач з таким Email вже існує' });
        }
        res.status(500).json({ error: 'Помилка бази даних: ' + err.message });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await db.query('SELECT * FROM Users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Невірна пошта або пароль' });
        }

        const user = result.rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Невірна пошта або пароль' });
        }

        res.status(200).json({
            message: 'Ви успішно увійшли!',
            userId: user.id,
            email: user.email,
            fullName: user.fullname,
            role: user.role
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Помилка бази даних: ' + err.message });
    }
};