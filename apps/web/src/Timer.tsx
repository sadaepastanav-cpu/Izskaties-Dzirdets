import React, { useState, useEffect } from 'react';

interface TimerProps {
  endTime?: number | null;
  isPaused?: boolean;
  pausedRemainingMs?: number;
}

export default function Timer({ endTime, isPaused, pausedRemainingMs }: TimerProps) {
  const [timeLeftSec, setTimeLeftSec] = useState<number>(0);

  useEffect(() => {
    // 1. Ja ir PAUZE, apstādinām laiku uz atlikušajām sekundēm
    if (isPaused) {
      setTimeLeftSec(Math.max(0, Math.ceil((pausedRemainingMs || 0) / 1000)));
      return;
    }

    // 2. Ja nav norādīts beigu laiks, iestatām 0
    if (!endTime) {
      setTimeLeftSec(0);
      return;
    }

    // 3. Aprēķinām atlikušo laiku un palaižam intervālu
    const update = () => {
      setTimeLeftSec(Math.max(0, Math.ceil((endTime - Date.now()) / 1000)));
    };

    update();
    const interval = setInterval(update, 200);

    // Droša notīrīšana pie katras propu maiņas vai komponentes unmount
    return () => clearInterval(interval);
  }, [endTime, isPaused, pausedRemainingMs]);

  const isLow = timeLeftSec <= 5 && timeLeftSec > 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isPaused ? '#ff9800' : isLow ? '#ff0055' : '#00ff00',
        fontWeight: '900',
        fontSize: '1.6vw',
        minWidth: '2.5vw',
        textShadow: isPaused
          ? '0 0 10px #ff9800'
          : isLow
          ? '0 0 15px #ff0055'
          : '0 0 10px rgba(0,255,0,0.6)',
        animation: isLow && !isPaused ? 'pulse 0.5s infinite alternate' : 'none'
      }}
    >
      {timeLeftSec}s
    </div>
  );
}