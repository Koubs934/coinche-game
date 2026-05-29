import { createContext, useContext, useState } from 'react';

// Mode Sacha — a GLOBAL (not per-room) card-sort preference. When ON, the hand's
// suits are arranged purely by color alternation (trump not forced leftmost). Mirrors
// LanguageContext: a single provider at the app root, consumed via useModeSacha()
// anywhere — so BOTH the normal-play GameBoard (under App) and the training GameBoard
// (under TrainingTable) read the same live value without prop-drilling.
const STORAGE_KEY = 'coinche-mode-sacha';
const ModeSachaContext = createContext(null);

export function ModeSachaProvider({ children }) {
  const [modeSacha, setModeSacha] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });

  function toggleModeSacha() {
    setModeSacha(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }

  return (
    <ModeSachaContext.Provider value={{ modeSacha, toggleModeSacha }}>
      {children}
    </ModeSachaContext.Provider>
  );
}

export function useModeSacha() {
  return useContext(ModeSachaContext);
}
