document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('add-menu-item-form');
    const tableBody = document.getElementById('menu-list-body');
    const noMenuItemsMessage = document.getElementById('no-menu-items');

    //======== API & Cache ========
    const MENU_API_URL = 'api/menu.php';
    let menuItems = JSON.parse(localStorage.getItem('menuItems')) || [];

    function saveMenuCache() {
        localStorage.setItem('menuItems', JSON.stringify(menuItems));
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }

    //======== Tampilan ========
    function renderMenu() {
        tableBody.innerHTML = '';

        if (menuItems.length === 0) {
            noMenuItemsMessage.style.display = 'block';
            tableBody.style.display = 'none';
        } else {
            noMenuItemsMessage.style.display = 'none';
            tableBody.style.display = '';

            menuItems.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.name}</td>
                    <td>${formatCurrency(item.price)}</td>
                    <td><button class="btn-stop btn-delete" data-id="${item.id}">Hapus</button></td>
                `;
                tableBody.appendChild(row);
            });
        }
    }

    //======== Load dari MySQL ========
    async function loadMenuFromAPI() {
        try {
            const response = await fetch(MENU_API_URL, {
                method: 'GET',
                cache: 'no-store'
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Gagal mengambil menu.');
            }

            menuItems = Array.isArray(result.data) ? result.data : [];
            saveMenuCache();
            renderMenu();
        } catch (error) {
            console.warn('MySQL API tidak tersedia. Menggunakan cache localStorage.', error);
            renderMenu();
        }
    }

    //======== Tambah Menu ========
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('new-item-name').value.trim();
        const price = parseInt(document.getElementById('new-item-price').value, 10);

        if (!name || Number.isNaN(price) || price < 0) {
            alert('Nama dan harga menu harus diisi dengan benar.');
            return;
        }

        try {
            const response = await fetch(MENU_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, price })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Gagal menambahkan menu.');
            }

            menuItems.push(result.data);
            saveMenuCache();
            renderMenu();
            form.reset();
        } catch (error) {
            console.error('Gagal menyimpan menu ke MySQL:', error);
            alert(error.message || 'Menu gagal disimpan ke database.');
        }
    });

    //======== Hapus Menu ========
    tableBody.addEventListener('click', async (e) => {
        if (!e.target.classList.contains('btn-delete')) {
            return;
        }

        const itemId = e.target.dataset.id;

        const confirmed = await window.gangPsConfirm(
            'Anda yakin ingin menghapus item ini dari menu?',
            'Hapus Menu'
        );
        if (!confirmed) return;

        try {
            const response = await fetch(`${MENU_API_URL}?id=${encodeURIComponent(itemId)}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Gagal menghapus menu.');
            }

            menuItems = menuItems.filter(item => item.id !== itemId);
            saveMenuCache();
            renderMenu();
        } catch (error) {
            console.error('Gagal menghapus menu dari MySQL:', error);
            alert(error.message || 'Menu gagal dihapus dari database.');
        }
    });

    //======== Tampilkan Cache Dulu, lalu Sinkronisasi MySQL ========
    renderMenu();
    loadMenuFromAPI();
});