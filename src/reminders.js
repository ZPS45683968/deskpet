const REPEATS = ['none', 'daily', 'weekdays', 'weekly'];
function nextOccurrence(memo, now) {
  const offset = memo.eventAt - memo.remindAt;
  const next = new Date(memo.eventAt);
  // Jump close to today, then advance by calendar days to preserve local time.
  const today = new Date(now + offset);
  const days = Math.max(0, Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(next.getFullYear(), next.getMonth(), next.getDate())) / 86400000));
  next.setDate(next.getDate() + (memo.repeat === 'weekly' ? Math.floor(days / 7) * 7 : days));
  while (next.getTime() - offset <= now || next.getTime() <= memo.eventAt || (memo.repeat === 'weekdays' && [0, 6].includes(next.getDay()))) next.setDate(next.getDate() + (memo.repeat === 'weekly' ? 7 : 1));
  return { eventAt: next.getTime(), remindAt: next.getTime() - offset };
}
module.exports = { REPEATS, nextOccurrence };
