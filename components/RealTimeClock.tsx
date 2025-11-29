import React, { useState, useEffect } from 'react';

const RealTimeClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, []);

  return (
    <div className="hidden sm:flex items-center gap-2 text-[var(--text-muted)]">
      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
      <p className="font-mono text-sm">
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
};

export default RealTimeClock;