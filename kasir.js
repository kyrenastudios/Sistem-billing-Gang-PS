document.addEventListener('DOMContentLoaded', () => {
    // Definisi elemen DOM
    const form = document.getElementById('kasir-form');
    const selectMenu = document.getElementById('kasir-item-select');
    const quantityInput = document.getElementById('kasir-item-quantity');
    const cartList = document.getElementById('kasir-cart-list');
    const totalElement = document.getElementById('kasir-total');
    const checkoutBtn = document.getElementById('checkout-btn');

    // Ambil data menu dari localStorage
    const menuItems = JSON.parse(localStorage.getItem('menuItems')) || [];
    
    // MODIFIKASI: Inisialisasi keranjang dari localStorage, atau array kosong jika tidak ada
    let cashierCart = JSON.parse(localStorage.getItem('cashierCart')) || [];

    // Fungsi format mata uang
    function formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    }

    // Fungsi untuk memuat item menu ke dalam dropdown
    function loadMenuItems() {
        selectMenu.innerHTML = '<option value="" disabled selected>-- Pilih Item --</option>';
        if (menuItems.length > 0) {
            menuItems.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = `${item.name} - ${formatCurrency(item.price)}`;
                selectMenu.appendChild(option);
            });
        } else {
            selectMenu.innerHTML = '<option value="">Menu kosong, harap isi di halaman Menu</option>';
        }
    }

    // (wireSelectFilter removed)

    // Create in-place searchable select for kasir page
    function createSearchableSelect(selectElement) {
        if (!selectElement) return;
        if (selectElement.dataset.searchable === '1') return;
        selectElement.dataset.searchable = '1';
        selectElement.style.display = 'none';

        const container = document.createElement('div');
        container.className = 'searchable-select-container';
        container.style.position = 'relative';
        container.style.display = 'inline-block';
        container.style.width = selectElement.style.width || '100%';
        selectElement.parentNode.insertBefore(container, selectElement);
        container.appendChild(selectElement);

        const input = document.createElement('input');
        input.type = 'text'; input.className = 'searchable-select-input'; input.style.width = '100%'; input.style.padding = '6px 8px'; input.placeholder = 'Ketik untuk mencari...';
        container.insertBefore(input, selectElement);

        const dropdown = document.createElement('div');
        dropdown.style.position = 'absolute'; dropdown.style.left = '0'; dropdown.style.right = '0'; dropdown.style.top = '100%'; dropdown.style.maxHeight = '180px'; dropdown.style.overflow = 'auto'; dropdown.style.display = 'none'; dropdown.style.border = '1px solid #ccc'; dropdown.style.background = '#fff'; container.appendChild(dropdown);

        function buildList() {
            dropdown.innerHTML = '';
            const opts = Array.from(selectElement.options);
            opts.forEach(o => {
                // skip placeholder / disabled options
                if (o.disabled || (o.value || '').toString().trim() === '') return;
                const item = document.createElement('div'); item.dataset.value = o.value; item.textContent = o.textContent; item.style.padding = '6px 8px'; item.style.cursor = 'pointer'; dropdown.appendChild(item);
                item.addEventListener('mouseenter', () => item.style.background = '#f5f5f5');
                item.addEventListener('mouseleave', () => item.style.background = '');
                item.addEventListener('click', () => { selectElement.value = item.dataset.value; input.value = item.textContent; dropdown.style.display = 'none'; selectElement.dispatchEvent(new Event('change')); });
            });
            dropdown.dataset.highlight = '-1';
        }

        input.addEventListener('input', () => {
            const q = (input.value || '').trim().toLowerCase();
            const items = dropdown.querySelectorAll('div');
            let any = false;
            items.forEach(it => {
                const txt = (it.textContent || '').toLowerCase();
                const val = (it.dataset.value || '').toLowerCase();
                const match = q === '' || txt.includes(q) || val.includes(q);
                it.style.display = match ? 'block' : 'none';
                if (match) any = true;
            });
            dropdown.style.display = any ? 'block' : 'none';
            // reset highlight
            const prev = dropdown.querySelector('.highlighted'); if (prev) prev.classList.remove('highlighted'); dropdown.dataset.highlight = '-1';
        });

    input.addEventListener('focus', () => { buildList(); const sel = selectElement.selectedOptions[0]; if (sel && !input.value && (sel.value || '').toString().trim() !== '') input.value = sel.textContent; dropdown.style.display = 'block'; });
        
        function clearHighlight() { const prev = dropdown.querySelector('.highlighted'); if (prev) prev.classList.remove('highlighted'); dropdown.dataset.highlight = '-1'; }
        function highlightIndex(idx) {
            const items = Array.from(dropdown.querySelectorAll('div')).filter(n => n.style.display !== 'none');
            if (!items.length) return; if (idx < 0) idx = 0; if (idx >= items.length) idx = items.length - 1; clearHighlight(); const el = items[idx]; el.classList.add('highlighted'); dropdown.dataset.highlight = String(idx); const top = dropdown.scrollTop; const bottom = top + dropdown.clientHeight; const elTop = el.offsetTop; const elBottom = elTop + el.offsetHeight; if (elTop < top) dropdown.scrollTop = elTop; else if (elBottom > bottom) dropdown.scrollTop = elBottom - dropdown.clientHeight;
        }

        input.addEventListener('keydown', (ev) => {
            const visible = Array.from(dropdown.querySelectorAll('div')).filter(n => n.style.display !== 'none');
            if (ev.key === 'ArrowDown') { ev.preventDefault(); if (dropdown.style.display === 'none') { buildList(); dropdown.style.display = 'block'; } const cur = parseInt(dropdown.dataset.highlight || '-1', 10); highlightIndex(cur + 1); }
            else if (ev.key === 'ArrowUp') { ev.preventDefault(); const cur = parseInt(dropdown.dataset.highlight || '-1', 10); highlightIndex(cur - 1); }
            else if (ev.key === 'Enter') { ev.preventDefault(); const idx = parseInt(dropdown.dataset.highlight || '-1', 10); const items = Array.from(dropdown.querySelectorAll('div')).filter(n => n.style.display !== 'none'); if (idx >= 0 && items[idx]) { const item = items[idx]; selectElement.value = item.dataset.value; input.value = item.textContent; dropdown.style.display = 'none'; selectElement.dispatchEvent(new Event('change')); } else if (items.length === 1) { const item = items[0]; selectElement.value = item.dataset.value; input.value = item.textContent; dropdown.style.display = 'none'; selectElement.dispatchEvent(new Event('change')); } }
            else if (ev.key === 'Escape') { ev.preventDefault(); dropdown.style.display = 'none'; }
        });
        document.addEventListener('click', e => { if (!container.contains(e.target)) dropdown.style.display = 'none'; });
        const mo = new MutationObserver(buildList); mo.observe(selectElement, { childList: true });
        buildList(); const sel = selectElement.selectedOptions[0]; if (sel && (sel.value || '').toString().trim() !== '') input.value = sel.textContent;
    }

    // Fungsi untuk merender tampilan keranjang belanja
    function renderCart() {
        cartList.innerHTML = '';
        let totalCost = 0;

        if (cashierCart.length === 0) {
            cartList.innerHTML = '<li>Penjualan Masih kosong</li>';
        } else {
            cashierCart.forEach((item, index) => {
                const itemTotal = item.price * item.quantity;
                totalCost += itemTotal;
                const li = document.createElement('li');
                li.className = 'order-item';
                li.innerHTML = `
                    <span>${item.name} x ${item.quantity} - ${formatCurrency(itemTotal)}</span>
                    <button class="btn-delete-order" data-cart-index="${index}" title="Hapus Item">&times;</button>
                `;
                cartList.appendChild(li);
            });
        }
        totalElement.textContent = `Total: ${formatCurrency(totalCost)}`;
    }

    // Event listener untuk form penambahan item
    form.addEventListener('submit', e => {
        e.preventDefault();
        const selectedItemId = selectMenu.value;
        const quantity = parseInt(quantityInput.value, 10);
        const selectedItem = menuItems.find(item => item.id === selectedItemId);

        if (selectedItem && quantity > 0) {
            const existingItem = cashierCart.find(item => item.id === selectedItemId);
            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                cashierCart.push({ ...selectedItem, quantity });
            }
            
            // BARIS BARU: Simpan ke localStorage setiap kali menambah item
            localStorage.setItem('cashierCart', JSON.stringify(cashierCart));
            
            renderCart();
        }
        form.reset();
        quantityInput.value = 1;
    });

    // Event listener untuk menghapus item dari Order
    cartList.addEventListener('click', e => {
        if (e.target.matches('.btn-delete-order')) {
            const cartIndex = parseInt(e.target.dataset.cartIndex, 10);
            cashierCart.splice(cartIndex, 1);
            
            // BARIS BARU: Simpan ke localStorage setiap kali menghapus item
            localStorage.setItem('cashierCart', JSON.stringify(cashierCart));
            
            renderCart();
        }
    });

    // Event listener untuk tombol checkout
    checkoutBtn.addEventListener('click', () => {
        if (cashierCart.length === 0) {
            alert('Pesanan Kosong!');
            return;
        }

        const orderCost = cashierCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const history = JSON.parse(localStorage.getItem('history')) || [];
        const now = new Date();

        history.push({
            date: now.toISOString().split('T')[0],
            consoleName: 'Penjualan Langsung',
            startTime: now.toLocaleTimeString('id-ID'),
            endTime: now.toLocaleTimeString('id-ID'),
            durationMinutes: 0,
            rentalCost: 0,
            orderCost: orderCost,
            totalCost: orderCost,
            orders: cashierCart,
            notes: 'Histori kasir',
        });
        localStorage.setItem('history', JSON.stringify(history));

        alert(`Histori berhasil dicatat!\nTotal Penjualan: ${formatCurrency(orderCost)}`);
        
        // Reset Order setelah Histori selesai
        cashierCart = [];
        
        // BARIS BARU: Hapus juga dari localStorage setelah checkout berhasil
        localStorage.removeItem('cashierCart');

        renderCart();
    });

    // Inisialisasi halaman
    // note: separate search input removed; createSearchableSelect is used for in-place searching

    loadMenuItems();

    // create searchable select after loading options
    try { createSearchableSelect(selectMenu); } catch (e) { }

    renderCart(); // <- renderCart di sini akan otomatis menampilkan data dari localStorage
});