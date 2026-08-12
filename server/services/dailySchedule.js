/**
 * A once-a-day job at a fixed local time.
 *
 * The other background jobs here run on `setInterval` every six hours, which is
 * fine for "some time today" but cannot express "05:00". This computes the
 * milliseconds to the next occurrence, sleeps, runs, and re-arms.
 *
 * Local time means the app's timezone: server.js sets `process.env.TZ` from the
 * configured setting at boot, so the Date methods used here are already in it.
 *
 * Re-arming after each run rather than using a fixed 24-hour interval matters:
 * an interval drifts, and across a DST change it would land an hour out. This
 * recomputes from the calendar every time.
 */

/** Milliseconds from now until the next `hh:mm` local. Always positive. */
export function msUntilNext(hour, minute, now = new Date()) {
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

/**
 * @param {{hour:number, minute?:number, name:string, onTick:() => Promise<void>}} opts
 * @returns {{stop: () => void}}
 */
export function scheduleDailyAt({ hour, minute = 0, name, onTick }) {
  let timer = null;
  let stopped = false;

  const arm = () => {
    if (stopped) return;
    const wait = msUntilNext(hour, minute);
    const at = new Date(Date.now() + wait);
    console.log(`⏰ ${name}: next run ${at.toLocaleString()} (in ${Math.round(wait / 60000)} min)`);
    timer = setTimeout(async () => {
      try {
        await onTick();
      } catch (err) {
        // A failing job must never take the arming with it, or one bad morning
        // silently ends the schedule for good.
        console.error(`${name} failed:`, err.message);
      } finally {
        arm();
      }
    }, wait);
    // Do not hold the process open on account of a timer that may be hours away.
    timer.unref?.();
  };

  arm();
  return { stop: () => { stopped = true; if (timer) clearTimeout(timer); } };
}
