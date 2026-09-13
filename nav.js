//======== Authentication Guard ========
(() => {
    const loginPage = 'login.html';
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPage === loginPage) return;

    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', './api/auth.php?action=me', false);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.send();
        const result = JSON.parse(xhr.responseText || '{}');
        if (!result.authenticated || !result.user) {
            window.location.replace(`./${loginPage}`);
            return;
        }
        window.gangPsUser = result.user;
    } catch (error) {
        console.error('Auth: gagal memeriksa login.', error);
        window.location.replace(`./${loginPage}`);
    }
})();

//======== Shared Navigation ========
document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('nav');
    if (!nav) return;

    const user = window.gangPsUser || null;
    const items = [
        { href:'./index.html', label:'Billing', match:'index.html' },
        { href:'./history.html', label:'Riwayat Penjualan', match:'history.html' },
        { href:'./menu.html', label:'Menu Pesanan', match:'menu.html' },
        { href:'./members.html', label:'Kartu Play Pass', match:'members.html' },
        { href:'./paket.html', label:'Kelola Paket', match:'paket.html' },
        { href:'./manage.html', label:'Kelola PS', match:'manage.html' },
        { href:'./sales.html', label:'Laporan Penjualan', match:'sales.html' }
    ];
    if (user && user.role === 'admin') items.push({ href:'./users.html', label:'Pengguna', match:'users.html' });

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    nav.innerHTML = items.map(item => {
        const active = currentPage === item.match;
        return `<a href="${item.href}"${active ? ' class="active"' : ''}>${item.label}</a>`;
    }).join('') + `<div class="gang-ps-user-box"><span>${user ? user.username : ''} · ${user && user.role === 'admin' ? 'Admin' : 'Kasir'}</span><button type="button" id="gang-ps-logout">Keluar</button></div>`;

    const logoutBtn = document.getElementById('gang-ps-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
        logoutBtn.disabled = true;
        try {
            await fetch('./api/auth.php?action=logout', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
        } finally {
            window.location.replace('./login.html');
        }
    });

    //======== Sidebar Layout ========
    if (!document.getElementById('gang-ps-sidebar-style')) {
        const style = document.createElement('style');
        style.id = 'gang-ps-sidebar-style';
        style.textContent = `
            body { padding:20px; padding-bottom:90px; }
            nav { position:fixed !important; left:8px !important; top:14px !important; bottom:14px !important; width:200px !important; height:auto !important; box-sizing:border-box !important; z-index:900 !important; margin:0 !important; padding:24px 14px !important; background:#fff !important; border:1px solid #e7e9ee !important; border-radius:16px !important; box-shadow:0 4px 18px rgba(25,24,59,.08) !important; text-align:left !important; display:flex !important; flex-direction:column !important; gap:4px !important; }
            nav::before { content:'GANG PS'; display:block; padding:8px 14px 26px; color:#19183B; font-size:28px; font-weight:600; letter-spacing:.5px; }
            nav a { display:block !important; margin:0 !important; padding:11px 14px !important; color:#4b4d5f !important; background:transparent !important; border-radius:10px !important; text-decoration:none !important; font-weight:600 !important; line-height:1.45 !important; transition:background-color .2s,color .2s !important; }
            nav a:hover { background:#f1f3ff !important; color:#303f9f !important; }
            nav a.active { background:#4b56bd !important; color:#fff !important; }
            .gang-ps-user-box { margin-top:auto; padding:12px 10px 2px; border-top:1px solid #e7e9ee; color:#555966; font-size:.78rem; }
            .gang-ps-user-box span { display:block; margin-bottom:8px; font-weight:600; }
            #gang-ps-logout { width:100%; margin:0; padding:8px 10px; background:#f44336; color:#fff; border:0; border-radius:8px; cursor:pointer; font-family:inherit; }
            #gang-ps-logout:hover { background:#d32f2f; }
            body > .container { max-width:none !important; margin:20px 20px 20px 228px !important; min-height:calc(100vh - 110px); box-sizing:border-box; }
            body > footer { position:fixed !important; left:228px !important; right:20px !important; bottom:0 !important; width:auto !important; box-sizing:border-box !important; margin:0 !important; padding:14px 20px !important; z-index:800 !important; background:#f5f6f8 !important; border-top:1px solid #e0e3e8 !important; color:#000 !important; text-align:center !important; }
            body > footer #copyright-year { display:inline; color:#000 !important; }
            @media (max-width:700px) {
                body { padding:0 0 70px; overflow-x:hidden; }
                nav { position:relative !important; left:auto !important; top:auto !important; bottom:auto !important; width:100% !important; min-height:0 !important; height:auto !important; margin:0 0 12px !important; padding:8px max(8px, env(safe-area-inset-left)) 8px max(8px, env(safe-area-inset-right)) !important; border:0 !important; border-radius:0 !important; box-shadow:0 1px 8px rgba(25,24,59,.08) !important; flex-direction:row !important; align-items:center !important; gap:5px !important; overflow-x:auto !important; overflow-y:hidden !important; -webkit-overflow-scrolling:touch !important; scrollbar-width:none !important; }
                nav::-webkit-scrollbar { display:none; }
                nav::before { display:none !important; }
                nav a { flex:0 0 auto !important; white-space:nowrap !important; padding:9px 12px !important; min-height:40px !important; box-sizing:border-box !important; display:flex !important; align-items:center !important; justify-content:center !important; font-size:.82rem !important; line-height:1.2 !important; touch-action:manipulation !important; }
                .gang-ps-user-box { flex:0 0 auto; margin:0 0 0 5px; padding:0 0 0 8px; border-top:0; border-left:1px solid #e7e9ee; white-space:nowrap; }
                .gang-ps-user-box span { display:inline; margin:0 6px 0 0; }
                #gang-ps-logout { width:auto; display:inline-block; padding:8px 10px; }
                body > .container { width:auto !important; max-width:none !important; margin:0 !important; padding:12px !important; border-radius:0 !important; box-shadow:none !important; min-height:0 !important; }
                body > footer { position:fixed !important; left:0 !important; right:0 !important; bottom:0 !important; padding:10px 12px max(10px,env(safe-area-inset-bottom)) !important; font-size:.8rem !important; }
                body.billing-page > .container { padding-top:8px !important; }
            }
        `;
        document.head.appendChild(style);
    }

    //======== Tahun Lokal PC ========
    const footer = document.querySelector('footer');
    if (footer) {
        const year = new Date().getFullYear();
        footer.innerHTML = `GANG PS Ponorogo &copy; <span id="copyright-year">${year}</span>`;
    }
});
