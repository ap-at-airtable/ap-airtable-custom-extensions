import {initializeBlock} from '@airtable/blocks/interface/ui';
import './style.css';
import {App} from './app.js';

initializeBlock({interface: () => <App />});
