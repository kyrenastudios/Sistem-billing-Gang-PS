(() => {
    //======== Sync Menu Billing ========
    const MENU_API_URL = 'api/menu.php';

    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `${MENU_API_URL}?t=${Date.now()}`, false);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.send();

        if (xhr.status >= 200 && xhr.status < 300) {
            const result = JSON.parse(xhr.responseText);
            if (result && result.success && Array.isArray(result.data)) {
                localStorage.setItem('menuItems', JSON.stringify(result.data));
                console.log(`Billing Menu Sync: ${result.data.length} item dimuat dari MySQL.`);
            } else {
                console.warn('Billing Menu Sync: respons menu tidak valid.');
            }
        } else {
            console.warn(`Billing Menu Sync: gagal memuat menu. HTTP ${xhr.status}`);
        }
    } catch (error) {
        console.warn('Billing Menu Sync: gagal membaca menu dari MySQL.', error);
    }
})();
