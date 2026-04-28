const FIRST_HALF_SECONDS = 45 * 60;
const HALFTIME_SECONDS = 15 * 60;
const SECOND_HALF_SECONDS = 45 * 60;

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatClock(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function getClientMatchLifecycle(kickoffIso, score = '0:0', nowMs = Date.now()) {
  const startMs = new Date(kickoffIso).getTime();

  if (Number.isNaN(startMs)) {
    return {
      phase: 'upcoming',
      statusLabel: 'Upcoming',
      timerLabel: '',
      showTimer: false,
      showScore: false
    };
  }

  const elapsedSeconds = Math.floor((nowMs - startMs) / 1000);

  if (elapsedSeconds < 0) {
    return {
      phase: 'upcoming',
      statusLabel: 'Upcoming',
      timerLabel: '',
      showTimer: false,
      showScore: false
    };
  }

  if (elapsedSeconds < FIRST_HALF_SECONDS) {
    return {
      phase: 'first_half',
      statusLabel: '1st Half',
      timerLabel: `${Math.min(45, Math.floor(elapsedSeconds / 60) + 1)}' ${formatClock(elapsedSeconds)}`,
      showTimer: true,
      showScore: true,
      score
    };
  }

  if (elapsedSeconds < FIRST_HALF_SECONDS + HALFTIME_SECONDS) {
    const breakSeconds = elapsedSeconds - FIRST_HALF_SECONDS;
    return {
      phase: 'halftime',
      statusLabel: 'Break',
      timerLabel: `${formatClock(HALFTIME_SECONDS - breakSeconds)} left`,
      showTimer: true,
      showScore: true,
      score
    };
  }

  if (elapsedSeconds < FIRST_HALF_SECONDS + HALFTIME_SECONDS + SECOND_HALF_SECONDS) {
    const secondHalfSeconds = elapsedSeconds - FIRST_HALF_SECONDS - HALFTIME_SECONDS;
    const liveMinute = 46 + Math.floor(secondHalfSeconds / 60);
    return {
      phase: 'second_half',
      statusLabel: '2nd Half',
      timerLabel: `${Math.min(90, liveMinute)}' ${formatClock(secondHalfSeconds)}`,
      showTimer: true,
      showScore: true,
      score
    };
  }

  return {
    phase: 'finished',
    statusLabel: 'Finished',
    timerLabel: 'FT',
    showTimer: false,
    showScore: true,
    score
  };
}
