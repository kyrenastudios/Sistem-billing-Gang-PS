document.addEventListener('DOMContentLoaded', () => {
    // Definisi Elemen DOM
    const form = document.getElementById('paket-form');
    const formTitle = document.getElementById('form-title');
    const paketIdInput = document.getElementById('paket-id');
    const paketNameInput = document.getElementById('paket-name');
    const paketDurationInput = document.getElementById('paket-duration');
    const paketPriceInput = document.getElementById('paket-price');
    const paketConsoleTypeInput = document.getElementById('paket-console-type');
    const submitBtn = document.getElementById('submit-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const tableBody = document.getElementById('paket-list-body');

    // Pastikan semua elemen penting ditemukan
    if (!form || !tableBody || !cancelBtn) {
        console.error("Elemen penting di halaman 'Kelola Paket' tidak ditemukan. Periksa file paket.html Anda.");
        return;
    }

    let customPackages = JSON.parse(localStorage.getItem('customPackages')) || [];

    function savePackages() {
        localStorage.setItem('customPackages', JSON.stringify(customPackages));
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    }

    function renderPaket() {
        tableBody.innerHTML = '';
        customPackages.forEach(paket => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${paket.name}</td>
                <td>${paket.consoleType}</td>
                <td>${paket.durationMinutes} menit</td>
                <td>${formatCurrency(paket.price)}</td>
                <td>
                    <button class="btn-edit-note btn-edit" data-id="${paket.id}">Edit</button>
                    <button class="btn-stop btn-delete" data-id="${paket.id}">Hapus</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    function resetForm() {
        form.reset();
        paketIdInput.value = '';
        formTitle.textContent = 'Tambah Paket Baru';
        submitBtn.textContent = 'Simpan Paket';
        cancelBtn.style.display = 'none';
        paketNameInput.focus();
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = paketIdInput.value;
        const newPaketData = {
            name: paketNameInput.value,
            durationMinutes: parseInt(paketDurationInput.value, 10),
            price: parseInt(paketPriceInput.value, 10),
            consoleType: paketConsoleTypeInput.value,
        };

        if (id) { // Mode Edit
            const index = customPackages.findIndex(p => p.id === id);
            if (index !== -1) {
                customPackages[index] = { ...customPackages[index], ...newPaketData };
            }
        } else { // Mode Tambah Baru
            newPaketData.id = `pkg_${new Date().getTime()}`;
            customPackages.push(newPaketData);
        }

        savePackages();
        renderPaket();
        resetForm();
    });

    // [DIUBAH] Perbaikan kecil di sini
    tableBody.addEventListener('click', (e) => {
        const target = e.target;
        // Pindahkan `id` ke sini agar terdefinisi dengan baik
        const id = target.dataset.id;
        if (!id) return; // Keluar jika yang diklik bukan tombol dengan data-id

        if (target.classList.contains('btn-delete')) {
            if (confirm('Anda yakin ingin menghapus paket ini?')) {
                customPackages = customPackages.filter(p => p.id !== id);
                savePackages();
                renderPaket();
            }
        }

        if (target.classList.contains('btn-edit')) {
            const paketToEdit = customPackages.find(p => p.id === id);
            if (paketToEdit) {
                paketIdInput.value = paketToEdit.id;
                paketNameInput.value = paketToEdit.name;
                paketDurationInput.value = paketToEdit.durationMinutes;
                paketPriceInput.value = paketToEdit.price;
                paketConsoleTypeInput.value = paketToEdit.consoleType;
                
                formTitle.textContent = 'Edit Paket';
                submitBtn.textContent = 'Update Paket';
                cancelBtn.style.display = 'inline-block';
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    });
    
    cancelBtn.addEventListener('click', resetForm);

    renderPaket();
});