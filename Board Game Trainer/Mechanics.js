// mechanics.js
export function nextFromSchedule(count, schedule = [], step = 0) {
  // count = how many times already redeemed/turned-in (0 means none yet)
  if (count <= 0) return { last: null, next: schedule[0] ?? step };

  const last = count <= schedule.length
    ? schedule[count - 1]
    : (schedule.at(-1) ?? 0) + (count - schedule.length) * step;

  const next = count < schedule.length
    ? schedule[count]
    : (schedule.at(-1) ?? 0) + (count - schedule.length + 1) * step;

  return { last, next };
}

// Example: classic Risk card turn-ins
export function riskNextArmies(setsTurnedIn) {
  const schedule = [4,6,8,10,12,15];
  const { next } = nextFromSchedule(setsTurnedIn, schedule, 5);
  return next;
}

