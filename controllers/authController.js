const db = require('../config/db');
const bcrypt = require('bcrypt');

const db = require('../config/db');
const bcrypt = require('bcrypt');

exports.register = async (req, res) => {
    const { username, email, password } = req.body;

    // За замовчуванням реєструємо як 'user'.
    // Якщо треба створити адміна, ти можеш змінити це значення вручну в БД.
    const defaultRole = 'user';

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.query(
            'INSERT INTO Users (FullName, Email, Password, Role) VALUES ($1, $2, $3, $4) RETURNING Id, Role',
            [username, email, hashedPassword, defaultRole]
        );

        res.status(201).json({
            message: 'Користувача зареєстровано!',
            userId: result.rows[0].id,
            role: result.rows[0].role
        });
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Користувач з таким Email вже існує' });
        }
        res.status(500).json({ error: 'Помилка бази даних' });
    }
};
// Додай bcrypt, якщо він ще не імпортований зверху
// const bcrypt = require('bcrypt');

const db = require('../config/db');
const bcrypt = require('bcrypt');

exports.register = async (req, res) => {
    const { username, email, password } = req.body;

    // За замовчуванням реєструємо як 'user'.
    // Якщо треба створити адміна, ти можеш змінити це значення вручну в БД.
    const defaultRole = 'user';

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.query(
            'INSERT INTO Users (FullName, Email, Password, Role) VALUES ($1, $2, $3, $4) RETURNING Id, Role',
            [username, email, hashedPassword, defaultRole]
        );

        res.status(201).json({
            message: 'Користувача зареєстровано!',
            userId: result.rows[0].id,
            role: result.rows[0].role
        });
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Користувач з таким Email вже існує' });
        }
        res.status(500).json({ error: 'Помилка бази даних' });
    }
};