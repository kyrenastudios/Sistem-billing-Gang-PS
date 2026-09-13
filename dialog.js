//======== Gang PS Dialog ========
(() => {
    const state = {
        queue: [],
        active: null,
        initialized: false
    };

    function ensureDialog() {
        if (state.initialized) return;

        const overlay = document.createElement('div');
        overlay.id = 'gang-ps-dialog';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = `
            <div class="gang-ps-dialog-card" role="dialog" aria-modal="true" aria-labelledby="gang-ps-dialog-title">
                <h3 id="gang-ps-dialog-title">Gang PS</h3>
                <div id="gang-ps-dialog-message"></div>
                <div class="gang-ps-dialog-actions">
                    <button type="button" id="gang-ps-dialog-cancel">Batal</button>
                    <button type="button" id="gang-ps-dialog-ok">OK</button>
                </div>
            </div>
        `;

        Object.assign(overlay.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '100000',
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            background: 'rgba(0,0,0,.55)',
            boxSizing: 'border-box'
        });

        const card = overlay.querySelector('.gang-ps-dialog-card');
        Object.assign(card.style, {
            width: 'min(420px, 100%)',
            background: '#fff',
            borderRadius: '10px',
            padding: '20px',
            boxSizing: 'border-box',
            boxShadow: '0 10px 35px rgba(0,0,0,.3)',
            color: '#222'
        });

        const title = overlay.querySelector('#gang-ps-dialog-title');
        Object.assign(title.style, {
            margin: '0 0 12px',
            fontSize: '1.2rem'
        });

        const message = overlay.querySelector('#gang-ps-dialog-message');
        Object.assign(message.style, {
            whiteSpace: 'pre-wrap',
            lineHeight: '1.5',
            marginBottom: '18px'
        });

        const actions = overlay.querySelector('.gang-ps-dialog-actions');
        Object.assign(actions.style, {
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px'
        });

        [overlay.querySelector('#gang-ps-dialog-cancel'), overlay.querySelector('#gang-ps-dialog-ok')].forEach(button => {
            Object.assign(button.style, {
                minWidth: '80px',
                padding: '9px 14px',
                border: '0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
            });
        });

        document.body.appendChild(overlay);

        overlay.querySelector('#gang-ps-dialog-ok').addEventListener('click', () => finish(true));
        overlay.querySelector('#gang-ps-dialog-cancel').addEventListener('click', () => finish(false));
        overlay.addEventListener('click', event => {
            if (event.target === overlay && state.active?.type === 'confirm') finish(false);
        });

        state.overlay = overlay;
        state.title = title;
        state.message = message;
        state.cancelButton = overlay.querySelector('#gang-ps-dialog-cancel');
        state.okButton = overlay.querySelector('#gang-ps-dialog-ok');
        state.initialized = true;
    }

    function showNext() {
        if (state.active || state.queue.length === 0) return;
        ensureDialog();

        state.active = state.queue.shift();
        state.title.textContent = state.active.title || 'Gang PS';
        state.message.textContent = state.active.message || '';
        state.cancelButton.style.display = state.active.type === 'confirm' ? 'inline-block' : 'none';
        state.okButton.textContent = state.active.type === 'confirm' ? 'Ya' : 'OK';
        state.overlay.style.display = 'flex';
        state.overlay.setAttribute('aria-hidden', 'false');
        state.okButton.focus();
    }

    function finish(result) {
        if (!state.active) return;
        const current = state.active;
        state.active = null;
        state.overlay.style.display = 'none';
        state.overlay.setAttribute('aria-hidden', 'true');
        current.resolve(result);
        showNext();
    }

    function showAlert(message, title = 'Gang PS') {
        state.queue.push({ type: 'alert', message: String(message), title, resolve: () => {} });
        showNext();
    }

    function showConfirm(message, title = 'Konfirmasi') {
        return new Promise(resolve => {
            state.queue.push({ type: 'confirm', message: String(message), title, resolve });
            showNext();
        });
    }

    window.gangPsAlert = showAlert;
    window.gangPsConfirm = showConfirm;

    // Ganti native alert() agar ekstensi browser tidak memblokir alur aplikasi.
    window.alert = showAlert;
})();
