// Coarse-pointer (touch) detection, shared so inline editors show a standing
// affordance (no hover on touch) and pickers switch to a bottom sheet. `?touch=1`
// forces it on for testing. Read once at load; fine for v1.

export function detectCoarse() {
    if (typeof window === 'undefined') return false;
    try {
        if (new URLSearchParams(window.location.search).get('touch') === '1') return true;
        return window.matchMedia('(hover: none), (pointer: coarse)').matches;
    } catch {
        return false;
    }
}

export const COARSE = detectCoarse();
