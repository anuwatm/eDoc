// js/windowManager.js

class WindowManager {
    static zIndex = 100;
    static activeWindows = {};

    static open(title, type, data = {}) {
        const id = `win-${type}-${Date.now()}`;

        // Basic Window Template
        const win = document.createElement('div');
        win.classList.add('virtual-window', 'window-opening', 'window-active');
        win.id = id;
        win.style.zIndex = ++this.zIndex;

        // Random usage position for "opening" feel
        const top = 50 + (Object.keys(this.activeWindows).length * 30);
        const left = 200 + (Object.keys(this.activeWindows).length * 30);
        win.style.top = `${top}px`;
        win.style.left = `${left}px`;

        if (type === 'preview-docx' || type === 'preview-pdf' || type === 'csv-viewer') {
            win.style.width = type === 'csv-viewer' ? '1024px' : '920px';
            win.style.height = type === 'csv-viewer' ? '760px' : '680px';
        }

        win.innerHTML = `
            <div class="window-header" onmousedown="WindowManager.startDrag(event, '${id}')">
                <span class="window-title">${this.escapeHtml(title)}</span>
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

        win.addEventListener('animationend', (e) => {
            if (e.animationName === 'fadeInScale') win.classList.remove('window-opening');
        }, { once: true });

        // Bring to front on click
        win.addEventListener('mousedown', () => {
            win.style.zIndex = ++this.zIndex;
            Object.values(this.activeWindows).forEach(w => w.classList.remove('window-active'));
            win.classList.add('window-active');
        });

        // Resize Event
        win.querySelector('.resize-handle').addEventListener('mousedown', (e) => this.startResize(e, id));

        // Load Content
        this.loadContent(id, type, data);
        return id;
    }

    static close(id) {
        const win = document.getElementById(id);
        if (!win || win.classList.contains('window-closing')) return;

        const query = win.querySelector('.window-content');
        const type = query ? query.getAttribute('data-type') : null;

        if (type === 'my-doc' || type === 'public-doc') {
            if (typeof Widgets !== 'undefined') {
                Widgets.updateDetailWidget(null);
            }
        }

        const finishClose = () => {
            win.remove();
            delete this.activeWindows[id];
        };

        win.classList.remove('window-active');
        win.classList.add('window-closing');
        win.addEventListener('animationend', (e) => {
            if (e.animationName === 'fadeOutScale') finishClose();
        }, { once: true });
        setTimeout(finishClose, 280);
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
            ImageViewer.render(contentArea, data);
        } else if (type === 'preview-docx') {
            DocxViewer.render(contentArea, data);
        } else if (type === 'preview-pdf') {
            PdfViewer.render(contentArea, data);
        } else if (type === 'preview-video') {
            contentArea.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:100%;"><video src="${data.src}" controls style="max-width:100%; max-height:100%;"></video></div>`;
        } else if (type === 'csv-viewer') {
            contentArea.style.display = 'flex';
            contentArea.style.flexDirection = 'column';
            contentArea.innerHTML = '<div class="loading-spinner">กำลังโหลด CSV...</div>';

            fetch(data.src)
                .then(async res => {
                    const text = await res.text();
                    const trimmed = text.trim();
                    if (!res.ok || (res.headers.get('Content-Type') || '').includes('application/json')) {
                        let message = trimmed || res.statusText || 'โหลด CSV ไม่ได้';
                        try {
                            const payload = JSON.parse(trimmed);
                            message = payload.message || message;
                        } catch (_) {}
                        throw new Error(message);
                    }
                    return text;
                })
                .then(csvText => {
                    CsvViewer.render(contentArea, csvText, data);
                })
                .catch(err => {
                    console.error('CSV Load Error:', err);
                    contentArea.innerHTML = `
                        <div style="padding:20px; color:#ff6b6b; text-align:center;">
                            <i class="fa-solid fa-triangle-exclamation" style="font-size:2em; margin-bottom:10px;"></i><br>
                            โหลด CSV ไม่ได้<br>
                            <small>${this.escapeHtml(err.message)}</small>
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
                    <button class="window-action-btn upload-history-btn" type="button" style="margin-top:10px;align-self:flex-end;">Upload history</button>
                </div>
            `;
            // Enable Drag & Drop for this Upload window (defaults to My Doc root)
            setTimeout(() => {
                if (typeof FileSystem !== 'undefined') {
                    // We attach to the window content area so dropping anywhere works
                    FileSystem.enableDragDrop(contentArea, 'my-doc', '');
                }
            }, 0);
            contentArea.querySelector('.upload-history-btn').onclick = () => WindowManager.open('Upload history', 'upload-history');
        } else if (type === 'upload-history') {
            contentArea.classList.add('window-list-scroll');
            FileSystem.renderUploadHistory(contentArea);
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
                                    <h2 style="margin:0; font-size:1.5rem;">${this.escapeHtml(data.username)}</h2>
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
            SearchWindow.render(contentArea, data.term || '');
        } else if (type === 'trash-window') {
            TrashWindow.render(contentArea);
        } else if (type === 'recent-files') {
            RecentWindow.render(contentArea);
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
        return UIHelpers.formatSize(bytes);
    }

    static escapeHtml(value) {
        return UIHelpers.escapeHtml(value);
    }

                                                    static maximize(id) {
        const win = document.getElementById(id);
        win.classList.toggle('maximized');
    }

    }

