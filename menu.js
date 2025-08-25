document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('add-menu-item-form');
    const tableBody = document.getElementById('menu-list-body');
    const noMenuItemsMessage = document.getElementById('no-menu-items');
    
    let menuItems = JSON.parse(localStorage.getItem('menuItems')) || [];

    function saveMenu() {
        localStorage.setItem('menuItems', JSON.stringify(menuItems));
    }
    
    function formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    }

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

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('new-item-name').value;
        const price = parseInt(document.getElementById('new-item-price').value, 10);

        menuItems.push({
            id: `item-${Date.now()}`,
            name: name,
            price: price
        });

        saveMenu();
        renderMenu();
        form.reset();
    });

    tableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-delete')) {
            const itemId = e.target.dataset.id;
            if (confirm('Anda yakin ingin menghapus item ini dari menu?')) {
                menuItems = menuItems.filter(item => item.id !== itemId);
                saveMenu();
                renderMenu();
            }
        }
    });

    renderMenu();
});