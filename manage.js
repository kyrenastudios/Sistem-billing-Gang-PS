document.addEventListener('DOMContentLoaded', () => {
    const manageForm = document.getElementById('manage-form');
    const ps3Input = document.getElementById('ps3-count');
    const ps4Input = document.getElementById('ps4-count');
    const ps5Input = document.getElementById('ps5-count');
    const resetBtn = document.getElementById('reset-all-data-btn');
    const CONSOLES_API_URL = 'api/consoles.php';

    function loadCountsFromLocal() {
        const consoles = JSON.parse(localStorage.getItem('consoles')) || [];
        ps3Input.value = consoles.filter(c => c.type === 'PS3').length;
        ps4Input.value = consoles.filter(c => c.type === 'PS4').length;
        ps5Input.value = consoles.filter(c => c.type === 'PS5').length;
    }

    async function loadCurrentCounts() {
        loadCountsFromLocal();
        try {
            const response = await fetch(CONSOLES_API_URL, { cache: 'no-store' });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Gagal membaca consoles.');
            const consoles = Array.isArray(result.data) ? result.data : [];
            ps3Input.value = consoles.filter(c => c.type === 'PS3').length;
            ps4Input.value = consoles.filter(c => c.type === 'PS4').length;
            ps5Input.value = consoles.filter(c => c.type === 'PS5').length;
            localStorage.setItem('consoles', JSON.stringify(consoles.map(c => ({ ...c, session: null }))));
        } catch (error) {
            console.warn('MySQL consoles tidak tersedia, menggunakan cache lokal.', error);
        }
    }

    manageForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newCounts = {
            PS3: parseInt(ps3Input.value, 10),
            PS4: parseInt(ps4Input.value, 10),
            PS5: parseInt(ps5Input.value, 10)
        };

        if (Object.values(newCounts).some(value => Number.isNaN(value) || value < 0)) {
            alert('Jumlah PS harus berupa angka 0 atau lebih.');
            return;
        }

        const currentConsoles = JSON.parse(localStorage.getItem('consoles')) || [];
        const activeConsoles = currentConsoles.filter(c => c.status === 'in-use' || c.status === 'paused');
        for (const type of ['PS3', 'PS4', 'PS5']) {
            const activeCount = activeConsoles.filter(c => c.type === type).length;
            if (newCounts[type] < activeCount) {
                alert(`Tidak bisa mengurangi jumlah ${type} karena masih ada ${activeCount} unit yang sedang digunakan/dijeda.`);
                return;
            }
        }

        try {
            const response = await fetch(CONSOLES_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ counts: newCounts })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Gagal menyimpan consoles.');

            const dbConsoles = Array.isArray(result.data) ? result.data : [];
            const localByName = Object.fromEntries(currentConsoles.map(c => [c.name, c]));
            const finalConsoles = dbConsoles.map(c => ({
                ...c,
                session: localByName[c.name]?.session || null,
                status: localByName[c.name]?.status === 'in-use' || localByName[c.name]?.status === 'paused'
                    ? localByName[c.name].status
                    : c.status
            }));

            localStorage.setItem('consoles', JSON.stringify(finalConsoles));
            alert('Pengaturan jumlah PS berhasil disimpan ke MySQL.');
            window.location.href = './index.html';
        } catch (error) {
            console.error('Gagal menyimpan consoles ke MySQL:', error);
            alert(error.message || 'Pengaturan PS gagal disimpan ke database.');
        }
    });

    resetBtn.addEventListener('click', () => {
        if (confirm('APAKAH ANDA YAKIN? Semua histori penjualan dan sesi akan dihapus secara permanen dan tidak bisa dikembalikan.')) {
            if (confirm('Peringatan terakhir! Tetap lanjutkan penghapusan histori?')) {
                localStorage.removeItem('history');
                alert('Histori penjualan dan sesi berhasil dihapus.');
                window.location.reload();
            }
        }
    });

    loadCurrentCounts();
});