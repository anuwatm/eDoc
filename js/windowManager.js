// js/windowManager.js

class WindowManager {
    static zIndex = 100;
    static activeWindows = {};

    static open(title, type, data = {}) {
        const id = `win-${type}-${Date.now()}`;

        // Basic Window Template
        const win = document.createElement('div');
        win.classList.add('virtual-window');
        win.id = id;
        win.style.zIndex = ++this.zIndex;

        // Random usage position for "opening" feel
        const top = 50 + (Object.keys(this.activeWindows).length * 30);
        const left = 200 + (Object.keys(this.activeWindows).length * 30);
        win.style.top = `${top}px`;
        win.style.left = `${left}px`;

        win.innerHTML = `
            <div class="window-header" onmousedown="WindowManager.startDrag(event, '${id}')">
                <span class="window-title">${title}</span>
                <div class="window-controls">
                    <span class="win-btn maximize" onclick="WindowManager.maximize('${id}')">⬜</span>
                    <span class="win-btn close" onclick="WindowManager.close('${id}')">✕</span>
                </div>
            </div>
            <div class="window-content">
                <div class="loading-spinner">Loading...</div>
                <!-- Content injected here based on type -->
            </div>
            <div class="resize-handle"></div>
        `;

        document.getElementById('desktop-container').appendChild(win);
        this.activeWindows[id] = win;

        // Bring to front on click
        win.addEventListener('mousedown', () => {
            win.style.zIndex = ++this.zIndex;
        });

        // Resize Event
        win.querySelector('.resize-handle').addEventListener('mousedown', (e) => this.startResize(e, id));

        // Load Content
        this.loadContent(id, type, data);
    }

    static close(id) {
        const win = document.getElementById(id);
        if (win) {
            win.remove();
            delete this.activeWindows[id];
        }
    }

    static startDrag(e, id) {
        if (e.target.classList.contains('win-btn') || e.target.classList.contains('resize-handle')) return; // Don't drag if clicking buttons or resize

        const win = document.getElementById(id);
        let shiftX = e.clientX - win.getBoundingClientRect().left;
        let shiftY = e.clientY - win.getBoundingClientRect().top;

        function moveAt(pageX, pageY) {
            win.style.left = pageX - shiftX + 'px';
            win.style.top = pageY - shiftY + 'px';
        }

        function onMouseMove(event) {
            moveAt(event.pageX, event.pageY);
        }

        document.addEventListener('mousemove', onMouseMove);

        document.onmouseup = function () {
            document.removeEventListener('mousemove', onMouseMove);
            document.onmouseup = null;
        };
    }

    static startResize(e, id) {
        e.preventDefault();
        e.stopPropagation();
        const win = document.getElementById(id);

        function resize(e) {
            win.style.width = (e.clientX - win.getBoundingClientRect().left) + 'px';
            win.style.height = (e.clientY - win.getBoundingClientRect().top) + 'px';
        }

        function stopResize() {
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
        }

        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
    }

    static loadContent(id, type, data) {
        const contentArea = document.querySelector(`#${id} .window-content`);

        // Clear loading spinner
        contentArea.innerHTML = '';

        if (type === 'my-doc') {
            FileSystem.load(contentArea, 'my-doc');
        } else if (type === 'public-doc') {
            FileSystem.load(contentArea, 'public-doc');
        } else if (type === 'preview-img') {
            contentArea.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:100%;"><img src="${data.src}" style="max-width:100%; max-height:100%; object-fit:contain;"></div>`;
        } else if (type === 'preview-video') {
            contentArea.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:100%;"><video src="${data.src}" controls style="max-width:100%; max-height:100%;"></video></div>`;
        } else if (type === 'csv-viewer') {
            contentArea.innerText = "CSV Preview functionality coming soon."; // Placeholder for Pivot
        } else if (type === 'upload') {
            contentArea.innerHTML = `
                <div style="display:flex; flex-direction:column; height:100%;">
                    <div class="upload-drop-zone" style="padding:30px; text-align:center; border: 2px dashed rgba(255,255,255,0.2); border-radius: 10px; margin-bottom:15px; color: #aaa; transition: all 0.2s;">
                        <i class="fa-solid fa-cloud-arrow-up" style="font-size: 3rem; margin-bottom:10px;"></i>
                        <p>Drag & Drop files here</p>
                    </div>
                    <div class="upload-queue-container" style="flex:1; overflow-y:auto; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
                        <div style="text-align:center; color:#666; font-size:0.9rem; margin-top:20px;">Queue is empty</div>
                    </div>
                </div>
            `;
            // Enable Drag & Drop for this Upload window (defaults to My Doc root)
            setTimeout(() => {
                if (typeof FileSystem !== 'undefined') {
                    // We attach to the window content area so dropping anywhere works
                    FileSystem.enableDragDrop(contentArea, 'my-doc', '');
                }
            }, 0);
        } else if (type === 'settings') {
            contentArea.innerHTML = `
                <div style="padding:20px; color:#fff;">
                    <h3 style="margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">Personalization</h3>
                    <div style="margin-bottom:20px;">
                        <label style="display:block; margin-bottom:5px; font-size:0.9rem;">Change Avatar</label>
                        <input type="file" id="upload-avatar" accept="image/*" style="background:rgba(0,0,0,0.2); padding:8px; border-radius:5px; width:100%; color:#ccc;">
                        <button class="win-btn" style="margin-top:10px; padding:8px 15px; background:var(--primary-color); border-radius:5px; border:none; color:white;" onclick="uploadSetting('avatar')">Update Avatar</button>
                    </div>
                    <div style="margin-bottom:20px;">
                        <label style="display:block; margin-bottom:5px; font-size:0.9rem;">Change Wallpaper</label>
                        <input type="file" id="upload-bg" accept="image/*" style="background:rgba(0,0,0,0.2); padding:8px; border-radius:5px; width:100%; color:#ccc;">
                        <button class="win-btn" style="margin-top:10px; padding:8px 15px; background:var(--primary-color); border-radius:5px; border:none; color:white;" onclick="uploadSetting('bg')">Update Wallpaper</button>
                    </div>
                </div>
             `;
        } else if (type === 'search-results') {
            contentArea.innerHTML = `<p style="padding:20px;">Searching for: <b>${data.term}</b>...</p>`;
            // Todo: Call Search API
        } else {
            contentArea.innerHTML = `<p style="padding:20px;">Unknown Window Type: ${type}</p>`;
        }
    }

    static maximize(id) {
        const win = document.getElementById(id);
        win.classList.toggle('maximized');
    }
}
