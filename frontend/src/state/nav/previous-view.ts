import { createContext, useContext } from 'react';

/** The screen the person was on before the current one (null at the start). The ticket form reports it as "where it happened". */
export const PreviousViewContext = createContext<string | null>(null);
export const usePreviousView = (): string | null => useContext(PreviousViewContext);
