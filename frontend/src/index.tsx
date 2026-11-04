import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'styles/theme.css';
import 'styles/overrides.css';
import 'styles/index.css';
import 'styles/bill.css';
import 'styles/print.css';
import 'styles/floor.css';
import App from 'app/App';
import { startErrorCapture } from 'lib/support/error-capture';
import { applyTheme, getStoredTheme } from 'state/theme/theme';

applyTheme(getStoredTheme()); // before first paint: no flash
startErrorCapture(); // so a ticket can include what failed BEFORE the form was opened

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');
createRoot(container).render(<StrictMode><App /></StrictMode>);
