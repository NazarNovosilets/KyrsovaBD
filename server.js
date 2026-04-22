require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/db');
const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(cors());
app.use(express.json());


app.use('/api/auth', authRoutes);

// 1. Статичні файли (картинки, стилі)
app.use(express.static(path.join(__dirname, 'client/build')));
// 2. Маршрути API (завжди перед фронтендом!)
app.get('/api', (req, res) => {
    res.send('API працює 🚀');
});

app.get('/api/test-db', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW()');
        res.json({ message: "Зв'язок з БД є!", time: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Все інше віддаємо фронтенду (React/Angular)
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});