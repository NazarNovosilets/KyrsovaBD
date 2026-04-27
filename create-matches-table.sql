-- =====================================
-- 🎯 MATCHES TABLE
-- =====================================

-- Перевіримо чи існує таблиця
DROP TABLE IF EXISTS matches CASCADE;

-- Створюємо таблицю матчів
CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    homeTeamId INT,
    awayTeamId INT,
    homeTeam VARCHAR(100) NOT NULL,
    awayTeam VARCHAR(100) NOT NULL,
    homeCode VARCHAR(10) NOT NULL,
    awayCode VARCHAR(10) NOT NULL,
    matchDate DATE NOT NULL,
    matchTime TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'upcoming', -- upcoming, completed, cancelled
    gameweek INT,
    homeLayout VARCHAR(50), -- 3-4-3, 4-2-3-1, etc
    awayLayout VARCHAR(50),
    homeGoals INT DEFAULT 0,
    awayGoals INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Додаємо індекси
CREATE INDEX idx_matches_gameweek ON matches(gameweek);
CREATE INDEX idx_matches_date ON matches(matchDate);
CREATE INDEX idx_matches_status ON matches(status);

-- =====================================
-- 🎯 INSERT TEST DATA
-- =====================================

INSERT INTO matches (homeTeam, awayTeam, homeCode, awayCode, matchDate, matchTime, status, gameweek, homeLayout, awayLayout)
VALUES
    ('Shakhtar Donetsk', 'Dnipro-1', 'SHA', 'DNP', '2026-04-05', '15:00', 'upcoming', 25, '3-4-3', '4-2-3-1'),
    ('Zorya Luhansk', 'Dynamo Kyiv', 'ZOR', 'DYN', '2026-04-05', '17:30', 'upcoming', 25, '4-2-3-1', '3-5-2'),
    ('Oleksandriya', 'Shakhtar Donetsk', 'OLE', 'SHA', '2026-04-06', '14:00', 'upcoming', 25, '4-3-3', '3-4-3'),
    ('Kolos Kovalivka', 'Vorskla Poltava', 'KOL', 'VOR', '2026-04-06', '16:30', 'upcoming', 25, '4-2-3-1', '4-2-3-1'),
    ('Chornomorets', 'Metalurh', 'CHO', 'MET', '2026-04-07', '19:00', 'upcoming', 25, '5-3-2', '4-4-2'),
    ('Veres', 'Polissya', 'VER', 'POL', '2026-04-07', '18:00', 'upcoming', 25, '4-3-3', '4-3-3'),
    ('Mynai', 'Arsenal Kyiv', 'MYN', 'ARK', '2026-04-08', '14:00', 'upcoming', 25, '3-5-2', '4-2-3-1'),
    ('FC Lviv', 'Rukh Lviv', 'LVV', 'RUK', '2026-04-08', '17:00', 'upcoming', 25, '4-4-2', '4-3-3');

-- Перевіримо
SELECT * FROM matches ORDER BY matchDate, matchTime;

