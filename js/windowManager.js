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
        return id;
    }

    static close(id) {
        const win = document.getElementById(id);
        if (win) {
            // Check if this is a File Manager window
            const query = win.querySelector('.window-content');
            const type = query ? query.getAttribute('data-type') : null;

            // If closing a file manager, hide the detail widget as context is lost
            if (type === 'my-doc' || type === 'public-doc') {
                if (typeof Widgets !== 'undefined') {
                    Widgets.updateDetailWidget(null); // Hide details
                }
            }

            win.remove();
            delete this.activeWindows[id];
        }
    }

    static startDrag(e, id) {
        // Allow dragging windows via header or generic elements directly
        if (e.target.classList.contains('win-btn') || e.target.classList.contains('resize-handle')) return;

        const win = document.getElementById(id);
        if (!win) return;

        // Bring to front
        win.style.zIndex = ++this.zIndex;

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
            FileSystem.load(contentArea, 'my-doc', data.path || '');
        } else if (type === 'public-doc') {
            FileSystem.load(contentArea, 'public-doc', data.path || '');
        } else if (type === 'preview-img') {
            this.renderImageViewer(contentArea, data);
        } else if (type === 'preview-video') {
            contentArea.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:100%;"><video src="${data.src}" controls style="max-width:100%; max-height:100%;"></video></div>`;
        } else if (type === 'csv-viewer') {
            contentArea.style.display = 'flex';
            contentArea.style.flexDirection = 'column';
            contentArea.innerHTML = `
                <div class="loading-spinner">Loading CSV...</div>
            `;

            fetch(data.src)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
                    return res.text();
                })
                .then(csvText => {
                    this.renderCSV(contentArea, csvText);
                })
                .catch(err => {
                    console.error('CSV Load Error:', err);
                    contentArea.innerHTML = `
                        <div style="padding:20px; color:#ff6b6b; text-align:center;">
                            <i class="fa-solid fa-triangle-exclamation" style="font-size:2em; margin-bottom:10px;"></i><br>
                            Failed to load CSV.<br>
                            <small>${err.message}</small><br>
                            <small style="color:#888;">Path: ${data.src}</small>
                        </div>`;
                });
        } else if (type === 'upload') {
            contentArea.innerHTML = `
                <div style="display:flex; flex-direction:column; height:100%;">
                    <div style="margin-bottom:15px; display:flex; align-items:center; justify-content:space-between;">
                        <span style="color:#ccc;">Destination:</span>
                        <select id="upload-destination" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.2); color:white; padding:5px 10px; border-radius:4px; outline:none;">
                            <option value="my-doc">My Document</option>
                            <option value="public-doc">Public Document</option>
                        </select>
                    </div>
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
                    </div>
                </div>
             `;
        } else if (type === 'stats-window') {
            contentArea.innerHTML = `
                <div style="padding:20px; color:#fff; text-align:center;">
                     <div class="loading-spinner">Loading Statistics...</div>
                </div>
            `;

            // Fetch stats
            fetch('api/stats.php')
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        // Format Bytes
                        const formatSize = (bytes) => {
                            if (bytes === 0) return '0 B';
                            const k = 1024;
                            const sizes = ['B', 'KB', 'MB', 'GB'];
                            const i = Math.floor(Math.log(bytes) / Math.log(k));
                            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                        };

                        contentArea.innerHTML = `
                            <div style="display:flex; height:100%; color:#fff;">
                                <!-- Left Column: Profile -->
                                <div style="width: 40%; padding: 20px; border-right: 1px solid rgba(255,255,255,0.1); display:flex; flex-direction:column; align-items:center; text-align:center; background:rgba(0,0,0,0.2);">
                                    <img src="${data.avatar}" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:3px solid rgba(255,255,255,0.2); margin-bottom:15px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                                    <h2 style="margin:0; font-size:1.5rem;">${data.username}</h2>
                                    <p style="color:#aaa; margin-top:5px; font-size:0.9em; margin-bottom:30px;">${data.role || 'Administrator'}</p>
                                    
                                    <div style="width:100%; text-align:left; background:rgba(255,255,255,0.05); padding:15px; border-radius:10px;">
                                        <div style="margin-bottom:15px;">
                                            <div style="color:#888; font-size:0.8em; margin-bottom:3px;"><i class="fa-regular fa-clock"></i> Last Login</div>
                                            <div style="font-family:monospace;">${data.lastlogin}</div>
                                        </div>
                                        <div>
                                            <div style="color:#888; font-size:0.8em; margin-bottom:3px;"><i class="fa-solid fa-network-wired"></i> IP Address</div>
                                            <div style="font-family:monospace;">${data.ipaddress}</div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Right Column: Stats -->
                                <div style="width: 60%; padding: 20px; overflow-y:auto;">
                                    <h3 style="margin-bottom:20px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);">Storage Overview</h3>
                                    
                                    <!-- Private Stats -->
                                    <div style="background:rgba(255,255,255,0.05); border-radius:10px; padding:15px; border: 1px solid rgba(255,255,255,0.1); margin-bottom:20px;">
                                        <h4 style="margin-bottom:15px; color:#2ecc71; display:flex; align-items:center; gap:10px;">
                                            <i class="fa-solid fa-user-lock"></i> Private Storage
                                        </h4>
                                        <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:5px;">
                                            <span>Total Files</span>
                                            <span style="font-weight:bold;">${data.fileCount}</span>
                                        </div>
                                         <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                                            <span>Space Used</span>
                                            <span style="font-weight:bold;">${formatSize(data.usedSpace)}</span>
                                        </div>
                                         <div style="background:rgba(0,0,0,0.3); height:8px; border-radius:4px; overflow:hidden; margin-top:10px;">
                                            <div style="background:#2ecc71; width:${data.percent}%; height:100%;"></div>
                                        </div>
                                        <div style="text-align:right; font-size:0.8em; color:#aaa; margin-top:5px;">${data.percent}% of ${formatSize(data.totalSpace)}</div>
                                    </div>

                                    <!-- Public Stats -->
                                    <div style="background:rgba(255,255,255,0.05); border-radius:10px; padding:15px; border: 1px solid rgba(255,255,255,0.1);">
                                        <h4 style="margin-bottom:15px; color:#3498db; display:flex; align-items:center; gap:10px;">
                                            <i class="fa-solid fa-globe"></i> Public Storage
                                        </h4>
                                        <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:5px;">
                                            <span>Total Files</span>
                                            <span style="font-weight:bold;">${data.publicFileCount}</span>
                                        </div>
                                         <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                                            <span>Space Used</span>
                                            <span style="font-weight:bold;">${formatSize(data.publicUsedSpace)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    } else {
                        contentArea.innerHTML = `<p style="color:red; text-align:center;">Failed to load stats.</p>`;
                    }
                })
                .catch(err => {
                    contentArea.innerHTML = `<p style="color:red; text-align:center;">Error: ${err.message}</p>`;
                });
        } else if (type === 'search-results') {
            this.renderSearchResults(contentArea, data.term || '');
        } else if (type === 'trash-window') {
            this.renderTrash(contentArea);
        } else if (type === 'recent-files') {
            this.renderRecentFiles(contentArea);
        } else if (type === 'dashboard-wizard') {
            DashboardWizard.render(contentArea);
        } else if (type === 'file-selector') {
            contentArea.innerHTML = `
                <div style="display:flex; flex-direction:column; height:100%;">
                    <div style="margin-bottom:10px; padding:10px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
                         <span id="fs-current-path" style="font-size:0.9em; color:#ccc;">Location: /</span>
                         <select id="fs-context-type" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.2); color:white; padding:2px 5px; border-radius:4px; font-size:0.8em;">
                            <option value="my-doc">My Document</option>
                            <option value="public-doc">Public Document</option>
                         </select>
                    </div>
                    <div id="fs-grid" style="flex:1; overflow-y:auto; padding:10px;"></div>
                    <div style="padding:10px; border-top:1px solid rgba(255,255,255,0.1); text-align:right;">
                        <button class="win-btn" id="fs-select-btn" style="padding:8px 15px; background:var(--primary-color); border-radius:5px; border:none; color:white;">Select Directory</button>
                    </div>
                </div>
            `;
            // Initialize FileSelector logic via custom event or direct call? 
            // Better to let the caller handle wiring up the events, 
            // or we can expose a helper. For now, just the markup.
            // The caller (FileSystem.showFileSelector) will populate it.
        } else {
            contentArea.innerHTML = `<p style="padding:20px;">Unknown Window Type: ${type}</p>`;
        }
    }

    static formatSize(bytes) {
        if (!+bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    static renderImageViewer(container, data) {
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
            <div class="image-stage">
                <img class="image-viewer-img" src="${data.src}" alt="" style="max-width:100%;max-height:100%;object-fit:contain;transform-origin:center center;user-select:none;">
            </div>
        `;

        const img = container.querySelector('.image-viewer-img');
        const stage = container.querySelector('.image-stage');
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
            const imgRect = img.getBoundingClientRect();
            const x = Math.max(0, (box.left - imgRect.left) / imgRect.width);
            const y = Math.max(0, (box.top - imgRect.top) / imgRect.height);
            const w = Math.min(1 - x, box.width / imgRect.width);
            const h = Math.min(1 - y, box.height / imgRect.height);
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

    static async renderRecentFiles(container) {
        container.setAttribute('data-view', 'recent-files');
        container.innerHTML = '<div class="loading-spinner">Loading recent files...</div>';
        try {
            const res = await fetch('api/files.php?action=recent');
            const data = await res.json();
            this.renderFileList(container, data.items || [], 'No recent files');
        } catch (e) {
            container.innerHTML = '<p class="error">Connection Error</p>';
        }
    }

    static async renderTrash(container) {
        container.setAttribute('data-view', 'trash-window');
        container.innerHTML = '<div class="loading-spinner">Loading recycle bin...</div>';
        try {
            const [privateRes, publicRes] = await Promise.all([
                fetch('api/files.php?action=trash_list&context=private'),
                fetch('api/files.php?action=trash_list&context=public')
            ]);
            const privateData = await privateRes.json();
            const publicData = await publicRes.json();
            const items = [...(privateData.items || []), ...(publicData.items || [])];
            this.renderTrashList(container, items);
        } catch (e) {
            container.innerHTML = '<p class="error">Connection Error</p>';
        }
    }

    static renderFileList(container, items, emptyText) {
        container.innerHTML = '';
        if (!items.length) {
            container.innerHTML = `<div class="empty-state">${emptyText}</div>`;
            return;
        }
        items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'file-item';
            row.style.cssText = 'display:flex;align-items:center;gap:12px;justify-content:flex-start;margin-bottom:8px;padding:10px;width:auto;text-align:left;cursor:pointer;';
            row.innerHTML = `<i class="fa-solid ${this.iconForExtension(item.type)}" style="font-size:1.4rem;color:#ccc;"></i><div style="min-width:0;"><div style="color:#fff;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</div><div style="color:#aaa;font-size:.8em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.context} / ${item.path} • ${this.formatSize(item.size || 0)}</div></div>`;
            row.onclick = () => this.openSearchResult(item);
            container.appendChild(row);
        });
    }

    static renderTrashList(container, items) {
        container.innerHTML = `
            <div class="trash-list" style="flex:1;overflow:auto;padding-right:4px;"></div>
            <div class="trash-footer" style="padding-top:10px;border-top:1px solid rgba(255,255,255,.12);display:flex;justify-content:flex-end;">
                <button class="win-btn trash-clear" style="padding:8px 12px;background:#c0392b;border:none;border-radius:6px;color:white;">Clear trash</button>
            </div>
        `;
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        const list = container.querySelector('.trash-list');
        const clearBtn = container.querySelector('.trash-clear');
        clearBtn.disabled = !items.length;
        clearBtn.style.opacity = items.length ? '1' : '.45';
        clearBtn.onclick = () => FileSystem.clearTrash();
        if (!items.length) {
            list.innerHTML = '<div class="empty-state">Recycle bin is empty</div>';
            return;
        }
        items.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
        items.forEach(item => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:8px;padding:10px;background:rgba(255,255,255,.04);border-radius:8px;';
            row.innerHTML = `<i class="fa-solid ${item.isDir ? 'fa-folder' : this.iconForExtension((item.name.split('.').pop() || '').toLowerCase())}" style="font-size:1.4rem;color:${item.isDir ? '#FFD700' : '#ccc'};"></i><div style="min-width:0;flex:1;"><div style="color:#fff;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</div><div style="color:#aaa;font-size:.8em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.context} / ${item.originalPath}</div></div><button class="win-btn trash-restore" style="padding:6px 10px;background:var(--primary-color);border:none;border-radius:5px;color:white;">Restore</button><button class="win-btn trash-delete" style="padding:6px 10px;background:#e74c3c;border:none;border-radius:5px;color:white;">Del</button>`;
            row.querySelector('.trash-restore').onclick = () => FileSystem.restoreTrashItem(item.id, item.context);
            row.querySelector('.trash-delete').onclick = () => FileSystem.deleteTrashItem(item.id, item.context, item.name);
            list.appendChild(row);
        });
    }

    static renderSearchResults(container, term) {
        container.style.display = 'flex';
        container.style.flexDirection = 'column';

        const query = (term || '').trim();

        container.innerHTML = `
            <div style="padding:12px; border-bottom:1px solid rgba(255,255,255,0.1);">
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <input class="search-window-input" type="text" value="" placeholder="Search files..." style="flex:1; min-width:160px; padding:8px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.25); color:white; outline:none;">
                    <select class="search-context-filter" style="padding:8px; border-radius:6px; background:#111; color:white; border:1px solid rgba(255,255,255,0.2);">
                        <option value="All">All</option>
                        <option value="Private">Private</option>
                        <option value="Public">Public</option>
                    </select>
                    <select class="search-sort" style="padding:8px; border-radius:6px; background:#111; color:white; border:1px solid rgba(255,255,255,0.2);">
                        <option value="name">Name</option>
                        <option value="type">Type</option>
                        <option value="context">Location</option>
                    </select>
                    <button class="win-btn search-window-btn" style="padding:8px 12px; background:var(--primary-color); border:none; border-radius:6px; color:white;">Search</button>
                </div>
            </div>
            <div class="search-window-results" style="flex:1; overflow:auto; padding:10px;">
                <div class="loading-spinner">Searching...</div>
            </div>
        `;

        const input = container.querySelector('.search-window-input');
        const button = container.querySelector('.search-window-btn');
        const contextFilter = container.querySelector('.search-context-filter');
        const sortSelect = container.querySelector('.search-sort');
        const resultsArea = container.querySelector('.search-window-results');
        input.value = query;
        let lastResults = [];

        const renderCurrentResults = () => {
            const context = contextFilter.value;
            const sortBy = sortSelect.value;
            const filtered = lastResults
                .filter(item => context === 'All' || item.context === context)
                .sort((a, b) => String(a[sortBy] || '').localeCompare(String(b[sortBy] || '')) || String(a.name || '').localeCompare(String(b.name || '')));
            this.renderSearchList(resultsArea, filtered, input.value.trim());
        };

        const runSearch = async () => {
            const nextQuery = input.value.trim();
            if (!nextQuery) {
                resultsArea.innerHTML = '<div class="empty-state">Enter a search term.</div>';
                return;
            }

            resultsArea.innerHTML = '<div class="loading-spinner">Searching...</div>';
            try {
                const response = await fetch(`api/search.php?q=${encodeURIComponent(nextQuery)}`);
                const result = await response.json();
                if (!result.success) {
                    resultsArea.innerHTML = `<p class="error">Error: ${result.message || 'Search failed'}</p>`;
                    return;
                }

                lastResults = result.results || [];
                renderCurrentResults();
            } catch (err) {
                resultsArea.innerHTML = `<p class="error">Connection Error: ${err.message}</p>`;
            }
        };

        button.onclick = runSearch;
        contextFilter.onchange = renderCurrentResults;
        sortSelect.onchange = renderCurrentResults;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') runSearch();
        };

        if (query) {
            runSearch();
        } else {
            resultsArea.innerHTML = '<div class="empty-state">Enter a search term.</div>';
            input.focus();
        }
    }

    static renderSearchList(container, results, term) {
        container.innerHTML = '';

        const summary = document.createElement('div');
        summary.style.marginBottom = '10px';
        summary.style.color = '#aaa';
        summary.style.fontSize = '0.9em';
        summary.textContent = `${results.length} result(s) for "${term}"`;
        container.appendChild(summary);

        if (results.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No files found';
            container.appendChild(empty);
            return;
        }

        results.forEach(result => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '12px';
            item.style.justifyContent = 'flex-start';
            item.style.marginBottom = '8px';
            item.style.padding = '10px';
            item.style.width = 'auto';
            item.style.textAlign = 'left';
            item.style.cursor = 'pointer';

            const isFolder = result.type === 'folder';
            const icon = document.createElement('i');
            icon.className = `fa-solid ${isFolder ? 'fa-folder' : this.iconForExtension(result.type)}`;
            icon.style.color = isFolder ? '#FFD700' : '#ccc';
            icon.style.fontSize = '1.4rem';

            const textWrap = document.createElement('div');
            textWrap.style.minWidth = '0';

            const name = document.createElement('div');
            name.style.color = '#fff';
            name.style.fontWeight = '600';
            name.style.whiteSpace = 'nowrap';
            name.style.overflow = 'hidden';
            name.style.textOverflow = 'ellipsis';
            name.textContent = result.name;

            const path = document.createElement('div');
            path.style.color = '#aaa';
            path.style.fontSize = '0.8em';
            path.style.whiteSpace = 'nowrap';
            path.style.overflow = 'hidden';
            path.style.textOverflow = 'ellipsis';
            path.textContent = `${result.context} / ${result.path}`;

            textWrap.appendChild(name);
            textWrap.appendChild(path);
            item.appendChild(icon);
            item.appendChild(textWrap);
            item.onclick = () => this.openSearchResult(result);

            container.appendChild(item);
        });
    }

    static iconForExtension(ext) {
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'fa-image';
        if (ext === 'mp4') return 'fa-film';
        if (ext === 'csv') return 'fa-file-csv';
        if (ext === 'pdf') return 'fa-file-pdf';
        if (['zip', 'rar'].includes(ext)) return 'fa-file-zipper';
        if (['doc', 'docx'].includes(ext)) return 'fa-file-word';
        return 'fa-file';
    }

    static openSearchResult(result) {
        const type = result.context === 'Public' ? 'public-doc' : 'my-doc';
        const title = type === 'public-doc' ? 'Public Document' : 'My Document';

        if (result.type === 'folder') {
            this.open(title, type, { path: result.path });
            return;
        }

        FileSystem.preview({
            name: result.name,
            isDir: false,
            type: result.type,
            relPath: result.path
        }, type);
    }

    static maximize(id) {
        const win = document.getElementById(id);
        win.classList.toggle('maximized');
    }

    static renderCSV(container, text) {
        // Use PapaParse if available for robust parsing
        const parseCSV = (csvText) => {
            if (typeof Papa !== 'undefined') {
                return Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    dynamicTyping: true
                }).data;
            } else {
                // Fallback (Not recommended, but kept for safety)
                console.warn('PapaParse not found, using simple fallback');
                const rows = csvText.trim().split('\n').map(row => row.split(','));
                const headers = rows[0];
                return rows.slice(1).map(row => {
                    let obj = {};
                    headers.forEach((h, i) => obj[h] = row[i]);
                    return obj;
                });
            }
        };

        const data = parseCSV(text);

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-state">Empty CSV</div>';
            return;
        }

        // Determine columns from first row
        const sample = data[0];
        const colNames = Object.keys(sample);

        const columns = colNames.map(key => ({
            title: key,
            field: key,
            headerFilter: "list", // Dropdown filter
            headerFilterParams: { valuesLookup: true, clearable: true } // Auto-populate values
        }));

        // Create Toolbar
        const toolbar = document.createElement('div');
        toolbar.style.padding = '10px';
        toolbar.style.background = 'rgba(0,0,0,0.2)';
        toolbar.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        toolbar.style.display = 'flex';
        toolbar.style.gap = '10px';
        toolbar.style.alignItems = 'center';

        // Group By Selector
        const groupLabel = document.createElement('span');
        groupLabel.innerText = 'Group By:';
        groupLabel.style.fontSize = '0.9em';

        const groupSelect = document.createElement('select');
        groupSelect.style.padding = '5px';
        groupSelect.style.borderRadius = '4px';
        groupSelect.style.background = '#000000'; // Black background
        groupSelect.style.color = 'white';
        groupSelect.style.border = '1px solid rgba(255,255,255,0.2)';

        groupSelect.innerHTML = '<option value="">None</option>';
        colNames.forEach(col => {
            groupSelect.innerHTML += `<option value="${col}">${col}</option>`;
        });

        // Print Button
        const printBtn = document.createElement('button');
        printBtn.innerHTML = '<i class="fa-solid fa-print"></i> Print';
        printBtn.className = 'win-btn';
        printBtn.style.padding = '5px 10px';
        printBtn.style.background = 'var(--primary-color)';
        printBtn.style.color = 'white';
        printBtn.style.border = 'none';
        printBtn.style.borderRadius = '4px';
        printBtn.style.marginLeft = 'auto'; // Align to right

        toolbar.appendChild(groupLabel);
        toolbar.appendChild(groupSelect);
        toolbar.appendChild(printBtn);

        // Grid Container
        const gridDiv = document.createElement('div');
        gridDiv.style.flex = '1';
        gridDiv.style.overflow = 'hidden';

        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.innerHTML = '';
        container.appendChild(toolbar);
        container.appendChild(gridDiv);

        // Render Tabulator
        const table = new Tabulator(gridDiv, {
            data: data,
            layout: "fitDataFill",
            columns: columns,
            height: "100%",
            pagination: true,
            paginationSize: 20,
            movableColumns: true,
            printAsHtml: true,
            printHeader: "<h1>CSV Data</h1>",
            printStyle: true,
        });

        // Event Listeners
        groupSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val) {
                table.setGroupBy(val);
            } else {
                table.setGroupBy("");
            }
        });

        printBtn.addEventListener('click', () => {
            table.print(false, true);
        });
    }
}

