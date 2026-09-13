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

    //======== Sidebar Layout ========
    if (!document.getElementById('gang-ps-sidebar-style')) {
        const style = document.createElement('style');
        style.id = 'gang-ps-sidebar-style';
        style.textContent = `
            body { padding: 20px; padding-bottom: 90px; }
            nav {
                position: fixed !important;
                left: 8px !important;
                top: 14px !important;
                bottom: 14px !important;
                width: 200px !important;
                height: auto !important;
                box-sizing: border-box !important;
                z-index: 900 !important;
                margin: 0 !important;
                padding: 24px 14px !important;
                background: #ffffff !important;
                border: 1px solid #e7e9ee !important;
                border-radius: 16px !important;
                box-shadow: 0 4px 18px rgba(25,24,59,.08) !important;
                text-align: left !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 4px !important;
            }
            nav::before {
                content: 'GANG PS';
                display: block;
                padding: 8px 14px 26px;
                color: #19183B;
                font-size: 28px;
                font-weight: 600;
                letter-spacing: .5px;
            }
            nav a {
                display: block !important;
                margin: 0 !important;
                padding: 11px 14px !important;
                color: #4b4d5f !important;
                background: transparent !important;
                border-radius: 10px !important;
                text-decoration: none !important;
                font-weight: 600 !important;
                line-height: 1.45 !important;
                transition: background-color .2s, color .2s !important;
            }
            nav a:hover {
                background: #f1f3ff !important;
                color: #303f9f !important;
            }
            nav a.active {
                background: #4b56bd !important;
                color: #ffffff !important;
            }
            body > .container {
                max-width: none !important;
                margin: 20px 20px 20px 228px !important;
                min-height: calc(100vh - 110px);
                box-sizing: border-box;
            }
            body > footer {
                position: fixed !important;
                left: 228px !important;
                right: 20px !important;
                bottom: 0 !important;
                width: auto !important;
                box-sizing: border-box !important;
                margin: 0 !important;
                padding: 14px 20px !important;
                z-index: 800 !important;
                background: #f5f6f8 !important;
                border-top: 1px solid #e0e3e8 !important;
                text-align: center !important;
            }
            body > footer #copyright-year { display: inline; }
            @media (max-width: 700px) {
                body { padding: 10px; padding-bottom: 80px; }
                nav {
                    position: relative !important;
                    left: auto !important;
                    top: auto !important;
                    bottom: auto !important;
                    width: 100% !important;
                    min-height: auto !important;
                    margin-bottom: 20px !important;
                    padding: 12px !important;
                }
                nav::before { padding: 4px 10px 10px; font-size: 22px; }
                body > .container { margin: 10px !important; min-height: auto; }
                body > footer {
                    left: 10px !important;
                    right: 10px !important;
                    padding: 12px 10px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    //======== Tahun Lokal PC ========
    const footer = document.querySelector('footer');
    if (footer) {
        const yearEl = footer.querySelector('#copyright-year');
        if (yearEl) yearEl.textContent = new Date().getFullYear();
    }
});
