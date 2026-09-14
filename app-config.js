//======== PC Mode ========
// MASTER hanya pada PC server/local. Akses melalui Tailscale/IP otomatis menjadi CLIENT.
(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedMode = String(params.get('pc') || '').toLowerCase();
    const hostname = String(window.location.hostname || '').toLowerCase();
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';

    // URL ?pc=master/client hanya untuk override manual/testing.
    // Tanpa override: localhost = MASTER, selain localhost = CLIENT.
    const detectedMode = isLocalHost ? 'master' : 'client';
    const initialMode = requestedMode === 'client' || requestedMode === 'master'
        ? requestedMode
        : detectedMode;

    window.GANG_PS_CONFIG = Object.freeze({
        mode: initialMode
    });

    window.gangPsGetLocalMode = () => {
        const currentHostname = String(window.location.hostname || '').toLowerCase();
        const currentIsLocal = currentHostname === 'localhost' || currentHostname === '127.0.0.1' || currentHostname === '::1' || currentHostname === '[::1]';
        const manualMode = String(new URLSearchParams(window.location.search).get('pc') || '').toLowerCase();

        if (manualMode === 'master' || manualMode === 'client') return manualMode;
        return currentIsLocal ? 'master' : 'client';
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

    //======== Client Button Style ========
    // CLIENT dikunci melalui disabled + CSS. Tidak ada global click/submit blocker,
    // sehingga event handler billing MASTER tetap berjalan normal.
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
