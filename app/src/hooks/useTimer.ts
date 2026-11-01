import { useState, useEffect, useCallback, useRef } from 'react';

export const useTimer = (initialMinutes = 25, onComplete?: () => void) => {
  const [secondsLeft, setSecondsLeft] = useState(initialMinutes * 60);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsLeftRef = useRef(initialMinutes * 60);
  const isActiveRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const startTimer = useCallback(() => {
    if (isActiveRef.current || timerRef.current || secondsLeftRef.current <= 0) return;

    isActiveRef.current = true;
    setIsActive(true);
    timerRef.current = setInterval(() => {
      const next = secondsLeftRef.current - 1;
      secondsLeftRef.current = next;
      setSecondsLeft(next);

      if (next <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        isActiveRef.current = false;
        setIsActive(false);
        onCompleteRef.current?.();
      }
    }, 1000);
  }, []);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    isActiveRef.current = false;
    setIsActive(false);
  }, []);

  const resetTimer = useCallback(() => {
    pauseTimer();
    secondsLeftRef.current = initialMinutes * 60;
    setSecondsLeft(initialMinutes * 60);
  }, [initialMinutes, pauseTimer]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      isActiveRef.current = false;
    };
  }, []);

  const formatTime = () => {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return {
    secondsLeft,
    isActive,
    startTimer,
    pauseTimer,
    resetTimer,
    formatTime,
  };
};
