import { useState, useEffect } from 'react';

export default function Timer({ endTime }: { endTime: number | null }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!endTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = endTime - now;
      const remaining = Math.max(0, Math.ceil(diff / 1000));
      setSeconds(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 200);

    return () => clearInterval(interval);
  }, [endTime]);

  if (!endTime || (seconds <= 0 && endTime < Date.now() - 2000)) {
    return <span style={{ color: '#555' }}>00s</span>;
  }

  return (
    <span style={{ color: seconds < 6 ? '#ff4d4d' : 'inherit' }}>
      {seconds}s
    </span>
  );
}