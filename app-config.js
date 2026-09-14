//======== PC Mode ========
// Mode disimpan per-browser agar PC Master dan PC Client bisa dibedakan walau memakai IP/Tailscale yang sama.
(() => {
    const STORAGE_KEY = 'gangPsPcMode';
    const params = new URLSearchParams(window.location.search);
    const requestedMode = String(params.get('pc') || '').toLowerCase();
    const storedMode = String(localStorage.getItem(STORAGE_KEY) || '').toLowerCase();
    const initialMode = requestedMode === 'client' || requestedMode === 'master'
        ? requestedMode
        : (storedMode === 'client' || storedMode === 'master' ? storedMode : 'master');

    if (requestedMode === 'client' || requestedMode === 'master') {
        localStorage.setItem(STORAGE_KEY, requestedMode);
    }

    window.GANG_PS_CONFIG = Object.freeze({ mode: initialMode });

    window.gangPsGetLocalMode = () => {
        const mode = String(localStorage.getItem(STORAGE_KEY) || window.GANG_PS_CONFIG.mode || 'master').toLowerCase();
        return mode === 'client' ? 'client' : 'master';
    };

    //======== Billing Controls ========
    const masterOnlySelectors = [
        '#open-cashier-btn',
        '.btn-start',
        '.btn-stop',
        '.btn-pause',
        '.btn-resume',
        '.btn-add-time',
        '.btn-edit-note',
        '.btn-add-order',
        '.btn-delete-order',
        '#use-pass-btn',
        '#checkout-btn',
        '#start-session-form button[type="submit"]',
        '#add-time-form button[type="submit"]',
        '#note-form button[type="submit"]',
        '#order-form button[type="submit"]',
        '#cashier-form button[type="submit"]',
        '#payment-form button[type="submit"]'
    ];
    const masterOnlySelector = masterOnlySelectors.join(',');

    function applyPcMode() {
        const isClient = window.gangPsGetLocalMode() === 'client';
        document.body.classList.toggle('gang-ps-master', !isClient);
        document.body.classList.toggle('gang-ps-client', isClient);

        document.querySelectorAll(masterOnlySelector).forEach(element => {
            element.disabled = isClient;
            element.setAttribute('aria-disabled', isClient ? 'true' : 'false');
            element.classList.toggle('gang-ps-readonly-control', isClient);
        });
    }

    window.gangPsApplyPcMode = applyPcMode;

    document.addEventListener('DOMContentLoaded', applyPcMode);

    //======== Client Write Guard ========
    document.addEventListener('click', event => {
        if (window.gangPsGetLocalMode() !== 'client') return;
        const target = event.target && event.target.closest ? event.target.closest(masterOnlySelector) : null;
        if (!target) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);

    document.addEventListener('submit', event => {
        if (window.gangPsGetLocalMode() !== 'client') return;
        const target = event.target;
        if (!target) return;
        if (target.matches(masterOnlySelector) || target.querySelector(masterOnlySelector)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);

    //======== Client Button Style ========
    const style = document.createElement('style');
    style.textContent = `
        .gang-ps-client .gang-ps-readonly-control,
        .gang-ps-client ${masterOnlySelector} {
            pointer-events:none!important;
            opacity:.45!important;
            cursor:not-allowed!important;
        }
    `;
    document.head.appendChild(style);

    // Re-apply after billing cards/buttons are rendered dynamically.
    const observer = new MutationObserver(() => applyPcMode());
    document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
    });
})();
