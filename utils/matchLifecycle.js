const FIRST_HALF_MS = 45 * 60 * 1000;
const HALFTIME_MS = 15 * 60 * 1000;
const SECOND_HALF_MS = 45 * 60 * 1000;
const TOTAL_MATCH_MS = FIRST_HALF_MS + HALFTIME_MS + SECOND_HALF_MS;

function getMatchLifecycle(matchDate, status = '') {
    const kickoff = new Date(matchDate);
    const explicitStatus = String(status || '').toLowerCase();
    const now = Date.now();
    const startMs = kickoff.getTime();

    if (Number.isNaN(startMs)) {
        return {
            phase: 'upcoming',
            group: 'upcoming',
            isLive: false,
            kickoff
        };
    }

    if (explicitStatus === 'cancelled') {
        return {
            phase: 'cancelled',
            group: 'cancelled',
            isLive: false,
            kickoff
        };
    }

    if (explicitStatus === 'postponed') {
        return {
            phase: 'postponed',
            group: 'upcoming',
            isLive: false,
            kickoff
        };
    }

    const elapsed = now - startMs;

    if (elapsed < 0) {
        return {
            phase: 'upcoming',
            group: 'upcoming',
            isLive: false,
            kickoff
        };
    }

    if (elapsed < FIRST_HALF_MS) {
        return {
            phase: 'first_half',
            group: 'live',
            isLive: true,
            kickoff
        };
    }

    if (elapsed < FIRST_HALF_MS + HALFTIME_MS) {
        return {
            phase: 'halftime',
            group: 'live',
            isLive: true,
            kickoff
        };
    }

    if (elapsed < TOTAL_MATCH_MS) {
        return {
            phase: 'second_half',
            group: 'live',
            isLive: true,
            kickoff
        };
    }

    return {
        phase: explicitStatus === 'finished' ? 'finished' : 'finished',
        group: 'completed',
        isLive: false,
        kickoff
    };
}

module.exports = {
    FIRST_HALF_MS,
    HALFTIME_MS,
    SECOND_HALF_MS,
    TOTAL_MATCH_MS,
    getMatchLifecycle
};
