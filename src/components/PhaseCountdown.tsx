import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface PhaseCountdownProps {
  endTime: string;
  onComplete?: () => void;
}

const PhaseCountdown = ({ endTime, onComplete }: PhaseCountdownProps) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(endTime).getTime();
      const now = Date.now();
      const diff = end - now;
      return Math.max(0, diff);
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining === 0 && onComplete) {
        onComplete();
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime, onComplete]);

  const hours = Math.floor(timeLeft / 3600000);
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');

  const isLowTime = minutes < 5;
  const isCritical = minutes < 1;

  return (
    <div
      className={`flex items-center space-x-2 font-condensed text-2xl font-extrabold ${
        isCritical
          ? 'text-destructive animate-pulse'
          : isLowTime
          ? 'text-accent'
          : 'text-primary'
      }`}
    >
      <Clock className="h-6 w-6" aria-hidden="true" />
      <span className="tabular-nums tracking-wide" role="timer" aria-label="Time remaining">
        {hours > 0 ? `${hours}:${pad(minutes % 60)}` : pad(minutes)}:{pad(seconds)}
      </span>
    </div>
  );
};

export default PhaseCountdown;
