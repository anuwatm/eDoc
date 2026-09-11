// js/imageViewer.js

class ImageViewer {
static getObjectFitContentRect(img) {
        const rect = img.getBoundingClientRect();
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        if (!nw || !nh) return rect;

        const scale = Math.min(rect.width / nw, rect.height / nh);
        const contentW = nw * scale;
        const contentH = nh * scale;
        const offsetX = (rect.width - contentW) / 2;
        const offsetY = (rect.height - contentH) / 2;

        return {
            left: rect.left + offsetX,
            top: rect.top + offsetY,
            width: contentW,
            height: contentH
        };
    }



static render(container, data) {
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.overflow = 'hidden';
        container.innerHTML = `
            <div class="image-toolbar">
                <div class="image-tool-group">
                    <button class="image-tool-btn img-zoom-out" title="Zoom out"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
                    <button class="image-tool-btn img-zoom-in" title="Zoom in"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
                    <button class="image-tool-btn img-fit" title="Fit"><i class="fa-solid fa-expand"></i><span>Fit</span></button>
                </div>
                <div class="image-tool-group">
                    <button class="image-tool-btn img-rotate-left" title="Rotate left"><i class="fa-solid fa-rotate-left"></i></button>
                    <button class="image-tool-btn img-rotate-right" title="Rotate right"><i class="fa-solid fa-rotate-right"></i></button>
                    <button class="image-tool-btn img-crop" title="Crop"><i class="fa-solid fa-crop-simple"></i><span>Crop</span></button>
                </div>
                <div class="image-tool-group image-crop-actions">
                    <button class="image-tool-btn image-tool-primary img-apply" title="Apply crop"><i class="fa-solid fa-check"></i><span>Apply</span></button>
                    <button class="image-tool-btn img-cancel" title="Cancel crop"><i class="fa-solid fa-xmark"></i><span>Cancel</span></button>
                </div>
                <button class="image-tool-btn img-download" title="Download"><i class="fa-solid fa-download"></i><span>Download</span></button>
            </div>
            <div class="image-stage"></div>
        `;

        const stage = container.querySelector('.image-stage');
        const img = document.createElement('img');
        img.className = 'image-viewer-img';
        img.alt = data.name || 'Image preview';
        img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;transform-origin:center center;user-select:none;';
        img.onerror = () => {
            stage.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ff6b6b;text-align:center;padding:20px;"><div><i class="fa-solid fa-triangle-exclamation" style="font-size:2em;margin-bottom:10px;"></i><br>Failed to load image.</div></div>';
        };
        img.src = data.src;
        stage.appendChild(img);
        const cropBtn = container.querySelector('.img-crop');
        const applyBtn = container.querySelector('.img-apply');
        const cancelBtn = container.querySelector('.img-cancel');
        const cropActions = container.querySelector('.image-crop-actions');
        const downloadBtn = container.querySelector('.img-download');
        let zoom = 1;
        let rotation = 0;
        let cropMode = false;
        let cropBox = null;
        let cropStart = null;
        let currentSrc = data.src;

        const render = () => {
            img.style.transform = `scale(${zoom}) rotate(${rotation}deg)`;
            img.style.cursor = cropMode ? 'crosshair' : 'default';
        };
        const setCropMode = (active) => {
            cropMode = active;
            cropBtn.style.display = active ? 'none' : '';
            cropActions.style.display = active ? 'flex' : 'none';
            if (!active && cropBox) {
                cropBox.remove();
                cropBox = null;
            }
            render();
        };
        const getPoint = (e) => {
            const rect = stage.getBoundingClientRect();
            return { x: e.clientX - rect.left + stage.scrollLeft, y: e.clientY - rect.top + stage.scrollTop };
        };

        container.querySelector('.img-zoom-in').onclick = () => { zoom = Math.min(zoom + 0.2, 5); render(); };
        container.querySelector('.img-zoom-out').onclick = () => { zoom = Math.max(zoom - 0.2, 0.2); render(); };
        container.querySelector('.img-fit').onclick = () => { zoom = 1; rotation = 0; setCropMode(false); render(); };
        container.querySelector('.img-rotate-left').onclick = () => { rotation = (rotation - 90) % 360; setCropMode(false); render(); };
        container.querySelector('.img-rotate-right').onclick = () => { rotation = (rotation + 90) % 360; setCropMode(false); render(); };
        cropBtn.onclick = () => {
            if (((rotation % 360) + 360) % 360 !== 0) {
                Notify.show('Crop works before rotate. Click Fit first, then crop.', 'info');
                return;
            }
            setCropMode(true);
        };
        cancelBtn.onclick = () => setCropMode(false);
        downloadBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = currentSrc;
            a.download = data.name || 'image';
            a.click();
        };

        stage.onmousedown = (e) => {
            if (!cropMode || e.target !== img) return;
            e.preventDefault();
            if (cropBox) cropBox.remove();
            cropStart = getPoint(e);
            cropBox = document.createElement('div');
            cropBox.style.cssText = 'position:absolute;border:2px solid #2ecc71;background:rgba(46,204,113,.18);pointer-events:none;z-index:5;';
            stage.appendChild(cropBox);
        };
        stage.onmousemove = (e) => {
            if (!cropMode || !cropStart || !cropBox) return;
            const p = getPoint(e);
            const left = Math.min(cropStart.x, p.x);
            const top = Math.min(cropStart.y, p.y);
            cropBox.style.left = left + 'px';
            cropBox.style.top = top + 'px';
            cropBox.style.width = Math.abs(p.x - cropStart.x) + 'px';
            cropBox.style.height = Math.abs(p.y - cropStart.y) + 'px';
        };
        stage.onmouseup = () => { cropStart = null; };
        applyBtn.onclick = () => {
            if (!cropBox || !img.naturalWidth || !img.naturalHeight) return;
            const box = cropBox.getBoundingClientRect();
            const contentRect = ImageViewer.getObjectFitContentRect(img);
            const x = Math.max(0, (box.left - contentRect.left) / contentRect.width);
            const y = Math.max(0, (box.top - contentRect.top) / contentRect.height);
            const w = Math.min(1 - x, box.width / contentRect.width);
            const h = Math.min(1 - y, box.height / contentRect.height);
            if (w <= 0.01 || h <= 0.01) return;
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.naturalWidth * w);
            canvas.height = Math.round(img.naturalHeight * h);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, Math.round(img.naturalWidth * x), Math.round(img.naturalHeight * y), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
            currentSrc = canvas.toDataURL('image/png');
            img.src = currentSrc;
            zoom = 1;
            rotation = 0;
            setCropMode(false);
        };
        img.onload = render;
        render();
    }


}
