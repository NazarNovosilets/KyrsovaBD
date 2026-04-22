require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./config/db');
const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Налаштування сесії
app.use(session({
    secret: process.env.SESSION_SECRET || 'session-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // встановити true для HTTPS
}));

// Ініціалізація Passport
app.use(passport.initialize());
app.use(passport.session());

// Конфігурація Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

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