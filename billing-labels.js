document.addEventListener('DOMContentLoaded', () => {
    const consoleList = document.getElementById('console-list');
    if (!consoleList) return;

    function updateLabels() {
        consoleList.querySelectorAll('.console-card h4').forEach(title => {
            const match = title.textContent.trim().match(/^(PS[345])\s*-\s*(\d+)$/i);
            if (match) title.textContent = `${match[1].toUpperCase()} No.${match[2]}`;
        });
    }

    const observer = new MutationObserver(updateLabels);
    observer.observe(consoleList, { childList: true, subtree: true });
    updateLabels();
});
