// Merge-field templating: replace {Field Name} tokens with record values. Pure
// (no SDK/React) so it's unit-testable and shared by the render layer.

// Replace {Field Name} tokens using resolve(name) -> string | null. An unknown
// field returns null and the literal token is kept, so a typo is visible rather
// than silently blank.
export function renderTemplate(text, resolve) {
    if (typeof text !== 'string') {
        return '';
    }
    return text.replace(/\{([^{}]+)\}/g, (match, rawName) => {
        const value = resolve(rawName.trim());
        return value == null ? match : value;
    });
}
