// Curated web-font set, loaded once via the SDK's loadCSSFromURLAsync (Google
// Fonts). Used by the font pickers and applied to text elements.

import {loadCSSFromURLAsync} from '@airtable/blocks/interface/ui';

export const FONT_OPTIONS = [
    {value: 'Inter', label: 'Inter'},
    {value: 'Roboto', label: 'Roboto'},
    {value: 'Open Sans', label: 'Open Sans'},
    {value: 'Lato', label: 'Lato'},
    {value: 'Montserrat', label: 'Montserrat'},
    {value: 'Merriweather', label: 'Merriweather (serif)'},
    {value: 'Playfair Display', label: 'Playfair Display (serif)'},
    {value: 'Oswald', label: 'Oswald'},
    {value: 'Source Sans 3', label: 'Source Sans'},
    {value: 'Roboto Mono', label: 'Roboto Mono (mono)'},
];

let _loaded = false;

export function ensureFontsLoaded() {
    if (_loaded) {
        return;
    }
    _loaded = true;
    const families = FONT_OPTIONS.map(
        (f) => `family=${f.value.replace(/ /g, '+')}:ital,wght@0,400;0,700;1,400;1,700`,
    ).join('&');
    const url = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    // Fire-and-forget: a font load failure degrades to a system font, not a crash.
    // Warn (not throw) so a "why is my font not applying?" has a breadcrumb.
    loadCSSFromURLAsync(url).catch((err) => {
        console.warn('Web fonts failed to load; falling back to system fonts', err);
    });
}
