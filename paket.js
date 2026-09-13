document.addEventListener('DOMContentLoaded', async () => {
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
    const PACKAGES_API_URL = 'api/packages.php';

    if (!form || !tableBody || !cancelBtn) return;
    let customPackages = [];

    function formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    }

    function saveLocalCache() {
        localStorage.setItem('customPackages', JSON.stringify(customPackages));
    }

    function renderPaket() {
        tableBody.innerHTML = '';
        customPackages.forEach(paket => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${paket.name}</td><td>${paket.consoleType}</td><td>${paket.durationMinutes} menit</td><td>${formatCurrency(paket.price)}</td><td><button class="btn-edit-note btn-edit" data-id="${paket.id}">Edit</button> <button class="btn-stop btn-delete" data-id="${paket.id}">Hapus</button></td>`;
            tableBody.appendChild(row);
        });
    }

    function resetForm() {
        form.reset(); paketIdInput.value=''; formTitle.textContent='Tambah Paket Baru'; submitBtn.textContent='Simpan Paket'; cancelBtn.style.display='none'; paketNameInput.focus();
    }

    async function loadPackages() {
        const cached = JSON.parse(localStorage.getItem('customPackages')) || [];
        customPackages = cached;
        renderPaket();
        try {
            const response = await fetch(PACKAGES_API_URL, {cache:'no-store'});
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Gagal membaca paket.');
            customPackages = Array.isArray(result.data) ? result.data : [];
            saveLocalCache();
            renderPaket();
        } catch (error) {
            console.warn('MySQL packages tidak tersedia, menggunakan cache lokal.', error);
        }
    }

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const id = paketIdInput.value;
        const data = { id: id || undefined, name: paketNameInput.value.trim(), durationMinutes: parseInt(paketDurationInput.value,10), price: parseInt(paketPriceInput.value,10), consoleType: paketConsoleTypeInput.value };
        if (!data.name || !data.durationMinutes || data.durationMinutes < 1 || Number.isNaN(data.price) || data.price < 0) { alert('Data paket belum valid.'); return; }
        try {
            const response = await fetch(PACKAGES_API_URL, {method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Gagal menyimpan paket.');
            customPackages = result.data || [];
            saveLocalCache(); renderPaket(); resetForm();
        } catch(error) { console.error(error); alert(error.message || 'Paket gagal disimpan ke MySQL.'); }
    });

    tableBody.addEventListener('click', async e => {
        const target=e.target, id=target.dataset.id; if(!id) return;
        if(target.classList.contains('btn-delete')) {
            if(!confirm('Anda yakin ingin menghapus paket ini?')) return;
            try {
                const response=await fetch(`${PACKAGES_API_URL}?id=${encodeURIComponent(id)}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
                const result=await response.json(); if(!response.ok||!result.success) throw new Error(result.message||'Gagal menghapus paket.');
                customPackages=result.data||[]; saveLocalCache(); renderPaket();
            } catch(error){ alert(error.message||'Paket gagal dihapus dari MySQL.'); }
        }
        if(target.classList.contains('btn-edit')) {
            const paket=customPackages.find(p=>p.id===id); if(!paket)return;
            paketIdInput.value=paket.id; paketNameInput.value=paket.name; paketDurationInput.value=paket.durationMinutes; paketPriceInput.value=paket.price; paketConsoleTypeInput.value=paket.consoleType;
            formTitle.textContent='Edit Paket'; submitBtn.textContent='Update Paket'; cancelBtn.style.display='inline-block'; window.scrollTo({top:0,behavior:'smooth'});
        }
    });

    cancelBtn.addEventListener('click', resetForm);
    await loadPackages();
});