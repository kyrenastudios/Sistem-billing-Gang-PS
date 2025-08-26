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
    let cashierCart = [];

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
        renderCart();
    });

    // Inisialisasi halaman
    loadMenuItems();
    renderCart();
});