const db = require('../config/db');
const { getMatchLifecycle } = require('../utils/matchLifecycle');

const EVENT_TICK_MS = 12000;
const EVENT_CHANCE_PER_TICK = 0.38;
const EVENT_WEIGHTS = [
    { type: 'attack', weight: 34, status: 'auto_info' },
    { type: 'shot_off', weight: 20, status: 'auto_info' },
    { type: 'shot_on', weight: 10, status: 'auto_info' },
    { type: 'save', weight: 8, status: 'auto_info' },
    { type: 'yellow', weight: 6, status: 'auto_info' },
    { type: 'foul', weight: 20, status: 'auto_info' },
    { type: 'goal', weight: 2, status: 'pending' }
];
const POSITION_WEIGHTS = {
    FWD: 50,
    MID: 30,
    DEF: 17,
    GK: 3
};

let intervalRef = null;
let tickInProgress = false;

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chooseWeighted(items, getWeight) {
    const total = items.reduce((sum, item) => sum + Math.max(Number(getWeight(item)) || 0, 0), 0);
    if (total <= 0) return items[0];

    const pivot = Math.random() * total;
    let current = 0;
    for (const item of items) {
        current += Math.max(Number(getWeight(item)) || 0, 0);
        if (pivot <= current) return item;
    }
    return items[items.length - 1];
}

function normalizePosition(position = '') {
    const value = String(position || '').trim().toUpperCase();
    if (value.includes('GK')) return 'GK';
    if (value.includes('DEF') || ['CB', 'RB', 'LB', 'LWB', 'RWB'].includes(value)) return 'DEF';
    if (value.includes('MID') || ['CM', 'CDM', 'CAM', 'RM', 'LM'].includes(value)) return 'MID';
    if (value.includes('FWD') || value.includes('STR') || ['ST', 'CF', 'FW'].includes(value)) return 'FWD';
    return 'MID';
}

async function ensureLiveEventsTable(client = db) {
    await client.query(
        `CREATE TABLE IF NOT EXISTS match_live_events (
            id SERIAL PRIMARY KEY,
            matchid INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
            minute INT NOT NULL DEFAULT 0,
            eventtype VARCHAR(30) NOT NULL,
            teamclubid INT REFERENCES footballclubs(id) ON DELETE SET NULL,
            payloadjson JSONB NOT NULL DEFAULT '{}'::jsonb,
            status VARCHAR(20) NOT NULL DEFAULT 'auto_info',
            createdat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            resolvedat TIMESTAMP
        )`
    );
    await client.query(`CREATE INDEX IF NOT EXISTS idx_match_live_events_matchid_createdat ON match_live_events (matchid, createdat DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_match_live_events_matchid_status ON match_live_events (matchid, status)`);
}

function pickTeamForEvent(match) {
    const teams = [
        { teamClubId: Number(match.homeclubid), side: 'home', weight: 54 },
        { teamClubId: Number(match.awayclubid), side: 'away', weight: 46 }
    ];
    return chooseWeighted(teams, (item) => item.weight);
}

function pickTeamForGoal(match, minute) {
    const { homeGoals, awayGoals } = parseScore(match.score);
    const diff = homeGoals - awayGoals;
    const isLate = minute >= 70;

    // Bias to trailing side, especially in late game,
    // to increase realistic comebacks and occasional draws.
    let homeWeight = 50;
    let awayWeight = 50;
    if (diff > 0) {
        homeWeight = isLate ? 35 : 42;
        awayWeight = isLate ? 65 : 58;
    } else if (diff < 0) {
        homeWeight = isLate ? 65 : 58;
        awayWeight = isLate ? 35 : 42;
    }

    return chooseWeighted(
        [
            { teamClubId: Number(match.homeclubid), side: 'home', weight: homeWeight },
            { teamClubId: Number(match.awayclubid), side: 'away', weight: awayWeight }
        ],
        (item) => item.weight
    );
}

function parseScore(score = '0:0') {
    const [homeRaw, awayRaw] = String(score || '0:0').split(':');
    const homeGoals = Number.parseInt(homeRaw, 10);
    const awayGoals = Number.parseInt(awayRaw, 10);
    return {
        homeGoals: Number.isNaN(homeGoals) ? 0 : homeGoals,
        awayGoals: Number.isNaN(awayGoals) ? 0 : awayGoals
    };
}

function getMaxTotalGoalsByMinute(minute) {
    if (minute <= 25) return 2;
    if (minute <= 45) return 3;
    if (minute <= 70) return 4;
    return 6;
}

function buildMatchMinute(matchDate) {
    const elapsedMs = Date.now() - new Date(matchDate).getTime();
    if (elapsedMs <= 0) return 1;
    const minute = Math.floor(elapsedMs / 60000) + 1;
    return Math.min(Math.max(minute, 1), 120);
}

async function loadPlayersForMatch(matchId, teamClubId) {
    const result = await db.query(
        `SELECT id, firstname, lastname, position
         FROM footballers
         WHERE footballclubid = $1
         ORDER BY id ASC`,
        [teamClubId]
    );

    return result.rows.map((row) => ({
        id: Number(row.id),
        name: `${row.firstname || ''} ${row.lastname || ''}`.trim(),
        position: normalizePosition(row.position)
    }));
}

function pickScorer(players) {
    if (!players.length) return null;
    return chooseWeighted(players, (player) => POSITION_WEIGHTS[player.position] || 20);
}

function pickAssist(players, scorerId) {
    const candidates = players.filter((player) => player.id !== scorerId);
    if (!candidates.length) return null;
    if (Math.random() > 0.65) return null;
    return chooseWeighted(candidates, (player) => POSITION_WEIGHTS[player.position] || 20);
}

async function insertLiveEvent(match, eventType) {
    const minute = buildMatchMinute(match.date);
    const team = eventType.type === 'goal' ? pickTeamForGoal(match, minute) : pickTeamForEvent(match);
    let payload = {};
    let teamClubId = team.teamClubId;
    let status = eventType.status;

    if (eventType.type === 'goal') {
        const players = await loadPlayersForMatch(match.id, team.teamClubId);
        const scorer = pickScorer(players);
        const assist = scorer ? pickAssist(players, scorer.id) : null;

        payload = {
            side: team.side,
            suggestedScorerId: scorer?.id || null,
            suggestedScorerName: scorer?.name || null,
            suggestedAssistId: assist?.id || null,
            suggestedAssistName: assist?.name || null
        };
        status = 'pending';
        console.log(
            `⚽ Match ${match.id} ${minute}' GOAL candidate | team=${team.teamClubId} | scorer=${payload.suggestedScorerName || 'unknown'} | assist=${payload.suggestedAssistName || 'none'}`
        );
    } else if (eventType.type === 'yellow') {
        const players = await loadPlayersForMatch(match.id, team.teamClubId);
        const booked = pickScorer(players);
        payload = {
            side: team.side,
            playerId: booked?.id || null,
            playerName: booked?.name || null
        };
        console.log(
            `🟨 Match ${match.id} ${minute}' YELLOW | team=${team.teamClubId} | player=${payload.playerName || 'unknown'}`
        );
    } else {
        payload = { side: team.side };
    }

    await db.query(
        `INSERT INTO match_live_events (matchid, minute, eventtype, teamclubid, payloadjson, status)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
        [match.id, minute, eventType.type, teamClubId, JSON.stringify(payload || {}), status]
    );
}

async function generateRandomEventForMatch(match) {
    if (Math.random() > EVENT_CHANCE_PER_TICK) return;
    const minute = buildMatchMinute(match.date);
    const { homeGoals, awayGoals } = parseScore(match.score);
    const totalGoals = homeGoals + awayGoals;
    const goalCap = getMaxTotalGoalsByMinute(minute);
    const goalDiff = Math.abs(homeGoals - awayGoals);

    const selected = chooseWeighted(EVENT_WEIGHTS, (item) => {
        if (item.type !== 'goal') return item.weight;
        if (totalGoals >= goalCap) return 0;
        // In lopsided games suppress extra goals to avoid unrealistic 10:20 outcomes.
        if (goalDiff >= 3) return 0.5;
        return item.weight;
    });

    await insertLiveEvent(match, selected);
}

async function runEventTick() {
    if (tickInProgress) return;
    tickInProgress = true;
    try {
        await ensureLiveEventsTable();
        const result = await db.query(
            `SELECT id, homeclubid, awayclubid, date, status
             FROM matches
             WHERE COALESCE(status, '') NOT IN ('cancelled', 'postponed')
             ORDER BY date ASC`
        );

        for (const match of result.rows) {
            const lifecycle = getMatchLifecycle(match.date, match.status);
            if (lifecycle.group !== 'live') continue;
            await generateRandomEventForMatch(match);
        }
    } catch (err) {
        console.error('❌ Live event engine tick failed:', err.message);
    } finally {
        tickInProgress = false;
    }
}

function startLiveEventEngine() {
    if (intervalRef) return;
    intervalRef = setInterval(runEventTick, EVENT_TICK_MS);
    runEventTick().catch(() => {});
}

module.exports = {
    ensureLiveEventsTable,
    startLiveEventEngine,
    generateRandomEventForMatch,
    EVENT_TICK_MS
};
