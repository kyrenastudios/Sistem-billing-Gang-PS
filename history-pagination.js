document.addEventListener('DOMContentLoaded', () => {
    const table = document.getElementById('history-table');
    const body = document.getElementById('history-body');
    if (!table || !body) return;

    const pageSize = 10;
    let currentPage = 1;

    const pagination = document.createElement('div');
    pagination.id = 'history-pagination';
    pagination.setAttribute('aria-label', 'Navigasi halaman riwayat');
    table.insertAdjacentElement('afterend', pagination);

    const style = document.createElement('style');
    style.textContent = `
        #history-pagination { display:flex; justify-content:center; align-items:center; gap:6px; flex-wrap:wrap; margin:20px 0 8px; }
        #history-pagination button { min-width:38px; height:38px; padding:0 11px; border:1px solid #d9dce3; border-radius:7px; background:#fff; color:#3f4354; cursor:pointer; font-weight:600; }
        #history-pagination button:hover { background:#f1f3f7; }
        #history-pagination button.active { background:#3f51b5; border-color:#3f51b5; color:#fff; }
        #history-pagination button:disabled { opacity:.45; cursor:not-allowed; }
        #history-pagination .pagination-info { width:100%; text-align:center; color:#777b88; font-size:.85rem; margin-top:3px; }
    `;
    document.head.appendChild(style);

    function renderPagination() {
        const rows = Array.from(body.querySelectorAll('tr'));
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        if (currentPage > totalPages) currentPage = totalPages;

        rows.forEach((row, index) => {
            const page = Math.floor(index / pageSize) + 1;
            row.style.display = page === currentPage ? '' : 'none';
        });

        pagination.innerHTML = '';
        if (rows.length <= pageSize) {
            pagination.style.display = 'none';
            return;
        }
        pagination.style.display = 'flex';

        const previous = document.createElement('button');
        previous.type = 'button';
        previous.textContent = '‹';
        previous.title = 'Halaman sebelumnya';
        previous.disabled = currentPage === 1;
        previous.addEventListener('click', () => { currentPage--; renderPagination(); });
        pagination.appendChild(previous);

        for (let page = 1; page <= totalPages; page++) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = page;
            button.classList.toggle('active', page === currentPage);
            button.setAttribute('aria-current', page === currentPage ? 'page' : 'false');
            button.addEventListener('click', () => { currentPage = page; renderPagination(); });
            pagination.appendChild(button);
        }

        const next = document.createElement('button');
        next.type = 'button';
        next.textContent = '›';
        next.title = 'Halaman berikutnya';
        next.disabled = currentPage === totalPages;
        next.addEventListener('click', () => { currentPage++; renderPagination(); });
        pagination.appendChild(next);

        const info = document.createElement('div');
        info.className = 'pagination-info';
        const start = (currentPage - 1) * pageSize + 1;
        const end = Math.min(currentPage * pageSize, rows.length);
        info.textContent = `Menampilkan ${start}-${end} dari ${rows.length} transaksi`;
        pagination.appendChild(info);
    }

    let refreshTimer;
    const observer = new MutationObserver(() => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
            currentPage = 1;
            renderPagination();
        }, 0);
    });
    observer.observe(body, { childList: true });
    renderPagination();
});
