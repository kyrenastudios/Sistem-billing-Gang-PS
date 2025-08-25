document.addEventListener('DOMContentLoaded', () => {
    const manageForm = document.getElementById('manage-form');
    const ps3Input = document.getElementById('ps3-count');
    const ps4Input = document.getElementById('ps4-count');
    const ps5Input = document.getElementById('ps5-count');
    const resetBtn = document.getElementById('reset-all-data-btn');

    function loadCurrentCounts() {
        const consoles = JSON.parse(localStorage.getItem('consoles')) || [];
        ps3Input.value = consoles.filter(c => c.type === 'PS3').length;
        ps4Input.value = consoles.filter(c => c.type === 'PS4').length;
        ps5Input.value = consoles.filter(c => c.type === 'PS5').length;
    }

    manageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const currentConsoles = JSON.parse(localStorage.getItem('consoles')) || [];
        const newCounts = {
            PS3: parseInt(ps3Input.value, 10),
            PS4: parseInt(ps4Input.value, 10),
            PS5: parseInt(ps5Input.value, 10)
        };
        
        const activeConsoles = currentConsoles.filter(c => c.status === 'in-use');
        if (activeConsoles.length > 0) {
            const activeTypes = {};
            activeConsoles.forEach(c => {
                activeTypes[c.type] = (activeTypes[c.type] || 0) + 1;
            });
            
            for (const type in activeTypes) {
                if (newCounts[type] < activeTypes[type]) {
                    alert(`Tidak bisa mengurangi jumlah ${type} karena masih ada ${activeTypes[type]} unit yang sedang digunakan.`);
                    return; // Hentikan proses simpan
                }
            }
        }
        
        let newConsoles = [];
        let idCounter = 1;
        
        // Buat array baru sambil mencoba mempertahankan data yang ada
        ['PS3', 'PS4', 'PS5'].forEach(type => {
            const existingOfType = currentConsoles.filter(c => c.type === type);
            for (let i = 0; i < newCounts[type]; i++) {
                if (existingOfType[i]) {
                    // Ambil data yang sudah ada jika memungkinkan
                    newConsoles.push(existingOfType[i]);
                } else {
                    // Buat unit baru jika jumlahnya bertambah
                    newConsoles.push({
                        id: `${type.toLowerCase()}-${Date.now()}-${i}`, // ID lebih unik
                        name: `${type} - ${i + 1}`,
                        type: type,
                        status: 'available',
                        session: null
                    });
                }
            }
        });

        // Update nama berdasarkan urutan final
        let counters = { PS3: 1, PS4: 1, PS5: 1 };
        newConsoles.forEach(c => {
            c.name = `${c.type} - ${counters[c.type]++}`;
        });

        localStorage.setItem('consoles', JSON.stringify(newConsoles));
        alert('Pengaturan jumlah PS berhasil disimpan!');
        window.location.href = 'index.html';
    });

    resetBtn.addEventListener('click', () => {
        if (confirm('APAKAH ANDA YAKIN? Semua data konsol dan riwayat transaksi akan dihapus secara permanen dan tidak bisa dikembalikan.')) {
            if (confirm('Peringatan terakhir! Tetap lanjutkan penghapusan?')) {
                localStorage.clear();
                alert('Semua data berhasil dihapus.');
                window.location.reload();
            }
        }
    });

    loadCurrentCounts();
});