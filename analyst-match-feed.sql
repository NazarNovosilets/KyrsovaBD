-- =========================================================
-- Analyst match feed support
-- Run this in PostgreSQL for the analyst dashboard.
-- =========================================================

ALTER TABLE matches
ADD COLUMN IF NOT EXISTS status VARCHAR(20);

CREATE TABLE IF NOT EXISTS analyst_match_lineups (
    matchid INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    teamclubid INT NOT NULL REFERENCES footballclubs(id) ON DELETE CASCADE,
    formation VARCHAR(10) NOT NULL,
    starterids INT[] NOT NULL DEFAULT '{}',
    createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (matchid, teamclubid)
);

-- Trigger: keeps match status aligned with the scheduled date unless
-- the row is explicitly marked as live, postponed or cancelled.
CREATE OR REPLACE FUNCTION sync_match_status_for_analyst()
RETURNS TRIGGER AS $$
BEGIN
    IF LOWER(COALESCE(NEW.status, '')) IN ('live', 'postponed', 'cancelled') THEN
        RETURN NEW;
    END IF;

    IF NEW.date > CURRENT_TIMESTAMP THEN
        NEW.status := 'upcoming';
    ELSE
        NEW.status := 'finished';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_match_status_for_analyst ON matches;

CREATE TRIGGER trg_sync_match_status_for_analyst
BEFORE INSERT OR UPDATE OF date, status ON matches
FOR EACH ROW
EXECUTE FUNCTION sync_match_status_for_analyst();

-- Procedure-like function: returns one normalized feed for the analyst UI.
CREATE OR REPLACE FUNCTION get_match_phase(p_match_date TIMESTAMP, p_status VARCHAR DEFAULT NULL)
RETURNS VARCHAR AS $$
BEGIN
    IF LOWER(COALESCE(p_status, '')) IN ('cancelled', 'postponed') THEN
        RETURN LOWER(p_status);
    END IF;

    IF p_match_date > CURRENT_TIMESTAMP THEN
        RETURN 'upcoming';
    ELSIF p_match_date + INTERVAL '45 minutes' > CURRENT_TIMESTAMP THEN
        RETURN 'first_half';
    ELSIF p_match_date + INTERVAL '60 minutes' > CURRENT_TIMESTAMP THEN
        RETURN 'halftime';
    ELSIF p_match_date + INTERVAL '105 minutes' > CURRENT_TIMESTAMP THEN
        RETURN 'second_half';
    END IF;

    RETURN 'finished';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_analyst_match_feed()
RETURNS TABLE (
    id INT,
    home_team VARCHAR,
    away_team VARCHAR,
    match_date TIMESTAMP,
    score VARCHAR,
    gameweek INT,
    match_state VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        hc.name AS home_team,
        ac.name AS away_team,
        m.date AS match_date,
        m.score,
        m.matchday AS gameweek,
        CASE
            WHEN get_match_phase(m.date, m.status) IN ('first_half', 'halftime', 'second_half') THEN 'live'
            WHEN get_match_phase(m.date, m.status) = 'upcoming' THEN 'upcoming'
            ELSE 'completed'
        END AS match_state
    FROM matches m
    JOIN footballclubs hc ON hc.id = m.homeclubid
    JOIN footballclubs ac ON ac.id = m.awayclubid
    ORDER BY m.date ASC, m.id ASC;
END;
$$ LANGUAGE plpgsql;

-- Inserts or updates a demo match scheduled for April 28, 2026 at 17:20.
CREATE OR REPLACE FUNCTION upsert_demo_live_match()
RETURNS VOID AS $$
DECLARE
    v_home_club_id INT;
    v_away_club_id INT;
BEGIN
    SELECT id INTO v_home_club_id FROM footballclubs WHERE name = 'Шахтар' LIMIT 1;
    SELECT id INTO v_away_club_id FROM footballclubs WHERE name = 'Динамо' LIMIT 1;

    IF v_home_club_id IS NULL OR v_away_club_id IS NULL THEN
        RAISE EXCEPTION 'Demo live match cannot be inserted because Шахтар or Динамо is missing.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM matches
        WHERE homeclubid = v_home_club_id
          AND awayclubid = v_away_club_id
          AND date = TIMESTAMP '2026-04-28 17:20:00'
    ) THEN
        UPDATE matches
        SET score = COALESCE(score, '0:0'),
            matchday = COALESCE(matchday, 26),
            status = 'upcoming'
        WHERE homeclubid = v_home_club_id
          AND awayclubid = v_away_club_id
          AND date = TIMESTAMP '2026-04-28 17:20:00';
    ELSE
        INSERT INTO matches (homeclubid, awayclubid, date, score, matchday, status)
        VALUES (v_home_club_id, v_away_club_id, TIMESTAMP '2026-04-28 17:20:00', '0:0', 26, 'upcoming');
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- Optional seed: additional real players for random lineups
-- Run this block to ensure each club has 11+ options.
-- =========================================================

WITH target_clubs AS (
    SELECT id, name
    FROM footballclubs
    WHERE LOWER(name) LIKE '%dynamo%' OR LOWER(name) LIKE '%динамо%'
), seed_players(firstname, lastname, position, marketvalue) AS (
    VALUES
      ('Georgiy', 'Buschan', 'GK', 6.5),
      ('Denys', 'Boyko', 'GK', 4.8),
      ('Oleksandr', 'Karavaev', 'DEF', 5.5),
      ('Denys', 'Popov', 'DEF', 6.0),
      ('Taras', 'Mykhavko', 'DEF', 5.6),
      ('Vladyslav', 'Dubinchak', 'DEF', 5.4),
      ('Mykola', 'Shaparenko', 'MID', 7.2),
      ('Volodymyr', 'Brazhko', 'MID', 6.8),
      ('Vitalii', 'Buyalskyi', 'MID', 6.6),
      ('Nazar', 'Voloshyn', 'MID', 5.9),
      ('Andrii', 'Yarmolenko', 'FWD', 7.0),
      ('Vladyslav', 'Vanat', 'FWD', 6.9),
      ('Benito', '', 'FWD', 5.7),
      ('Eduardo', 'Guerrero', 'FWD', 6.4)
)
INSERT INTO footballers (firstname, lastname, position, footballclubid, marketvalue)
SELECT sp.firstname, sp.lastname, sp.position, tc.id, sp.marketvalue
FROM target_clubs tc
CROSS JOIN seed_players sp
WHERE NOT EXISTS (
    SELECT 1
    FROM footballers f
    WHERE f.footballclubid = tc.id
      AND LOWER(COALESCE(f.firstname, '')) = LOWER(sp.firstname)
      AND LOWER(COALESCE(f.lastname, '')) = LOWER(sp.lastname)
);

-- =========================================================
-- Auto top-up for all clubs that appear in matches:
-- Guarantees minimum squad depth by position so random
-- starting XI can be formed reliably for each side.
-- =========================================================
DO $$
DECLARE
    v_club RECORD;
    v_pos RECORD;
    v_existing_count INT;
    v_missing INT;
    v_idx INT;
BEGIN
    FOR v_club IN
        SELECT DISTINCT c.id, c.name
        FROM footballclubs c
        JOIN (
            SELECT homeclubid AS clubid FROM matches
            UNION
            SELECT awayclubid AS clubid FROM matches
        ) mclubs ON mclubs.clubid = c.id
    LOOP
        FOR v_pos IN
            SELECT *
            FROM (VALUES
                ('GK', 2, 4.6::NUMERIC),
                ('DEF', 6, 5.3::NUMERIC),
                ('MID', 6, 6.0::NUMERIC),
                ('FWD', 4, 6.4::NUMERIC)
            ) AS p(position_code, min_required, base_value)
        LOOP
            SELECT COUNT(*)
            INTO v_existing_count
            FROM footballers f
            WHERE f.footballclubid = v_club.id
              AND UPPER(COALESCE(f.position, '')) = v_pos.position_code;

            v_missing := GREATEST(v_pos.min_required - COALESCE(v_existing_count, 0), 0);

            IF v_missing > 0 THEN
                FOR v_idx IN 1..v_missing LOOP
                    INSERT INTO footballers (firstname, lastname, position, footballclubid, marketvalue)
                    VALUES (
                        'Auto',
                        CONCAT(v_pos.position_code, '-', v_club.id, '-', v_idx),
                        v_pos.position_code,
                        v_club.id,
                        v_pos.base_value + (RANDOM() * 1.8)::NUMERIC(10,2)
                    );
                END LOOP;
            END IF;
        END LOOP;
    END LOOP;
END $$;

WITH target_clubs AS (
    SELECT id, name
    FROM footballclubs
    WHERE LOWER(name) LIKE '%shakhtar%' OR LOWER(name) LIKE '%шахтар%'
), seed_players(firstname, lastname, position, marketvalue) AS (
    VALUES
      ('Dmytro', 'Riznyk', 'GK', 6.3),
      ('Kiril', 'Fesyun', 'GK', 4.3),
      ('Yukhym', 'Konoplia', 'DEF', 5.9),
      ('Mykola', 'Matviyenko', 'DEF', 7.1),
      ('Valeriy', 'Bondar', 'DEF', 6.2),
      ('Giorgi', 'Gocholeishvili', 'DEF', 5.4),
      ('Taras', 'Stepanenko', 'MID', 6.5),
      ('Artem', 'Bondarenko', 'MID', 6.7),
      ('Heorhii', 'Sudakov', 'MID', 8.2),
      ('Newerton', '', 'MID', 5.8),
      ('Kevin', '', 'FWD', 6.6),
      ('Lassina', 'Traore', 'FWD', 7.0),
      ('Danylo', 'Sikan', 'FWD', 6.3),
      ('Eguinaldo', '', 'FWD', 5.9)
)
INSERT INTO footballers (firstname, lastname, position, footballclubid, marketvalue)
SELECT sp.firstname, sp.lastname, sp.position, tc.id, sp.marketvalue
FROM target_clubs tc
CROSS JOIN seed_players sp
WHERE NOT EXISTS (
    SELECT 1
    FROM footballers f
    WHERE f.footballclubid = tc.id
      AND LOWER(COALESCE(f.firstname, '')) = LOWER(sp.firstname)
      AND LOWER(COALESCE(f.lastname, '')) = LOWER(sp.lastname)
);
