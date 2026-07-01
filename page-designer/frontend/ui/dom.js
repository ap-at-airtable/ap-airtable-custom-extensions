// Shared rule for when a custom interaction must defer to the browser.
//
// We override some native behaviors (a right-click row menu, keyboard shortcuts).
// Whenever the user is inside a native text-entry control we should step aside so
// cut/copy/paste, spellcheck suggestions, native selection, and caret keys keep
// working. Every place that hijacks the pointer or keyboard should consult this
// one predicate rather than re-deriving the check.

export function isTextEntryTarget(node) {
    let el = node;
    while (el && el.nodeType === 1) {
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
        if (el.isContentEditable) return true;
        el = el.parentElement;
    }
    return false;
}
