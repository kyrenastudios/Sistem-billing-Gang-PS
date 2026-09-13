document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('add-menu-item-form');
    const tableBody = document.getElementById('menu-list-body');
    const noMenuItemsMessage = document.getElementById('no-menu-items');
    const editOverlay = document.getElementById('menu-edit-overlay');
    const editForm = document.getElementById('edit-menu-form');
    const editName = document.getElementById('edit-item-name');
    const editPrice = document.getElementById('edit-item-price');
    const editCancel = document.getElementById('edit-menu-cancel');
    const editSave = document.getElementById('edit-menu-save');
    let editingItemId = null;

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
                    <td><div class="menu-action"><button class="btn-edit-menu" data-id="${item.id}">Edit</button><button class="btn-delete" data-id="${item.id}">Hapus</button></div></td>
                `;
                tableBody.appendChild(row);
            });
        }
    }

    //======== Modal Edit ========
    function openEditMenu(item) {
        editingItemId = item.id;
        editName.value = item.name;
        editPrice.value = item.price;
        editOverlay.style.display = 'flex';
        requestAnimationFrame(() => editName.focus());
    }

    function closeEditMenu() {
        editingItemId = null;
        editOverlay.style.display = 'none';
        editForm.reset();
    }

    editCancel.addEventListener('click', closeEditMenu);
    editOverlay.addEventListener('click', event => {
        if (event.target === editOverlay) closeEditMenu();
    });

    //======== Simpan Edit Menu ========
    editForm.addEventListener('submit', async e => {
        e.preventDefault();
        if (!editingItemId) return;

        const name = editName.value.trim();
        const price = parseInt(editPrice.value, 10);

        if (!name || Number.isNaN(price) || price < 0) {
            alert('Nama dan harga menu harus diisi dengan benar.');
            return;
        }

        editSave.disabled = true;
        try {
            const response = await fetch(`${MENU_API_URL}?id=${encodeURIComponent(editingItemId)}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name, price})
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Gagal memperbarui menu.');
            }

            const index = menuItems.findIndex(item => item.id === editingItemId);
            if (index !== -1) menuItems[index] = result.data;
            saveMenuCache();
            renderMenu();
            closeEditMenu();
        } catch (error) {
            console.error('Gagal memperbarui menu di MySQL:', error);
            alert(error.message || 'Menu gagal diperbarui.');
        } finally {
            editSave.disabled = false;
        }
    });

    //======== Load dari MySQL ========
    async function loadMenuFromAPI() {
        try {
            const response = await fetch(MENU_API_URL, {method: 'GET', cache: 'no-store'});
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Gagal mengambil menu.');
            menuItems = Array.isArray(result.data) ? result.data : [];
            saveMenuCache();
            renderMenu();
        } catch (error) {
            console.warn('MySQL API tidak tersedia. Menggunakan cache localStorage.', error);
            renderMenu();
        }
    }

    //======== Tambah Menu ========
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const name = document.getElementById('new-item-name').value.trim();
        const price = parseInt(document.getElementById('new-item-price').value, 10);

        if (!name || Number.isNaN(price) || price < 0) {
            alert('Nama dan harga menu harus diisi dengan benar.');
            return;
        }

        try {
            const response = await fetch(MENU_API_URL, {
                method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, price})
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Gagal menambahkan menu.');
            menuItems.push(result.data);
            saveMenuCache();
            renderMenu();
            form.reset();
        } catch (error) {
            console.error('Gagal menyimpan menu ke MySQL:', error);
            alert(error.message || 'Menu gagal disimpan ke database.');
        }
    });

    //======== Aksi Tabel ========
    tableBody.addEventListener('click', async e => {
        const editButton = e.target.closest('.btn-edit-menu');
        if (editButton) {
            const item = menuItems.find(menu => menu.id === editButton.dataset.id);
            if (item) openEditMenu(item);
            return;
        }

        const deleteButton = e.target.closest('.btn-delete');
        if (!deleteButton) return;

        const itemId = deleteButton.dataset.id;
        const confirmed = await window.gangPsConfirm('Anda yakin ingin menghapus item ini dari menu?', 'Hapus Menu');
        if (!confirmed) return;

        try {
            const response = await fetch(`${MENU_API_URL}?id=${encodeURIComponent(itemId)}`, {method: 'DELETE'});
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Gagal menghapus menu.');
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