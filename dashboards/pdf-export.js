// Shared PDF export for Xenium dashboards. Put on window._exportPdf before loading.
// Usage (button onclick):  _pdfMenu(this, { title: 'My Dashboard', filename: 'my-dashboard' })
// _exportPdf({ title, filename, button }) exports as shown.
// Export hooks (optional, defined per page):
//   window._pdfPrintOn  -> called before capture when printer-friendly chosen (apply light look)
//   window._pdfPrintOff -> called after capture (restore original look)
// Requires: an element with class "dashboard" containing the whole view to export.
// Elements with class "no-pdf" are hidden from the rendered image (buttons, switchers).

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

        // printer-friendly hook: page applies its light look (charts included), we settle, capture, restore
        if (o.printMode && window._pdfPrintOn) {
            try { await window._pdfPrintOn(); } catch (e) { /* continue with as-shown */ }
            await new Promise(r => setTimeout(r, 400));
        }

        // render the .dashboard element; onclone hides screen-only chrome (class no-pdf)
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
        if (o.printMode && window._pdfPrintOff) {
            try { await window._pdfPrintOff(); } catch (e) { /* restore best effort */ }
        }
        if (btn) { btn.disabled = false; btn.textContent = oldLabel; }
    }
};

// Small chooser beside the button: as shown on screen vs printer friendly (light).
// Uses window._pdfPrintOn/_pdfPrintOff hooks when the page defines them.
window._pdfMenu = function (anchor, opts) {
    const existing = document.getElementById('pdfMenu');
    if (existing) { existing.remove(); return; }
    const o = opts || {};

    const menu = document.createElement('div');
    menu.id = 'pdfMenu';
    menu.className = 'no-pdf';
    menu.style.cssText = 'position:absolute; z-index:99990; background:#ffffff; color:#22303c; border:1px solid #cfd6de; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.35); min-width:230px; overflow:hidden; font-family:inherit;';

    const mk = function (label, sub, fn) {
        const b = document.createElement('button');
        b.type = 'button';
        b.style.cssText = 'display:block; width:100%; text-align:left; background:none; border:none; padding:10px 14px; cursor:pointer; font-family:inherit; font-size:13px; color:inherit;';
        b.innerHTML = '<div style="font-weight:600;">' + label + '</div><div style="font-size:11px; color:#8a929b; margin-top:1px;">' + sub + '</div>';
        b.onmouseenter = function () { b.style.background = '#f2f4f8'; };
        b.onmouseleave = function () { b.style.background = 'none'; };
        b.onclick = function () { menu.remove(); document.removeEventListener('click', close, true); fn(); };
        return b;
    };

    const hasHooks = !!(window._pdfPrintOn && window._pdfPrintOff);
    menu.appendChild(mk('Download PDF', 'Exactly as shown on screen', function () {
        _exportPdf(Object.assign({}, o, { button: anchor }));
    }));
    if (hasHooks) {
        menu.appendChild(mk('Printer friendly', 'Light background, made for printing', function () {
            _exportPdf(Object.assign({}, o, { button: anchor, printMode: true }));
        }));
    }

    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.left = Math.max(8, window.scrollX + r.right - menu.offsetWidth) + 'px';
    menu.style.top = (window.scrollY + r.bottom + 6) + 'px';

    const close = function (e) {
        if (!menu.contains(e.target) && e.target !== anchor) {
            menu.remove();
            document.removeEventListener('click', close, true);
        }
    };
    setTimeout(function () { document.addEventListener('click', close, true); }, 0);
};
