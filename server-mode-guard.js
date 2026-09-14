(() => {
    let currentMode = 'master';

    function isClient() {
        return currentMode === 'client';
    }

    function applyClientUi() {
        document.body.classList.toggle('gang-ps-client', isClient());
        document.body.classList.toggle('gang-ps-master', !isClient());

        const masterOnlySelectors = [
            '#open-cashier-btn',
            '.btn-start',
            '.btn-stop',
            '.btn-pause',
            '.btn-resume',
            '.btn-add-time',
            '.btn-edit-note',
            '.btn-add-order',
            '#use-pass-btn',
            '#checkout-btn',
            '#start-session-form button[type="submit"]',
            '#add-time-form button[type="submit"]',
            '#note-form button[type="submit"]',
            '#order-form button[type="submit"]',
            '#cashier-form button[type="submit"]',
            '#payment-form button[type="submit"]'
        ];

        document.querySelectorAll(masterOnlySelectors.join(',')).forEach((element) => {
            if (isClient()) {
                element.disabled = true;
                element.setAttribute('data-master-only', 'true');
                element.title = 'Fitur ini hanya tersedia di PC MASTER.';
            } else if (element.getAttribute('data-master-only') === 'true') {
                element.disabled = false;
                element.removeAttribute('data-master-only');
                element.removeAttribute('title');
            }
        });
    }

    window.gangPsApplyServerMode = function(mode) {
        currentMode = mode === 'client' ? 'client' : 'master';
        applyClientUi();
    };

    document.addEventListener('click', (event) => {
        if (!isClient()) return;
        const target = event.target.closest ? event.target.closest('[data-master-only]') : null;
        if (target) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);

    document.addEventListener('submit', (event) => {
        if (!isClient()) return;
        const form = event.target;
        if (form && form.closest('.modal')) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);

    const observer = new MutationObserver(() => applyClientUi());

    document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
        const configuredMode = window.GANG_PS_CONFIG && window.GANG_PS_CONFIG.mode;
        if (configuredMode === 'client') window.gangPsApplyServerMode('client');
        else applyClientUi();
    });
})();
