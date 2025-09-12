document.addEventListener('DOMContentLoaded', () => {
    // Harga per jam standar (untuk hitungan default, OPEN, dan Tambah Waktu)
    const PRICES = {
        PS3: 5000,
        PS4: 8000,
        PS5: 13000,
    };

    // Definisi Elemen DOM
    const consoleList = document.getElementById('console-list');
    const noConsolesMessage = document.getElementById('no-consoles-message');
    const modals = {
        start: document.getElementById('start-session-modal'),
        addTime: document.getElementById('add-time-modal'),
        note: document.getElementById('note-modal'),
        order: document.getElementById('order-modal'),
        cashier: document.getElementById('cashier-modal'),
    };
    let consoles = [];
    let menuItems = [];
    let cashierCart = [];

    const openCashierBtn = document.getElementById('open-cashier-btn');

    function renderCashierCart() {
        const cartList = modals.cashier.querySelector('#cashier-cart-list');
        const totalElement = modals.cashier.querySelector('#cashier-total');
        cartList.innerHTML = '';
        let totalCost = 0;

        if (cashierCart.length === 0) {
            cartList.innerHTML = '<li>Keranjang kosong.</li>';
        } else {
            cashierCart.forEach((item, index) => {
                const itemTotal = item.price * item.quantity;
                totalCost += itemTotal;
                const li = document.createElement('li');
                li.className = 'order-item';
                li.innerHTML = `<span>${item.name} x ${item.quantity} - ${formatCurrency(itemTotal)}</span><button class="btn-delete-order" data-cart-index="${index}" title="Hapus Item">&times;</button>`;
                cartList.appendChild(li);
            });
        }
        totalElement.textContent = `Total: ${formatCurrency(totalCost)}`;
    }

    if (openCashierBtn) {
        openCashierBtn.addEventListener('click', () => {
            const select = modals.cashier.querySelector('#cashier-item-select');
            select.innerHTML = '<option value="" disabled selected>-- Pilih Item --</option>';
            if (menuItems.length > 0) {
                menuItems.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.id;
                    option.textContent = `${item.name} - ${formatCurrency(item.price)}`;
                    select.appendChild(option);
                });
            } else {
                select.innerHTML = '<option value="">Menu kosong</option>';
            }
            modals.cashier.style.display = 'block';
        });
    }
    
    if (modals.cashier) {
        modals.cashier.querySelector('#cashier-form').addEventListener('submit', e => {
            e.preventDefault();
            const selectedItemId = e.target.querySelector('#cashier-item-select').value;
            const quantity = parseInt(e.target.querySelector('#cashier-item-quantity').value, 10);
            const selectedItem = menuItems.find(item => item.id === selectedItemId);
            if (selectedItem && quantity > 0) {
                const existingItem = cashierCart.find(item => item.id === selectedItemId);
                if (existingItem) {
                    existingItem.quantity += quantity;
                } else {
                    cashierCart.push({ ...selectedItem, quantity });
                }
                renderCashierCart();
            }
            e.target.reset();
            e.target.querySelector('#cashier-item-quantity').value = 1;
        });

        modals.cashier.querySelector('#cashier-cart-list').addEventListener('click', e => {
            if (e.target.matches('.btn-delete-order')) {
                const cartIndex = parseInt(e.target.dataset.cartIndex, 10);
                cashierCart.splice(cartIndex, 1);
                renderCashierCart();
            }
        });

        modals.cashier.querySelector('#checkout-btn').addEventListener('click', () => {
            if (cashierCart.length === 0) {
                alert('Keranjang belanja kosong!');
                return;
            }
            const orderCost = cashierCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const history = JSON.parse(localStorage.getItem('history')) || [];
            const now = new Date();
            history.push({
                date: now.toISOString().split('T')[0], consoleName: 'Penjualan Langsung',
                startTime: now.toLocaleTimeString('id-ID'), endTime: now.toLocaleTimeString('id-ID'),
                durationMinutes: 0, rentalCost: 0, orderCost: orderCost, totalCost: orderCost,
                orders: cashierCart, notes: 'Transaksi kasir',
            });
            localStorage.setItem('history', JSON.stringify(history));
            alert(`Transaksi berhasil dicatat!\nTotal Penjualan: ${formatCurrency(orderCost)}`);
            cashierCart = [];
            renderCashierCart();
            modals.cashier.style.display = 'none';
        });
    }

    // --- FUNGSI UTAMA & TAMPILAN ---

    function initialize() {
        try {
            const savedConsoles = JSON.parse(localStorage.getItem('consoles'));
            menuItems = JSON.parse(localStorage.getItem('menuItems')) || [];
            if (savedConsoles && Array.isArray(savedConsoles) && savedConsoles.length > 0) {
                consoles = savedConsoles;
                renderConsoles();
                setInterval(updateTimers, 1000);
            } else {
                consoleList.style.display = 'none';
                noConsolesMessage.style.display = 'block';
            }
        } catch (error) {
            console.error("Gagal memuat data dari localStorage.", error);
            consoleList.style.display = 'none';
            noConsolesMessage.innerHTML = "<p>Gagal memuat data. Coba hapus cache browser.</p>";
            noConsolesMessage.style.display = 'block';
        }
    }
    
    function renderConsoles() {
        consoleList.innerHTML = '';
        if (!consoles || consoles.length === 0) {
            consoleList.style.display = 'none';
            noConsolesMessage.style.display = 'block';
            return;
        }
        consoles.forEach(console => {
            const card = document.createElement('div');
            card.className = `console-card ${console.status} ${console.type.toLowerCase()}`;
            card.dataset.id = console.id;
            let detailsHTML = '', actionsHTML = '';

            if (console.status === 'in-use' || console.status === 'paused') {
                const session = console.session;
                if (!session) { console.status = 'available'; saveAndRender(); return; }
                const timerId = `timer-${console.id}`;
                const billingTypeDisplay = session.type === 'open' ? 'OPEN' : `Paket (Total ${session.totalPaketMinutes / 60} Jam - ${formatCurrency(session.totalPaketCost)})`;
                const realTimeCostHTML = session.type === 'open' ? `<p>Biaya Saat Ini: <span class="realtime-cost" id="cost-${console.id}">${formatCurrency(calculateCost(console.type, Math.ceil(((session.frozenElapsedTime || 0)) / 60000)))}</span></p>` : '';
                const notesDisplay = session.notes ? `<div class="session-details"><strong class="notes-display">Catatan:</strong> ${session.notes}</div>` : '';
                let ordersDisplay = '';
                if (session.orders && session.orders.length > 0) {
                    const orderItems = session.orders.map((o, index) => `<li class="order-item"><span>${o.name} x ${o.quantity} - ${formatCurrency(o.price * o.quantity)}</span><button class="btn-delete-order" data-order-index="${index}" title="Hapus Pesanan" ${console.status === 'paused' ? 'disabled' : ''}>&times;</button></li>`).join('');
                    ordersDisplay = `<div class="session-details"><strong>Pesanan:</strong><ul>${orderItems}</ul></div>`;
                }
                let timerDisplay = '00:00:00';
                if(console.status === 'paused' && session.frozenTimeDisplay) {
                    timerDisplay = session.frozenTimeDisplay;
                }
                
                if (console.status === 'in-use') {
                    detailsHTML = `<p class="status in-use">SEDANG DIGUNAKAN</p>`;
                    actionsHTML = `<button class="btn-stop">Stop Sesi</button><button class="btn-pause" style="background-color: #ff9800;">Pause</button> ${session.type !== 'open' ? `<button class="btn-add-time">Tambah Waktu</button>` : ''}<button class="btn-edit-note">Catatan</button><button class="btn-add-order">Tambah Pesanan</button>`;
                } else {
                    detailsHTML = `<p class="status" style="color:#2196f3; font-weight:bold;">DIJEDA (PAUSED)</p>`;
                    actionsHTML = `<button class="btn-stop" disabled>Stop Sesi</button><button class="btn-resume" style="background-color: #4caf50;">Lanjutkan</button> ${session.type !== 'open' ? `<button class="btn-add-time" disabled>Tambah Waktu</button>` : ''}<button class="btn-edit-note" disabled>Catatan</button><button class="btn-add-order" disabled>Tambah Pesanan</button>`;
                }
                detailsHTML += `<div class="timer" id="${timerId}">${timerDisplay}</div><p>Tipe: ${billingTypeDisplay}</p>${realTimeCostHTML}${notesDisplay}${ordersDisplay}`;
            } else {
                detailsHTML = `<p class="status available">TERSEDIA</p>`;
                actionsHTML = `<button class="btn-start">Mulai Sesi</button>`;
            }
            card.innerHTML = `<h4>${console.name}</h4>${detailsHTML}<div class="card-actions">${actionsHTML}</div>`;
            consoleList.appendChild(card);
        });
        updateTimers();
    }
    
    function updateTimers() {
        const now = new Date().getTime();
        consoles.forEach(c => {
            if (c.status === 'in-use' && c.session) {
                const timerElement = document.getElementById(`timer-${c.id}`);
                if (!timerElement) return;
                const session = c.session;
                if (session.type === 'open') {
                    const elapsedTime = now - session.startTime - (session.totalPausedDuration || 0);
                    timerElement.textContent = formatDuration(elapsedTime);
                } else {
                    const remainingTime = session.endTime - now;
                    if (remainingTime <= 0) { timerElement.textContent = "WAKTU HABIS"; timerElement.style.color = "red"; }
                    else { timerElement.textContent = formatDuration(remainingTime); }
                }
                if (session.type === 'open') {
                    const costElement = document.getElementById(`cost-${c.id}`);
                    if (costElement) {
                        const elapsedTimeMs = now - session.startTime - (session.totalPausedDuration || 0);
                        const elapsedMinutes = Math.ceil(elapsedTimeMs / (1000 * 60));
                        costElement.textContent = formatCurrency(calculateCost(c.type, elapsedMinutes));
                    }
                }
            }
        });
    }

    function pauseSession(consoleId) {
        const console = findConsole(consoleId);
        if (!console || console.status !== 'in-use' || !console.session) return;
        const now = new Date().getTime();
        const session = console.session;
        if (session.type === 'open') {
            const elapsedTime = now - session.startTime - (session.totalPausedDuration || 0);
            session.frozenTimeDisplay = formatDuration(elapsedTime);
            session.frozenElapsedTime = elapsedTime;
        } else {
            const remainingTime = session.endTime - now;
            session.frozenTimeDisplay = formatDuration(remainingTime);
        }
        console.status = 'paused';
        console.session.pauseTime = now;
        saveAndRender();
    }

    function resumeSession(consoleId) {
        const console = findConsole(consoleId);
        if (!console || console.status !== 'paused' || !console.session) return;
        const pausedDuration = new Date().getTime() - console.session.pauseTime;
        console.session.totalPausedDuration = (console.session.totalPausedDuration || 0) + pausedDuration;
        if (console.session.type === 'paket') {
            console.session.endTime += pausedDuration;
        }
        console.status = 'in-use';
        console.session.pauseTime = null;
        console.session.frozenTimeDisplay = null;
        console.session.frozenElapsedTime = null;
        saveAndRender();
    }

    function stopSession(consoleId) {
        const console = findConsole(consoleId);
        if (!console || !console.session) return;
        if (console.status === 'paused') {
            alert('Sesi sedang dijeda. Lanjutkan dulu sebelum menghentikannya.');
            return;
        }
        const session = console.session;
        let rentalCost = 0, durationMs;
        if (session.type === 'paket') {
            rentalCost = session.totalPaketCost; 
            durationMs = new Date().getTime() - session.startTime - (session.totalPausedDuration || 0);
        } else {
            const endTime = new Date().getTime();
            durationMs = endTime - session.startTime - (session.totalPausedDuration || 0);
            rentalCost = calculateCost(console.type, Math.ceil(durationMs / 60000));
        }
        const orderCost = (session.orders || []).reduce((sum, order) => sum + (order.price * order.quantity), 0);
        const totalCost = rentalCost + orderCost;
        saveToHistory(console, session, rentalCost, orderCost, totalCost, durationMs);
        alert(`Sesi Selesai!\n\nBiaya Sewa: ${formatCurrency(rentalCost)}\nBiaya Pesanan: ${formatCurrency(orderCost)}\n---------------------------\nTOTAL BIAYA: ${formatCurrency(totalCost)}`);
        resetConsole(console);
    }
    
    function saveToHistory(console, session, rentalCost, orderCost, totalCost, actualDurationMs) {
        const history = JSON.parse(localStorage.getItem('history')) || [];
        const now = new Date();
        history.push({ 
            date: now.toISOString().split('T')[0], consoleName: console.name, startTime: new Date(session.startTime).toLocaleTimeString('id-ID'),
            endTime: now.toLocaleTimeString('id-ID'), durationMinutes: Math.ceil(actualDurationMs / 60000), rentalCost, orderCost, totalCost, 
            orders: session.orders, billingInfo: session.billingInfo, notes: session.notes,
        });
        localStorage.setItem('history', JSON.stringify(history));
    }
    
    function resetConsole(console) {
        console.status = 'available';
        console.session = null;
        saveAndRender();
    }
    
    consoleList.addEventListener('click', e => {
        const card = e.target.closest('.console-card');
        if (!card) return;
        const consoleId = card.dataset.id;
        const console = findConsole(consoleId);
        if (!console) return;

        if (e.target.matches('.btn-start')) {
            const select = modals.start.querySelector('#billing-type');
            select.innerHTML = '';
            const defaultDurations = [60, 120];
            defaultDurations.forEach(minutes => {
                const hours = minutes / 60;
                const price = PRICES[console.type] * hours;
                const option = document.createElement('option');
                option.value = `default_${minutes}`; 
                option.textContent = `Main ${hours} Jam - ${formatCurrency(price)}`;
                select.appendChild(option);
            });
            const customPackages = JSON.parse(localStorage.getItem('customPackages')) || [];
            const availablePackages = customPackages.filter(p => p.consoleType === console.type);
            if (availablePackages.length > 0) {
                const separator = document.createElement('option');
                separator.disabled = true; separator.textContent = '--- Paket Kustom/Promo ---';
                select.appendChild(separator);
                availablePackages.forEach(paket => {
                    const option = document.createElement('option');
                    option.value = paket.id;
                    option.textContent = `${paket.name} (${paket.durationMinutes} mnt) - ${formatCurrency(paket.price)}`;
                    select.appendChild(option);
                });
            }
            const openOption = document.createElement('option');
            openOption.value = 'open'; openOption.textContent = 'OPEN (Bebas)';
            select.appendChild(openOption);
            modals.start.querySelector('#modal-console-name').textContent = console.name;
            modals.start.querySelector('#modal-console-id').value = console.id;
            modals.start.style.display = 'block';
        } else if (e.target.matches('.btn-pause')) { pauseSession(consoleId); }
        else if (e.target.matches('.btn-resume')) { resumeSession(consoleId); }
        else if (e.target.matches('.btn-stop')) { stopSession(consoleId); }
        else if (e.target.matches('.btn-delete-order')) { 
            const orderIndex = parseInt(e.target.dataset.orderIndex, 10); 
            if (console.session && confirm(`Hapus pesanan "${console.session.orders[orderIndex].name} x ${console.session.orders[orderIndex].quantity}"?`)) { 
                console.session.orders.splice(orderIndex, 1); saveAndRender(); 
            } 
        } else if (e.target.matches('.btn-add-time')) { 
            modals.addTime.querySelector('#add-time-console-name').textContent = console.name; 
            modals.addTime.querySelector('#add-time-console-id').value = console.id; 
            modals.addTime.style.display = 'block'; 
        } else if (e.target.matches('.btn-edit-note')) { 
            modals.note.querySelector('#note-console-name').textContent = console.name; 
            modals.note.querySelector('#note-console-id').value = console.id; 
            modals.note.querySelector('#console-note').value = console.session.notes || ''; 
            modals.note.style.display = 'block'; 
        } else if (e.target.matches('.btn-add-order')) { 
            const select = modals.order.querySelector('#menu-item-select'); 
            select.innerHTML = '<option value="" disabled selected>-- Pilih Item --</option>'; 
            if (menuItems.length > 0) { 
                menuItems.forEach(item => { const o = document.createElement('option'); o.value = item.id; o.textContent = `${item.name} - ${formatCurrency(item.price)}`; select.appendChild(o); }); 
            } else { select.innerHTML = '<option value="">Menu kosong</option>'; } 
            modals.order.querySelector('#order-console-name').textContent = console.name; 
            modals.order.querySelector('#order-console-id').value = console.id; 
            modals.order.querySelector('#item-quantity').value = 1; 
            modals.order.style.display = 'block'; 
        }
    });

    modals.start.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const form = e.target;
        const consoleId = form.querySelector('#modal-console-id').value;
        const billingChoice = form.querySelector('#billing-type').value;
        if (!billingChoice) { alert('Silakan pilih paket.'); return; }
        const console = findConsole(consoleId);
        console.status = 'in-use';
        const now = new Date().getTime();
        const customPackages = JSON.parse(localStorage.getItem('customPackages')) || [];
        const selectedPackage = customPackages.find(p => p.id === billingChoice);
        let sessionData = { startTime: now, notes: '', orders: [], totalPausedDuration: 0 };
        if (billingChoice.startsWith('default_')) {
            const duration = parseInt(billingChoice.split('_')[1], 10);
            Object.assign(sessionData, { type: 'paket', totalPaketMinutes: duration, totalPaketCost: PRICES[console.type] * (duration / 60), endTime: now + duration * 60000, billingInfo: `Main ${duration/60} Jam` });
        } else if (selectedPackage) {
            Object.assign(sessionData, { type: 'paket', totalPaketMinutes: selectedPackage.durationMinutes, totalPaketCost: selectedPackage.price, endTime: now + selectedPackage.durationMinutes * 60000, billingInfo: selectedPackage.name });
        } else if (billingChoice === 'open') {
            Object.assign(sessionData, { type: 'open', billingInfo: 'OPEN' });
        } else {
            alert('Paket tidak valid.'); console.status = 'available'; return;
        }
        console.session = sessionData;
        saveAndRender();
        modals.start.style.display = 'none';
        form.reset();
    });

    modals.addTime.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const form = e.target, consoleId = form.querySelector('#add-time-console-id').value;
        const additionalMinutes = parseInt(form.querySelector('#additional-time').value, 10);
        const console = findConsole(consoleId);
        if (console && console.status === 'in-use' && console.session.type === 'paket') {
            const now = new Date().getTime();
            const baseTime = console.session.endTime > now ? console.session.endTime : now;
            console.session.endTime = baseTime + additionalMinutes * 60000;
            console.session.totalPaketMinutes += additionalMinutes;
            console.session.totalPaketCost += PRICES[console.type] * (additionalMinutes / 60);
            saveAndRender();
        }
        modals.addTime.style.display = 'none';
    });

    modals.order.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const form = e.target, consoleId = form.querySelector('#order-console-id').value;
        const selectedItemId = form.querySelector('#menu-item-select').value;
        const quantity = parseInt(form.querySelector('#item-quantity').value, 10);
        const console = findConsole(consoleId), selectedItem = menuItems.find(item => item.id === selectedItemId);
        if (console && console.session && selectedItem && quantity > 0) {
            const existingOrder = console.session.orders.find(order => order.id === selectedItemId);
            if (existingOrder) { existingOrder.quantity += quantity; }
            else { console.session.orders.push({ ...selectedItem, quantity }); }
            saveAndRender();
        }
        modals.order.style.display = 'none';
        form.reset();
    });
    
    function calculateCost(type, durationMinutes) { return Math.round((PRICES[type] / 60) * durationMinutes); }
    function saveAndRender() { localStorage.setItem('consoles', JSON.stringify(consoles)); renderConsoles(); }
    function findConsole(id) { return consoles.find(c => c.id === id); }
    function formatDuration(ms) { if (ms < 0) ms = 0; const t = Math.floor(ms / 1e3), e = Math.floor(t / 3600), o = Math.floor(t % 3600 / 60); return `${String(e).padStart(2, "0")}:${String(o).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}` }
    function formatCurrency(amount) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount) }
    modals.note.querySelector("form").addEventListener("submit", e => { e.preventDefault(); const t = e.target, o = t.querySelector("#note-console-id").value, n = t.querySelector("#console-note").value, s = findConsole(o); s && s.session && (s.session.notes = n, saveAndRender()), modals.note.style.display = "none" });
    Object.values(modals).forEach(m => { if(m) { const btn = m.querySelector(".close-btn"); if (btn) btn.onclick = () => { m.style.display = "none" } } });
    window.onclick = e => { if (e.target.classList.contains("modal")) { e.target.style.display = "none" } };

    initialize();
});