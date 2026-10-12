const storageKey = 'splatoon-home-scroll';
let savedPosition = 0;

try {
    const value = Number(sessionStorage.getItem(storageKey));
    if (Number.isFinite(value) && value >= 0) savedPosition = value;
} catch {
    // Navigation still works if the browser disables session storage.
}

history.scrollRestoration = 'manual';

window.addEventListener('pagehide', () => {
    try {
        savedPosition = window.scrollY;
        sessionStorage.setItem(storageKey, String(savedPosition));
    } catch {}
});

function restorePosition() {
    try {
        // Restore as soon as the layout exists, before revealing the page.
        // Explicit section links take priority over the saved position.
        if (!window.location.hash) {
            window.scrollTo({ top: savedPosition, left: 0, behavior: 'instant' });
        }
    } finally {
        document.documentElement.classList.remove('restoring-home');
    }
}

// This classic script sits at the end of body: the full layout already exists.
// DOMContentLoaded can wait for module dependencies and top-level model awaits.
restorePosition();
window.addEventListener('pageshow', event => {
    if (event.persisted) restorePosition();
});
