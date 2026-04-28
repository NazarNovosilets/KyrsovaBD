-- =========================================================
-- Analyst match feed support
-- Run this in PostgreSQL for the analyst dashboard.
-- =========================================================

ALTER TABLE matches
ADD COLUMN IF NOT EXISTS status VARCHAR(20);

ALTER TABLE matches
ADD COLUMN IF NOT EXISTS playerofthematchid INT REFERENCES footballers(id) ON DELETE SET NULL;

-- Ensure one statistics row per player per match for safe UPSERT.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_statistics_match_player'
    ) THEN
        ALTER TABLE statistics
        ADD CONSTRAINT uq_statistics_match_player UNIQUE (matchid, footballerid);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS analyst_match_lineups (
    matchid INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    teamclubid INT NOT NULL REFERENCES footballclubs(id) ON DELETE CASCADE,
    formation VARCHAR(10) NOT NULL,
    starterids INT[] NOT NULL DEFAULT '{}',
    createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (matchid, teamclubid)
);

CREATE TABLE IF NOT EXISTS match_live_events (
    id SERIAL PRIMARY KEY,
    matchid INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    minute INT NOT NULL DEFAULT 0,
    eventtype VARCHAR(30) NOT NULL,
    teamclubid INT REFERENCES footballclubs(id) ON DELETE SET NULL,
    payloadjson JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'auto_info',
    createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolvedat TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_match_live_events_matchid_createdat
    ON match_live_events (matchid, createdat DESC);

CREATE INDEX IF NOT EXISTS idx_match_live_events_matchid_status
    ON match_live_events (matchid, status);

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
    match_state VARCHAR,
    player_of_match VARCHAR
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
        END AS match_state,
        CASE
            WHEN pom.id IS NULL THEN NULL
            ELSE CONCAT(pom.firstname, ' ', pom.lastname)
        END AS player_of_match
    FROM matches m
    JOIN footballclubs hc ON hc.id = m.homeclubid
    JOIN footballclubs ac ON ac.id = m.awayclubid
    LEFT JOIN footballers pom ON pom.id = m.playerofthematchid
    ORDER BY m.date ASC, m.id ASC;
END;
$$ LANGUAGE plpgsql;

-- Rating formula used to determine Player of the Match from analyst stats.
CREATE OR REPLACE FUNCTION calculate_player_match_rating(
    p_position VARCHAR,
    p_goals INT,
    p_assists INT,
    p_minutes_played INT,
    p_clean_sheet BOOLEAN,
    p_yellow_cards INT
)
RETURNS NUMERIC AS $$
DECLARE
    v_rating NUMERIC := 0;
BEGIN
    v_rating :=
        (COALESCE(p_goals, 0) * 5)
        + (COALESCE(p_assists, 0) * 3)
        + LEAST(COALESCE(p_minutes_played, 0), 120) / 30.0
        - (COALESCE(p_yellow_cards, 0) * 1.5);

    IF COALESCE(p_clean_sheet, FALSE)
       AND UPPER(COALESCE(p_position, '')) IN ('GK', 'DEF') THEN
        v_rating := v_rating + 4;
    END IF;

    RETURN ROUND(v_rating, 2);
END;
$$ LANGUAGE plpgsql;

-- Recalculate and store best player for one match.
CREATE OR REPLACE FUNCTION refresh_player_of_match(p_match_id INT)
RETURNS VOID AS $$
DECLARE
    v_player_of_match_id INT;
BEGIN
    SELECT s.footballerid
    INTO v_player_of_match_id
    FROM statistics s
    JOIN footballers f ON f.id = s.footballerid
    WHERE s.matchid = p_match_id
    ORDER BY
        calculate_player_match_rating(
            f.position,
            s.goals,
            s.assists,
            s.minutesplayed,
            s.cleansheet,
            s.yellowcards
        ) DESC,
        COALESCE(s.goals, 0) DESC,
        COALESCE(s.assists, 0) DESC,
        COALESCE(s.minutesplayed, 0) DESC,
        s.footballerid ASC
    LIMIT 1;

    UPDATE matches
    SET playerofthematchid = v_player_of_match_id
    WHERE id = p_match_id;
END;
$$ LANGUAGE plpgsql;

-- Main analyst action: upsert one player's match statistics and recalc POTM.
CREATE OR REPLACE FUNCTION upsert_analyst_player_stat(
    p_match_id INT,
    p_footballer_id INT,
    p_goals INT DEFAULT 0,
    p_assists INT DEFAULT 0,
    p_minutes_played INT DEFAULT 0,
    p_clean_sheet BOOLEAN DEFAULT FALSE,
    p_yellow_cards INT DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM matches m
        JOIN footballers hf ON hf.footballclubid = m.homeclubid
        WHERE m.id = p_match_id AND hf.id = p_footballer_id
        UNION
        SELECT 1
        FROM matches m
        JOIN footballers af ON af.footballclubid = m.awayclubid
        WHERE m.id = p_match_id AND af.id = p_footballer_id
    ) THEN
        RAISE EXCEPTION 'Footballer % is not in clubs of match %', p_footballer_id, p_match_id;
    END IF;

    INSERT INTO statistics (
        footballerid,
        matchid,
        goals,
        assists,
        minutesplayed,
        cleansheet,
        yellowcards
    )
    VALUES (
        p_footballer_id,
        p_match_id,
        GREATEST(COALESCE(p_goals, 0), 0),
        GREATEST(COALESCE(p_assists, 0), 0),
        GREATEST(COALESCE(p_minutes_played, 0), 0),
        COALESCE(p_clean_sheet, FALSE),
        GREATEST(COALESCE(p_yellow_cards, 0), 0)
    )
    ON CONFLICT (matchid, footballerid) DO UPDATE
    SET goals = EXCLUDED.goals,
        assists = EXCLUDED.assists,
        minutesplayed = EXCLUDED.minutesplayed,
        cleansheet = EXCLUDED.cleansheet,
        yellowcards = EXCLUDED.yellowcards;

    PERFORM refresh_player_of_match(p_match_id);
END;
$$ LANGUAGE plpgsql;

-- Inserts or updates a demo live match for Карпати vs Рух.
CREATE OR REPLACE FUNCTION upsert_demo_live_match()
RETURNS VOID AS $$
DECLARE
    v_home_club_id INT;
    v_away_club_id INT;
BEGIN
    SELECT id INTO v_home_club_id FROM footballclubs WHERE name = 'Карпати' LIMIT 1;
    SELECT id INTO v_away_club_id FROM footballclubs WHERE name = 'Рух' LIMIT 1;

    IF v_home_club_id IS NULL OR v_away_club_id IS NULL THEN
        RAISE EXCEPTION 'Demo live match cannot be inserted because Карпати or Рух is missing.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM matches
        WHERE homeclubid = v_home_club_id
          AND awayclubid = v_away_club_id
          AND date = TIMESTAMP '2026-04-28 20:10:00'
    ) THEN
        UPDATE matches
        SET score = COALESCE(score, '0:0'),
            matchday = COALESCE(matchday, 26),
            status = 'live'
        WHERE homeclubid = v_home_club_id
          AND awayclubid = v_away_club_id
          AND date = TIMESTAMP '2026-04-28 20:10:00';
    ELSE
        INSERT INTO matches (homeclubid, awayclubid, date, score, matchday, status)
        VALUES (v_home_club_id, v_away_club_id, TIMESTAMP '2026-04-28 20:10:00', '0:0', 26, 'live');
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

WITH target_clubs AS (
    SELECT id, name
    FROM footballclubs
    WHERE LOWER(name) LIKE '%karpaty%' OR LOWER(name) LIKE '%карпати%'
), seed_players(firstname, lastname, position, marketvalue) AS (
    VALUES
      ('Oleksandr', 'Kemper', 'GK', 4.5),
      ('Yevhen', 'Kucherenko', 'GK', 4.4),
      ('Vladyslav', 'Babohlo', 'DEF', 4.8),
      ('Andrii', 'Nesterov', 'DEF', 4.6),
      ('Denys', 'Miroshnichenko', 'DEF', 4.7),
      ('Oleh', 'Ocheretko', 'MID', 5.1),
      ('Pablo', 'Alvarez', 'MID', 4.9),
      ('Amaral', 'Bruninho', 'MID', 5.0),
      ('Ihor', 'Krasnopir', 'FWD', 4.8),
      ('Yaroslav', 'Karabin', 'FWD', 4.6),
      ('Stenio', 'Moiseyev', 'FWD', 4.5)
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

WITH target_clubs AS (
    SELECT id, name
    FROM footballclubs
    WHERE LOWER(name) LIKE '%rukh%' OR LOWER(name) LIKE '%рух%'
), seed_players(firstname, lastname, position, marketvalue) AS (
    VALUES
      ('Dmytro', 'Ledvii', 'GK', 4.7),
      ('Bohdan', 'Slyubyk', 'DEF', 4.8),
      ('Roman', 'Didyk', 'DEF', 5.0),
      ('Vitalii', 'Kholod', 'DEF', 4.7),
      ('Yurii', 'Klymchuk', 'FWD', 5.2),
      ('Oleksii', 'Sych', 'DEF', 4.9),
      ('Ilya', 'Kvasnytsia', 'MID', 5.0),
      ('Edson', '', 'MID', 4.9),
      ('Artur', 'Remeniak', 'MID', 4.8),
      ('Yevhen', 'Pidsadnyi', 'GK', 4.3),
      ('Andrii', 'Stolyarchuk', 'MID', 4.6)
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
