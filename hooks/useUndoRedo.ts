import { useState, useCallback } from 'react';

export const useUndoRedo = <T>(initialState: T) => {
  const [history, setHistory] = useState([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const set = useCallback((newState: T) => {
    // When a new state is set, erase any "future" states from the history.
    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  }, [history, currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, history.length]);
  
  const reset = useCallback((newState: T) => {
      setHistory([newState]);
      setCurrentIndex(0);
  }, []);

  return [
    history[currentIndex],
    {
      set,
      undo,
      redo,
      reset,
      canUndo: currentIndex > 0,
      canRedo: currentIndex < history.length - 1,
    },
  ] as const;
};