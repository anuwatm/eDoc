// js/documentViewers.js

class PdfViewer {
static render(container, data) {
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.overflow = 'hidden';
        container.innerHTML = `
            <div class="pdf-toolbar">
                <span class="pdf-toolbar-title">${UIHelpers.escapeHtml(data.name || 'Document.pdf')}</span>
                <div class="image-tool-group pdf-tool-group">
                    <button class="image-tool-btn pdf-prev" title="Previous page"><i class="fa-solid fa-chevron-left"></i></button>
                    <span class="pdf-page-info">- / -</span>
                    <button class="image-tool-btn pdf-next" title="Next page"><i class="fa-solid fa-chevron-right"></i></button>
                </div>
                <div class="image-tool-group pdf-tool-group">
                    <button class="image-tool-btn pdf-zoom-out" title="Zoom out"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
                    <button class="image-tool-btn pdf-zoom-in" title="Zoom in"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
                    <button class="image-tool-btn pdf-fit" title="Fit width"><i class="fa-solid fa-expand"></i></button>
                </div>
                <button class="image-tool-btn pdf-download" title="Download">
                    <i class="fa-solid fa-download"></i><span>Download</span>
                </button>
            </div>
            <div class="pdf-stage"><div class="loading-spinner">Loading PDF...</div></div>
        `;

        const stage = container.querySelector('.pdf-stage');
        const pageInfo = container.querySelector('.pdf-page-info');
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-canvas';

        const state = { doc: null, page: 1, scale: 1.2, rendering: false, fitWidth: false };

        if (typeof pdfjsLib === 'undefined') {
            stage.innerHTML = '<div class="docx-error">pdf.js library failed to load.</div>';
            return;
        }

        pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/vendor/pdf.worker.min.js';

        const showError = (message) => {
            stage.innerHTML = `
                <div class="docx-error">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <p>Failed to load PDF.</p>
                    <small>${UIHelpers.escapeHtml(message)}</small>
                </div>`;
        };

        const renderPage = async () => {
            if (!state.doc || state.rendering) return;
            state.rendering = true;
            try {
                const page = await state.doc.getPage(state.page);
                let scale = state.scale;
                if (state.fitWidth) {
                    const base = page.getViewport({ scale: 1 });
                    scale = Math.max(0.5, (stage.clientWidth - 32) / base.width);
                }
                const viewport = page.getViewport({ scale });
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({ canvasContext: ctx, viewport }).promise;
                pageInfo.textContent = `${state.page} / ${state.doc.numPages}`;
                if (!canvas.isConnected) {
                    stage.innerHTML = '';
                    stage.appendChild(canvas);
                }
            } finally {
                state.rendering = false;
            }
        };

        container.querySelector('.pdf-prev').onclick = () => {
            if (!state.doc || state.page <= 1) return;
            state.page--;
            renderPage();
        };
        container.querySelector('.pdf-next').onclick = () => {
            if (!state.doc || state.page >= state.doc.numPages) return;
            state.page++;
            renderPage();
        };
        container.querySelector('.pdf-zoom-in').onclick = () => {
            state.fitWidth = false;
            state.scale = Math.min(state.scale + 0.2, 3);
            renderPage();
        };
        container.querySelector('.pdf-zoom-out').onclick = () => {
            state.fitWidth = false;
            state.scale = Math.max(state.scale - 0.2, 0.4);
            renderPage();
        };
        container.querySelector('.pdf-fit').onclick = () => {
            state.fitWidth = true;
            renderPage();
        };
        container.querySelector('.pdf-download').onclick = () => {
            const link = document.createElement('a');
            link.href = data.src;
            link.download = data.name || 'document.pdf';
            link.click();
        };

        fetch(data.src)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
                return res.arrayBuffer();
            })
            .then(buffer => pdfjsLib.getDocument({ data: buffer }).promise)
            .then(doc => {
                state.doc = doc;
                state.page = 1;
                stage.innerHTML = '';
                stage.appendChild(canvas);
                return renderPage();
            })
            .catch(err => {
                console.error('PDF preview error:', err);
                showError(err.message);
            });
    }


}

class DocxViewer {
static render(container, data) {
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.overflow = 'hidden';
        container.innerHTML = `
            <div class="docx-toolbar">
                <span class="docx-toolbar-title">${UIHelpers.escapeHtml(data.name || 'Document')}</span>
                <button class="image-tool-btn docx-download" title="Download">
                    <i class="fa-solid fa-download"></i><span>Download</span>
                </button>
            </div>
            <div class="docx-stage"><div class="loading-spinner">Loading document...</div></div>
        `;

        const stage = container.querySelector('.docx-stage');
        container.querySelector('.docx-download').onclick = () => {
            const link = document.createElement('a');
            link.href = data.src;
            link.download = data.name || 'document.docx';
            link.click();
        };

        if (typeof docx === 'undefined' || typeof docx.renderAsync !== 'function') {
            stage.innerHTML = '<div class="docx-error">docx-preview library failed to load.</div>';
            return;
        }

        fetch(data.src)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
                return res.blob();
            })
            .then(blob => {
                stage.innerHTML = '<div class="docx-wrapper"></div>';
                const wrapper = stage.querySelector('.docx-wrapper');
                return docx.renderAsync(blob, wrapper, null, {
                    className: 'docx-preview-content',
                    inWrapper: true,
                    ignoreWidth: false,
                    ignoreHeight: false,
                    ignoreFonts: false,
                    breakPages: true,
                    ignoreLastRenderedPageBreak: true,
                    experimental: false,
                    trimXmlDeclaration: true,
                    useBase64URL: true,
                });
            })
            .catch(err => {
                console.error('DOCX preview error:', err);
                stage.innerHTML = `
                    <div class="docx-error">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <p>Failed to load document.</p>
                        <small>${UIHelpers.escapeHtml(err.message)}</small>
                    </div>`;
            });
    }


}
