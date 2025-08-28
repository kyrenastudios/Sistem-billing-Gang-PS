document.addEventListener('DOMContentLoaded', () => {
    // Harga per jam (dalam Rupiah)
    const PRICES = {
        PS3: 5000,
        PS4: 8000,
        PS5: 13000,
    };

    // Definisikan semua paket spesial atau promo di sini
    const SPECIAL_PACKAGES = [
        {
            id: 'ps5_promo_3jam',          // ID unik untuk paket ini
            name: 'Paket Spesial 3 Jam',  // Nama yang akan tampil di pilihan
            consoleType: 'PS5',           // Hanya berlaku untuk PS5
            durationMinutes: 180,         // Durasi dalam menit (3 jam)
            price: 30000                  // Harga spesialnya
        },
    ];

    // Definisi Elemen DOM
    const consoleList = document.getElementById('console-list');
    const noConsolesMessage = document.getElementById('no-consoles-message');
    const modals = {
        start: document.getElementById('start-session-modal'),
        addTime: document.getElementById('add-time-modal'),
        note: document.getElementById('note-modal'),
        order: document.getElementById('order-modal'),
    };
    let consoles = [];
    let menuItems = [];

    // --- FUNGSI UTAMA & TAMPILAN ---

    function initialize() {
        const savedConsoles = JSON.parse(localStorage.getItem('consoles'));
        menuItems = JSON.parse(localStorage.getItem('menuItems')) || [];
        if (savedConsoles && savedConsoles.length > 0) {
            consoles = savedConsoles;
            renderConsoles();
            setInterval(updateTimers, 1000);
        } else {
            consoleList.style.display = 'none';
            noConsolesMessage.style.display = 'block';
        }
    }
    
    // [DIUBAH] Render consoles sekarang menampilkan waktu yang dibekukan saat pause
    function renderConsoles() {
        consoleList.innerHTML = '';
        if (!consoles || consoles.length === 0) {
            consoleList.style.display = 'none';
            noConsolesMessage.style.display = 'block';
            return;
        }
        consoles.forEach(console => {
            const card = document.createElement('div');
            card.className = `console-card ${console.status}`;
            card.dataset.id = console.id;
            let detailsHTML = '', actionsHTML = '';

            if (console.status === 'in-use' || console.status === 'paused') {
                const session = console.session;
                const timerId = `timer-${console.id}`;
                const billingTypeDisplay = session.type === 'open' ? 'OPEN' : `Paket (Total ${session.totalPaketMinutes / 60} Jam - ${formatCurrency(session.totalPaketCost)})`;
                const realTimeCostHTML = session.type === 'open' ? `<p>Biaya Saat Ini: <span class="realtime-cost" id="cost-${console.id}">${formatCurrency(calculateCost(console.type, Math.ceil(((session.frozenElapsedTime || 0)) / 60000)))}</span></p>` : '';
                const notesDisplay = session.notes ? `<div class="session-details"><strong class="notes-display">Catatan:</strong> ${session.notes}</div>` : '';
                let ordersDisplay = '';
                if (session.orders && session.orders.length > 0) {
                    const orderItems = session.orders.map((o, index) => `<li class="order-item"><span>${o.name} x ${o.quantity} - ${formatCurrency(o.price * o.quantity)}</span><button class="btn-delete-order" data-order-index="${index}" title="Hapus Pesanan" ${console.status === 'paused' ? 'disabled' : ''}>&times;</button></li>`).join('');
                    ordersDisplay = `<div class="session-details"><strong>Pesanan:</strong><ul>${orderItems}</ul></div>`;
                }

                // Tentukan waktu yang akan ditampilkan
                let timerDisplay = '00:00:00';
                if(console.status === 'paused') {
                    timerDisplay = session.frozenTimeDisplay || '00:00:00';
                }
                
                if (console.status === 'in-use') {
                    detailsHTML = `<p class="status in-use">SEDANG DIGUNAKAN</p>`;
                    actionsHTML = `<button class="btn-stop">Stop Sesi</button><button class="btn-pause" style="background-color: #ff9800;">Pause</button> ${session.type !== 'open' ? `<button class="btn-add-time">Tambah Waktu</button>` : ''}<button class="btn-edit-note">Catatan</button><button class="btn-add-order">Tambah Pesanan</button>`;
                } else { // status === 'paused'
                    detailsHTML = `<p class="status" style="color:#2196f3; font-weight:bold;">DIJEDA (PAUSED)</p>`;
                    actionsHTML = `<button class="btn-stop" disabled>Stop Sesi</button><button class="btn-resume" style="background-color: #4caf50;">Lanjutkan</button> ${session.type !== 'open' ? `<button class="btn-add-time" disabled>Tambah Waktu</button>` : ''}<button class="btn-edit-note" disabled>Catatan</button><button class="btn-add-order" disabled>Tambah Pesanan</button>`;
                }
                detailsHTML += `<div class="timer" id="${timerId}">${timerDisplay}</div><p>Tipe: ${billingTypeDisplay}</p>${realTimeCostHTML}${notesDisplay}${ordersDisplay}`;
            } else { // status === 'available'
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
            if (c.status === 'in-use') {
                const timerElement = document.getElementById(`timer-${c.id}`);
                if (!timerElement) return;
                const session = c.session;
                if (session.type === 'open') {
                    const elapsedTime = now - session.startTime - (session.totalPausedDuration || 0);
                    timerElement.textContent = formatDuration(elapsedTime);
                } else {
                    const remainingTime = session.endTime - now;
                    if (remainingTime <= 0) {
                        timerElement.textContent = "WAKTU HABIS";
                        timerElement.style.color = "red";
                    } else {
                        timerElement.textContent = formatDuration(remainingTime);
                    }
                }
                if (session.type === 'open') {
                    const costElement = document.getElementById(`cost-${c.id}`);
                    if (costElement) {
                        const elapsedTimeMs = now - session.startTime - (session.totalPausedDuration || 0);
                        const elapsedMinutes = Math.ceil(elapsedTimeMs / (1000 * 60));
                        const currentCost = calculateCost(c.type, elapsedMinutes);
                        costElement.textContent = formatCurrency(currentCost);
                    }
                }
            }
        });
    }

    // --- FUNGSI MANAJEMEN SESI ---

    // [DIUBAH] Fungsi pause sekarang menyimpan waktu terakhir di layar
    function pauseSession(consoleId) {
        const console = findConsole(consoleId);
        if (!console || console.status !== 'in-use') return;
        
        const now = new Date().getTime();
        const session = console.session;

        // Simpan waktu yang ditampilkan saat ini sebelum di-pause
        if (session.type === 'open') {
            const elapsedTime = now - session.startTime - (session.totalPausedDuration || 0);
            session.frozenTimeDisplay = formatDuration(elapsedTime);
            session.frozenElapsedTime = elapsedTime; // Simpan juga waktu mentahnya untuk biaya
        } else { // tipe paket
            const remainingTime = session.endTime - now;
            session.frozenTimeDisplay = formatDuration(remainingTime);
        }

        console.status = 'paused';
        console.session.pauseTime = now; // Catat waktu pause
        saveAndRender();
    }

    // [DIUBAH] Fungsi resume sekarang membersihkan waktu yang disimpan
    function resumeSession(consoleId) {
        const console = findConsole(consoleId);
        if (!console || console.status !== 'paused') return;
        
        const pausedDuration = new Date().getTime() - console.session.pauseTime;
        console.session.totalPausedDuration = (console.session.totalPausedDuration || 0) + pausedDuration;

        if (console.session.type === 'paket') {
            console.session.endTime += pausedDuration;
        }

        console.status = 'in-use';
        console.session.pauseTime = null;
        console.session.frozenTimeDisplay = null; // Hapus waktu yang dibekukan
        console.session.frozenElapsedTime = null;
        saveAndRender();
    }
    
    // ... Sisa kode tidak ada perubahan, namun tetap disertakan secara penuh ...
    
    function stopSession(consoleId) {
        const console = findConsole(consoleId);
        if (!console || !console.session) return;
        if (console.status === 'paused') {
            alert('Sesi sedang dijeda. Harap lanjutkan sesi terlebih dahulu sebelum menghentikannya.');
            return;
        }

        const session = console.session;
        let rentalCost = 0;
        let durationMs;
        if (session.type === 'paket') {
            rentalCost = session.totalPaketCost; 
            durationMs = new Date().getTime() - session.startTime - (session.totalPausedDuration || 0);
        } else {
            const endTime = new Date().getTime();
            durationMs = endTime - session.startTime - (session.totalPausedDuration || 0);
            const durationMinutes = Math.ceil(durationMs / (1000 * 60));
            rentalCost = calculateCost(console.type, durationMinutes);
        }
        const orderCost = session.orders.reduce((sum, order) => sum + (order.price * order.quantity), 0);
        const totalCost = rentalCost + orderCost;
        
        saveToHistory(console, session, rentalCost, orderCost, totalCost, durationMs);
        alert(`Sesi Selesai!\n\nBiaya Sewa: ${formatCurrency(rentalCost)}\nBiaya Pesanan: ${formatCurrency(orderCost)}\n---------------------------\nTOTAL BIAYA: ${formatCurrency(totalCost)}`);
        resetConsole(console);
    }
    
    function saveToHistory(console, session, rentalCost, orderCost, totalCost, actualDurationMs) {
        const history = JSON.parse(localStorage.getItem('history')) || [];
        const now = new Date();
        const durationMinutes = Math.ceil(actualDurationMs / (1000 * 60));
        history.push({ 
            date: now.toISOString().split('T')[0],
            consoleName: console.name,
            startTime: new Date(session.startTime).toLocaleTimeString('id-ID'),
            endTime: now.toLocaleTimeString('id-ID'),
            durationMinutes,
            rentalCost, orderCost, totalCost, 
            orders: session.orders,
            billingInfo: session.billingInfo,
            notes: session.notes,
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

        if (e.target.matches('.btn-pause')) {
            pauseSession(consoleId);
        } else if (e.target.matches('.btn-resume')) {
            resumeSession(consoleId);
        } else if (e.target.matches('.btn-start')) {
            const select = modals.start.querySelector('#billing-type');
            select.innerHTML = `<option value="60">1 Jam</option><option value="120">2 Jam</option><option value="180">3 Jam</option><option value="240">4 Jam</option><option value="open">OPEN (Bebas)</option>`;
            const availablePromos = SPECIAL_PACKAGES.filter(p => p.consoleType === console.type);
            if (availablePromos.length > 0) {
                const separator = document.createElement('option');
                separator.disabled = true;
                separator.textContent = '--- PROMO ---';
                select.appendChild(separator);
                availablePromos.forEach(promo => {
                    const option = document.createElement('option');
                    option.value = promo.id;
                    option.textContent = `${promo.name} - ${formatCurrency(promo.price)}`;
                    select.appendChild(option);
                });
            }
            modals.start.querySelector('#modal-console-name').textContent = console.name;
            modals.start.querySelector('#modal-console-id').value = console.id;
            modals.start.style.display = 'block';
        } else if (e.target.matches('.btn-stop')) { 
            stopSession(consoleId); 
        } else if (e.target.matches('.btn-delete-order')) { 
            const orderIndex = parseInt(e.target.dataset.orderIndex, 10); 
            if (confirm(`Anda yakin ingin menghapus pesanan "${console.session.orders[orderIndex].name} x ${console.session.orders[orderIndex].quantity}"?`)) { 
                console.session.orders.splice(orderIndex, 1); 
                saveAndRender(); 
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
            } else { 
                select.innerHTML = '<option value="">Menu kosong</option>'; 
            } 
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
        const console = findConsole(consoleId);
        console.status = 'in-use';
        const now = new Date().getTime();
        const promo = SPECIAL_PACKAGES.find(p => p.id === billingChoice);
        let sessionData = { startTime: now, notes: '', orders: [], totalPausedDuration: 0 };
        if (promo) {
            Object.assign(sessionData, { type: 'paket', totalPaketMinutes: promo.durationMinutes, totalPaketCost: promo.price, endTime: now + promo.durationMinutes * 60 * 1000, billingInfo: promo.name });
        } else if (billingChoice === 'open') {
            Object.assign(sessionData, { type: 'open', billingInfo: 'OPEN' });
        } else {
            const duration = parseInt(billingChoice, 10);
            Object.assign(sessionData, { type: 'paket', totalPaketMinutes: duration, totalPaketCost: PRICES[console.type] * (duration / 60), endTime: now + duration * 60 * 1000, billingInfo: `Paket ${duration/60} Jam` });
        }
        console.session = sessionData;
        saveAndRender();
        modals.start.style.display = 'none';
        form.reset();
    });

    modals.addTime.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const form = e.target;
        const consoleId = form.querySelector('#add-time-console-id').value;
        const additionalMinutes = parseInt(form.querySelector('#additional-time').value, 10);
        const console = findConsole(consoleId);
        if (console && console.status === 'in-use' && console.session.type === 'paket') {
            const now = new Date().getTime();
            const baseTime = console.session.endTime > now ? console.session.endTime : now;
            console.session.endTime = baseTime + additionalMinutes * 60 * 1000;
            console.session.totalPaketMinutes += additionalMinutes;
            const addedCost = PRICES[console.type] * (additionalMinutes / 60);
            console.session.totalPaketCost += addedCost;
            saveAndRender();
        }
        modals.addTime.style.display = 'none';
    });

    modals.order.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const form = e.target;
        const consoleId = form.querySelector('#order-console-id').value;
        const selectedItemId = form.querySelector('#menu-item-select').value;
        const quantity = parseInt(form.querySelector('#item-quantity').value, 10);
        const console = findConsole(consoleId);
        const selectedItem = menuItems.find(item => item.id === selectedItemId);
        if (console && console.session && selectedItem && quantity > 0) {
            const existingOrder = console.session.orders.find(order => order.id === selectedItemId);
            if (existingOrder) {
                existingOrder.quantity += quantity;
            } else {
                console.session.orders.push({ id: selectedItem.id, name: selectedItem.name, price: selectedItem.price, quantity: quantity });
            }
            saveAndRender();
        }
        modals.order.style.display = 'none';
        form.reset();
    });
    
    // --- FUNGSI HELPER & LAIN-LAIN ---
    function calculateCost(type, durationMinutes) { return Math.round((PRICES[type] / 60) * durationMinutes); }
    function saveAndRender() { localStorage.setItem('consoles', JSON.stringify(consoles)); renderConsoles(); }
    function findConsole(id) { return consoles.find(c => c.id === id); }
    function formatDuration(ms) { if (ms < 0) ms = 0; const t = Math.floor(ms / 1e3), e = Math.floor(t / 3600), o = Math.floor(t % 3600 / 60); return `${String(e).padStart(2, "0")}:${String(o).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}` }
    function formatCurrency(amount) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount) }
    modals.note.querySelector("form").addEventListener("submit", e => { e.preventDefault(); const t = e.target, o = t.querySelector("#note-console-id").value, n = t.querySelector("#console-note").value, s = findConsole(o); s && s.session && (s.session.notes = n, saveAndRender()), modals.note.style.display = "none" });
    Object.values(modals).forEach(m => { m.querySelector(".close-btn").onclick = () => { m.style.display = "none" } });
    window.onclick = e => { if (e.target.classList.contains("modal")) { e.target.style.display = "none" } };

    initialize();
});