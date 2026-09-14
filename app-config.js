//======== PC Mode ========
// PC Kasir Utama = master. PC lain = client.
window.GANG_PS_CONFIG = Object.freeze({
    mode: 'master'
});

//======== Client Read Only ========
(() => {
    const isMaster = String(window.GANG_PS_CONFIG.mode).toLowerCase() === 'master';
    if (isMaster) return;

    const blocked = '.btn-start,.btn-stop,.btn-pause,.btn-resume,.btn-add-time,.btn-edit-note,.btn-add-order,.btn-delete-order,#open-cashier-btn,#checkout-btn,#use-pass-btn';
    const block = event => {
        if (event.target && event.target.closest && event.target.closest(blocked)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    };
    document.addEventListener('click', block, true);
    document.addEventListener('submit', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);

    const style = document.createElement('style');
    style.textContent = `${blocked}{pointer-events:none!important;opacity:.45!important}.gang-ps-client-badge{display:inline-block;margin:0 0 12px;padding:7px 11px;border-radius:8px;background:#eef3ff;color:#3949ab;font:600 .82rem/1.2 Arial,sans-serif}`;
    document.head.appendChild(style);

    document.addEventListener('DOMContentLoaded', () => {
        const container = document.querySelector('body > .container');
        if (!container || document.querySelector('.gang-ps-client-badge')) return;
        const badge = document.createElement('div');
        badge.className = 'gang-ps-client-badge';
        badge.textContent = 'MODE CLIENT · Read Only';
        container.insertBefore(badge, container.firstChild);
    });
})();
