import { useState, useEffect } from 'react';

const SIZES = ['S', 'M', 'L'];
const STORAGE_KEY = 'coinche-hand-card-size';

export function useHandCardSize() {
  const [size, setSize] = useState(() => {
    if (typeof window === 'undefined') return 'S';
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return SIZES.includes(saved) ? saved : 'S';
    } catch {
      return 'S';
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, size);
    } catch {
      // localStorage may be unavailable (private mode, quota); ignore.
    }
  }, [size]);

  const cycle = () => {
    setSize(prev => SIZES[(SIZES.indexOf(prev) + 1) % SIZES.length]);
  };

  return { size, cycle };
}

export default function HandSizeToggle({ onCycle }) {
  return (
    <button
      type="button"
      className="hand-size-toggle"
      onClick={onCycle}
      aria-label="Mode Delfino — agrandir les cartes"
      title="Mode Delfino — agrandir les cartes"
    >
      <span className="hand-size-toggle-icon" aria-hidden="true">🃏</span>
      <span className="hand-size-toggle-label">Mode Delfino</span>
    </button>
  );
}
