import {initializeBlock} from '@airtable/blocks/interface/ui';
// Import the PRE-COMPILED Tailwind output (not style.css with @tailwind directives).
// The block CLI's at-release Tailwind step proved flaky (temp-file races dropped the
// utility classes, leaving the chrome unstyled), so we ship literal CSS it can only
// pass through. Regenerate after changing classes: `npm run build:css`.
import './compiled.css';
import {App} from './app.js';

initializeBlock({interface: () => <App />});
