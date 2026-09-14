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

    window.GANG_PS_CONFIG = Object.freeze({
        mode: initialMode
    });

    window.gangPsGetLocalMode = () => {
        const mode = String(localStorage.getItem(STORAGE_KEY) || window.GANG_PS_CONFIG.mode || 'master').toLowerCase();
        return mode === 'client' ? 'client' : 'master';
    };
})();

//======== Server Mode Controller ========
(() => {
    const blocked = '.btn-start,.btn-stop,.btn-pause,.btn-resume,.btn-add-time,.btn-edit-note,.btn-add-order,.btn-delete-order,#open-cashier-btn,#checkout-btn,#use-pass-btn';

    function applyMode(mode) {
        const normalized = String(mode || 'master').toLowerCase() === 'client' ? 'client' : 'master';
        const isClient = normalized === 'client';

        window.gangPsServerMode = normalized;
        document.body.classList.toggle('gang-ps-master', !isClient);
        document.body.classList.toggle('gang-ps-client', isClient);

        document.querySelectorAll(blocked).forEach(element => {
            element.disabled = isClient;
            element.setAttribute('aria-disabled', isClient ? 'true' : 'false');
            element.classList.toggle('gang-ps-readonly-control', isClient);
        });

        const badge = document.querySelector('.gang-ps-client-badge');
        if (badge) badge.style.display = isClient ? 'block' : 'none';
    }

    window.gangPsApplyServerMode = applyMode;

    //======== Initial Local Mode ========
    document.addEventListener('DOMContentLoaded', () => {
        applyMode(window.gangPsGetLocalMode ? window.gangPsGetLocalMode() : window.GANG_PS_CONFIG.mode);
    });

    //======== Client Write Guard ========
    document.addEventListener('click', event => {
        if (String(window.gangPsServerMode || '').toLowerCase() !== 'client') return;
        const target = event.target && event.target.closest ? event.target.closest(blocked) : null;
        if (!target) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);

    document.addEventListener('submit', event => {
        if (String(window.gangPsServerMode || '').toLowerCase() !== 'client') return;
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);

    const style = document.createElement('style');
    style.textContent = `
        .gang-ps-client .gang-ps-readonly-control,
        .gang-ps-client ${blocked} {
            pointer-events:none!important;
            opacity:.45!important;
            cursor:not-allowed!important;
        }
        .gang-ps-client-badge {
            display:none;
            margin:0 0 12px;
            padding:7px 11px;
            border-radius:8px;
            background:#eef3ff;
            color:#3949ab;
            font:600 .82rem/1.2 Arial,sans-serif;
        }
    `;
    document.head.appendChild(style);
})();
