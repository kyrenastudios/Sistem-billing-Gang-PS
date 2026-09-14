document.addEventListener('DOMContentLoaded', () => {
    const consoleList = document.getElementById('console-list');
    if (!consoleList) return;

    //======== Billing Group Safety ========
    // Jangan memindahkan/reparent console-card. Event delegation billing memakai #console-list.
    // Layout grouping dinonaktifkan sementara agar kontrol billing tetap memiliki DOM asli.
    consoleList.classList.remove('billing-grouped');
});
