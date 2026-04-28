require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const db = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// 1. API маршрути (МАЮТЬ ЙТИ ПЕРШИМИ!)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.get('/api', (req, res) => {
    res.json({ message: 'API працює 🚀' });
});

app.get('/api/test-db', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW()');
        res.json({ message: "Зв'язок з БД є!", time: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. WebSocket сервер
wss.on('connection', (ws) => {
    console.log('✅ WebSocket клієнт підключився');

    ws.on('message', (message) => {
        console.log('📨 Повідомлення від клієнта:', message);
        // Можна відправити повідомлення назад
        ws.send(JSON.stringify({ type: 'ack', message: 'Повідомлення отримано' }));
    });

    ws.on('close', () => {
        console.log('❌ WebSocket клієнт відключився');
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket помилка:', error);
    });
});

// 3. Статичні файли (картинки, стилі) - ПІСЛЯ API маршрутів!
app.use(express.static(path.join(__dirname, 'client/build')));

// 4. Catch-all для React маршрутів (regex для Express 5.x)
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server запущено на порту ${PORT}`);
    console.log(`📡 WebSocket готовий на ws://localhost:${PORT}`);
});