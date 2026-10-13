// Shared PDF export for Xenium dashboards. Put on window._exportPdf before loading.
// Usage: window._exportPdf({ title: 'My Dashboard', filename: 'my-dashboard' })
// Requires: an element with class "dashboard" containing the whole view to export.
window._exportPdf = async function (opts) {
    const o = opts || {};
    const title = o.title || 'Dashboard';
    const filename = (o.filename || 'dashboard') + '-' + new Date().toISOString().slice(0, 10) + '.pdf';

    const el = document.querySelector('.dashboard');
    if (!el) { alert('Nothing to export.'); return; }
    const btn = o.button;
    const oldLabel = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Building PDF'; }

    try {
        // lazy-load html2canvas + jsPDF
        if (!window.html2canvas) {
            await new Promise((res, rej) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
                s.onload = res; s.onerror = () => rej(new Error('html2canvas failed to load'));
                document.head.appendChild(s);
            });
        }
        if (!window.jspdf) {
            await new Promise((res, rej) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
                s.onload = res; s.onerror = () => rej(new Error('jsPDF failed to load'));
                document.head.appendChild(s);
            });
        }

        // render the .dashboard element; onclone hides screen-only chrome (back link, theme switcher)
        const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: getComputedStyle(document.body).backgroundColor,
            onclone: function (clonedDoc) {
                const root = clonedDoc.querySelector('.dashboard');
                if (!root) return;
                root.querySelectorAll('.no-pdf').forEach(function (n) { n.style.display = 'none'; });
                root.querySelectorAll('canvas').forEach(function (c) {
                    c.style.maxWidth = '100%';
                });
            }
        });

        // A4 portrait, fit width
        const pdf = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const imgW = pageW - margin * 2;
        const imgH = canvas.height * imgW / canvas.width;
        const pageContentH = pageH - margin * 2;

        if (imgH <= pageContentH) {
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, imgH);
        } else {
            // multi-page: slice the canvas
            const pxPerMm = canvas.width / imgW;
            const sliceHpx = Math.floor(pageContentH * pxPerMm);
            let y = 0;
            let first = true;
            while (y < canvas.height) {
                const h = Math.min(sliceHpx, canvas.height - y);
                const slice = document.createElement('canvas');
                slice.width = canvas.width;
                slice.height = h;
                const sctx = slice.getContext('2d');
                sctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
                if (!first) pdf.addPage();
                pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, h / pxPerMm);
                first = false;
                y += h;
            }
        }

        pdf.save(filename);
    } catch (err) {
        alert('PDF export failed: ' + (err && err.message ? err.message : err));
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = oldLabel; }
    }
};
