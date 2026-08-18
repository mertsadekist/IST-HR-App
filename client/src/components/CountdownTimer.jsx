import { useState, useEffect, useRef } from 'react';

// Ticks down to an absolute deadline (server-supplied `deadlineAt`) or a fixed
// `seconds` duration from mount. Deadline-based countdowns are the source of
// truth for timed assessment stages — recomputing from a real timestamp on
// every tick means a page refresh never grants extra time.
export default function CountdownTimer({ deadlineAt, seconds, onExpire, className }) {
  const targetRef = useRef(deadlineAt ? new Date(deadlineAt).getTime() : Date.now() + (seconds || 0) * 1000);
  const expiredRef = useRef(false);
  const [remaining, setRemaining] = useState(Math.max(0, Math.round((targetRef.current - Date.now()) / 1000)));

  useEffect(() => {
    targetRef.current = deadlineAt ? new Date(deadlineAt).getTime() : Date.now() + (seconds || 0) * 1000;
    expiredRef.current = false;
    setRemaining(Math.max(0, Math.round((targetRef.current - Date.now()) / 1000)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineAt, seconds]);

  useEffect(() => {
    const id = setInterval(() => {
      const rem = Math.max(0, Math.round((targetRef.current - Date.now()) / 1000));
      setRemaining(rem);
      if (rem <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onExpire]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  return <span className={className}>{mm}:{ss}</span>;
}
