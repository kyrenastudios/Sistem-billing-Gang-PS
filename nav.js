//======== Shared Navigation ========
document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('nav');
    if (!nav) return;

    const items = [
        { href: './index.html', label: 'Billing', match: 'index.html' },
        { href: './history.html', label: 'Riwayat Penjualan', match: 'history.html' },
        { href: './menu.html', label: 'Menu Pesanan', match: 'menu.html' },
        { href: './members.html', label: 'Kartu Play Pass', match: 'members.html' },
        { href: './paket.html', label: 'Kelola Paket', match: 'paket.html' },
        { href: './manage.html', label: 'Kelola PS', match: 'manage.html' },
        { href: './sales.html', label: 'Laporan Penjualan', match: 'sales.html' }
    ];

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    nav.innerHTML = items.map(item => {
        const active = currentPage === item.match;
        return `<a href="${item.href}"${active ? ' class="active"' : ''}>${item.label}</a>`;
    }).join('');

    // Sidebar memakai padding kiri pada body, jadi footer tidak digeser lagi.
    const footer = document.querySelector('footer');
    if (footer) footer.style.marginLeft = '0';
});
