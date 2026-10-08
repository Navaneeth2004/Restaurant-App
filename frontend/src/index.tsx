import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyTheme, getStoredTheme } from './utils/theme';

// Apply the saved light/dark choice before the first paint (no flash).
applyTheme(getStoredTheme());

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<React.StrictMode><App /></React.StrictMode>);