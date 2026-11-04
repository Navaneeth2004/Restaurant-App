/** Only reader of build-time env. Empty REACT_APP_API_URL = same origin (dev proxy / backend-served build). */
const configured = (process.env.REACT_APP_API_URL ?? '').replace(/\/$/, '');

export const API_ORIGIN: string = configured || window.location.origin;
export const API_BASE: string = `${API_ORIGIN}/api`;
