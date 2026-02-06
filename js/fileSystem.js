// js/fileSystem.js

class FileSystem {
    static clipboard = null; // { action: 'copy'|'move', path: '', type: '' }

    static async load(container, type, path = '') {
        container.innerHTML = '<div class="loading-spinner">Loading files...</div>';
        container.setAttribute('data-path', path);
        container.setAttribute('data-type', type);

        // Enable Drag & Drop Upload on container
        this.enableDragDrop(container, type, path);

        try {
            const response = await fetch(`api/files.php?action=list&type=${type === 'my-doc' ? 'private' : 'public'}&path=${path}`);
            const result = await response.json();

            if (result.success) {
                this.render(container, result.files, type, path);
            } else {
                container.innerHTML = `<p class="error">Error: ${result.message}</p>`;
            }
        } catch (e) {
            container.innerHTML = `<p class="error">Connection Error</p>`;
        }
    }

    static render(container, files, type, currentPath) {
        container.innerHTML = '';

        // Add "Up" folder if we are deep
        if (currentPath) {
            const upDiv = document.createElement('div');
            upDiv.style.padding = '5px 10px';
            upDiv.style.cursor = 'pointer';
            upDiv.style.marginBottom = '10px';
            upDiv.innerHTML = '<i class="fa-solid fa-arrow-turn-up"></i> Up';
            upDiv.onclick = () => {
                const newPath = currentPath.split('/').slice(0, -1).join('/');
                this.load(container, type, newPath);
            };
            container.appendChild(upDiv);
        }

        const grid = document.createElement('div');
        grid.className = 'file-grid';

        if (files.length === 0) {
            container.innerHTML = '<div class="empty-state">Folder is empty</div>';
            return;
        }

        files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.setAttribute('data-name', file.name);
            item.setAttribute('data-type', file.type);
            item.onclick = () => this.selectFile(item, file, type);
            item.ondblclick = () => this.openFile(file, type);
            item.oncontextmenu = (e) => this.showContextMenu(e, file, type);

            let iconClass = 'fa-file';
            let iconColor = '#ccc';

            if (file.isDir) { iconClass = 'fa-folder'; iconColor = '#FFD700'; }
            else if (['jpg', 'png', 'jpeg', 'gif'].includes(file.type)) { iconClass = 'fa-image'; iconColor = '#00BFFF'; }
            else if (file.type === 'mp4') { iconClass = 'fa-film'; iconColor = '#FF4500'; }
            else if (file.type === 'csv') { iconClass = 'fa-file-csv'; iconColor = '#32CD32'; }
            else if (file.type === 'pdf') { iconClass = 'fa-file-pdf'; iconColor = '#FF0000'; }

            item.innerHTML = `
                <i class="fa-solid ${iconClass}" style="color: ${iconColor};"></i>
                <span class="file-name">${file.name}</span>
            `;

            grid.appendChild(item);
        });

        container.appendChild(grid);
    }

    static selectFile(element, file, type) {
        document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');

        // Update Widget
        if (typeof Widgets !== 'undefined') {
            Widgets.updateDetailWidget(file, type);
        }
    }

    static openFile(file, contextType) {
        if (file.isDir) {
            const containers = document.querySelectorAll(`.window-content[data-type="${contextType}"]`);
            containers.forEach(container => {
                const currentPath = container.getAttribute('data-path');
                const newPath = currentPath ? `${currentPath}/${file.name}` : file.name;
                this.load(container, contextType, newPath);
            });
        } else {
            this.preview(file, contextType);
        }
    }

    static preview(file, contextType) {
        // For images/videos, we try direct link (assuming public or served via web server)
        // For CSV, we now use the API to read content securely
        const basePath = contextType === 'my-doc' ? `private/${window.currentUser}` : 'public';
        const path = `${basePath}/${file.relPath}`;

        if (['jpg', 'png', 'jpeg', 'gif'].includes(file.type)) {
            // Images might still need the 'eDoc/' prefix if we are determining relative URL from browser
            const imgPath = `eDoc/${path}`;
            WindowManager.open(`Preview: ${file.name}`, 'preview-img', { src: imgPath });
        } else if (file.type === 'mp4') {
            const vidPath = `eDoc/${path}`;
            WindowManager.open(`Preview: ${file.name}`, 'preview-video', { src: vidPath });
        } else if (file.type === 'csv') {
            // USE API PROXY
            const apiUrl = `api/files.php?action=read_content&type=${contextType === 'my-doc' ? 'private' : 'public'}&path=${file.relPath}`;
            WindowManager.open(`Pivot: ${file.name}`, 'csv-viewer', { src: apiUrl });
        } else {
            Notify.show('No preview available for this file type.', 'info');
        }
    }

    static showContextMenu(e, file, type) {
        e.preventDefault();
        document.querySelectorAll('.context-menu').forEach(el => el.remove());

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.top = `${e.clientY}px`;
        menu.style.left = `${e.clientX}px`;

        const options = [
            { label: 'Open', action: () => this.openFile(file, type) },
            { label: 'Copy to...', action: () => this.copyFile(file, type) },
            { label: 'Move to...', action: () => this.moveFile(file, type) },
        ];

        if (type === 'my-doc') {
            options.push({ label: 'Delete', action: () => this.deleteFile(file, type) });
        }

        options.forEach(opt => {
            const div = document.createElement('div');
            div.className = 'menu-item';
            div.innerText = opt.label;
            div.onclick = () => {
                opt.action();
                menu.remove();
            };
            menu.appendChild(div);
        });

        document.body.appendChild(menu);

        const closeMenu = () => {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    static async deleteFile(file, type) {
        // if (!confirm(`Are you sure you want to delete ${file.name}?`)) return;
        if (!await Modal.confirm('Delete File', `Are you sure you want to delete <b>${file.name}</b>?<br>This action cannot be undone.`)) return;

        const formData = new FormData();
        formData.append('action', 'delete');
        formData.append('path', file.relPath);
        formData.append('context', type === 'my-doc' ? 'private' : 'public');

        const res = await fetch('api/files.php', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.success) {
            Notify.show('File deleted', 'success');
            // Refresh view
            const targetType = type === 'my-doc' ? 'my-doc' : 'public-doc';
            document.querySelectorAll(`.window-content[data-type="${targetType}"]`).forEach(c => {
                this.load(c, targetType, c.getAttribute('data-path'));
            });
        } else {
            Notify.show('Delete failed: ' + data.message, 'error');
        }
    }

    // Placeholder actions
    static copyFile(file, type) {
        this.showFileSelector('Copy to...', async (destType, destPath) => {
            await this.performFileAction('copy', file, type, destType, destPath);
        });
    }

    static moveFile(file, type) {
        this.showFileSelector('Move to...', async (destType, destPath) => {
            await this.performFileAction('move', file, type, destType, destPath);
        });
    }

    static async performFileAction(action, file, srcType, destType, destPath) {
        const formData = new FormData();
        formData.append('action', action);

        // Helper to construct path compatible with api/files.php
        const mkPath = (t, p) => t === 'my-doc' ? p : 'public/' + p;

        formData.append('src', mkPath(srcType, file.relPath));
        formData.append('dest', mkPath(destType, (destPath ? destPath + '/' : '') + file.name));

        try {
            const res = await fetch('api/files.php', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                Notify.show(`${action === 'move' ? 'Moved' : 'Copied'} successfully.`, 'success');
                // Refresh all views
                document.querySelectorAll('.window-content[data-type]').forEach(container => {
                    this.load(container, container.getAttribute('data-type'), container.getAttribute('data-path'));
                });
            } else {
                Notify.show(`Error: ${data.message}`, 'error');
            }
        } catch (e) { console.error(e); Notify.show('Connection error', 'error'); }
    }

    static showFileSelector(title, callback) {
        const id = `win-fs-${Date.now()}`;
        // Open our custom selector window
        WindowManager.open(title, 'file-selector');
        // The window creation is async-ish in DOM but sync in JS execution. 
        // However, we need to find the specific window we just created.
        // WindowManager generates IDs based on timestamp, but we don't return it cleanly in `open`.
        // FIX: Let's find the window by searching for the one with the freshest ID or modifying WindowManager to return it.
        // For now, let's query the DOM for the last virtual-window.

        setTimeout(() => {
            const wins = document.querySelectorAll('.virtual-window');
            const win = wins[wins.length - 1]; // Most recent
            if (!win) return;

            const grid = win.querySelector('#fs-grid');
            const pathSpan = win.querySelector('#fs-current-path');
            const typeSelect = win.querySelector('#fs-context-type');
            const btn = win.querySelector('#fs-select-btn');

            let currentType = 'my-doc';
            let currentPath = '';

            const loadLevel = async (t, p) => {
                const response = await fetch(`api/files.php?action=list&type=${t === 'my-doc' ? 'private' : 'public'}&path=${p}`);
                const result = await response.json();
                grid.innerHTML = '';

                // Up Dir
                if (p) {
                    const up = document.createElement('div');
                    up.innerHTML = '<i class="fa-solid fa-arrow-turn-up"></i> Up';
                    up.className = 'file-item';
                    up.style.padding = '5px';
                    up.onclick = () => {
                        currentPath = p.split('/').slice(0, -1).join('/');
                        pathSpan.textContent = `Location: /${currentPath}`;
                        loadLevel(t, currentPath);
                    };
                    grid.appendChild(up);
                }

                if (result.success && result.files) {
                    result.files.filter(f => f.isDir).forEach(f => {
                        const d = document.createElement('div');
                        d.className = 'file-item';
                        d.style.padding = '5px';
                        d.style.cursor = 'pointer';
                        d.innerHTML = `<i class="fa-solid fa-folder" style="color:#FFD700; margin-right:5px;"></i> ${f.name}`;
                        d.onclick = () => {
                            currentPath = p ? `${p}/${f.name}` : f.name;
                            pathSpan.textContent = `Location: /${currentPath}`;
                            loadLevel(t, currentPath);
                        };
                        grid.appendChild(d);
                    });
                }
            };

            typeSelect.onchange = (e) => {
                currentType = e.target.value;
                currentPath = '';
                pathSpan.textContent = `Location: /`;
                loadLevel(currentType, currentPath);
            };

            btn.onclick = () => {
                callback(currentType, currentPath);
                WindowManager.close(win.id);
            };

            // Initial load
            loadLevel(currentType, currentPath);

        }, 100);
    }

    static enableDragDrop(container, type, path) {
        let dragCounter = 0;
        // Visual feedback on the drop zone specifically if it exists, else container
        const dropZone = container.querySelector('.upload-drop-zone') || container;

        container.ondragenter = (e) => {
            e.preventDefault();
            dragCounter++;
            dropZone.classList.add('drag-over');
        };
        container.ondragover = (e) => { e.preventDefault(); };
        container.ondragleave = () => {
            dragCounter--;
            if (dragCounter === 0) dropZone.classList.remove('drag-over');
        };
        container.ondrop = (e) => {
            e.preventDefault();
            dragCounter = 0;
            dropZone.classList.remove('drag-over');

            if (e.dataTransfer.files.length > 0) {
                this.handleUploadQueue(e.dataTransfer.files, type, path, container);
            }
        };
    }

    static handleUploadQueue(fileList, type, path, container) {
        const files = Array.from(fileList);
        // Look for our specific queue container
        const embeddedContainer = container.querySelector('.upload-queue-container');

        if (embeddedContainer) {
            this.renderEmbeddedQueue(files, embeddedContainer, type, path, container);
        } else {
            this.showUploadModal(files, type, path, container);
        }
    }

    static renderEmbeddedQueue(files, targetElement, type, path, container) {
        targetElement.innerHTML = '';

        const listDiv = document.createElement('div');
        listDiv.className = 'upload-list';
        listDiv.style.background = 'transparent'; // Transparent to blend in
        listDiv.style.maxHeight = 'none';

        const renderItems = () => {
            listDiv.innerHTML = '';
            if (files.length === 0) {
                targetElement.innerHTML = '<div style="text-align:center; color:#666; font-size:0.9rem; margin-top:20px;">Queue is empty</div>';
                return;
            }
            files.forEach((file, index) => {
                const item = document.createElement('div');
                item.className = 'upload-item';
                item.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
                item.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
                        <i class="fa-solid fa-file" style="color:#aaa;"></i>
                        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;">${file.name}</span>
                        <span style="font-size:0.8em; color:#666;">(${this.formatBytes(file.size)})</span>
                    </div>
                    <i class="fa-solid fa-trash upload-remove" style="color:#ff6b6b; cursor:pointer;" data-index="${index}" title="Remove"></i>
                `;
                listDiv.appendChild(item);
            });

            // Re-bind delete
            listDiv.querySelectorAll('.upload-remove').forEach(btn => {
                btn.onclick = (e) => {
                    const idx = parseInt(e.target.getAttribute('data-index'));
                    files.splice(idx, 1);
                    renderItems(); // Re-render list
                };
            });

            renderActions();
        };

        const actionDiv = document.createElement('div');
        actionDiv.style.marginTop = '10px';
        actionDiv.style.textAlign = 'right';

        const renderActions = () => {
            actionDiv.innerHTML = '';
            if (files.length === 0) return;

            const btn = document.createElement('button');
            btn.className = 'btn-upload';
            btn.style.width = '100%';
            btn.style.padding = '10px';
            btn.innerText = `Upload ${files.length} Files`;
            btn.onclick = async () => {
                btn.innerText = 'Uploading...';
                btn.disabled = true;
                await this.processUpload(files, type, path, container, () => {
                    targetElement.innerHTML = '<div style="text-align:center; color:#4caf50; margin-top:20px;"><i class="fa-solid fa-check-circle"></i> Upload Complete</div>';
                    // Clear success msg after 2s
                    setTimeout(() => {
                        if (targetElement.innerText.includes('Upload Complete'))
                            targetElement.innerHTML = '<div style="text-align:center; color:#666; font-size:0.9rem; margin-top:20px;">Queue is empty</div>';
                    }, 3000);
                }, (err) => {
                    btn.innerText = 'Retry';
                    btn.disabled = false;
                    alert(err);
                });
            };
            actionDiv.appendChild(btn);
        };

        targetElement.appendChild(listDiv);
        targetElement.appendChild(actionDiv);
        renderItems();
    }

    static showUploadModal(fileList, type, path, container) {
        let files = Array.from(fileList);

        const modal = document.createElement('div');
        modal.className = 'upload-modal';

        const updateList = () => {
            const listContainer = modal.querySelector('.upload-list');
            listContainer.innerHTML = '';
            if (files.length === 0) {
                modal.remove(); return;
            }
            files.forEach((file, index) => {
                const item = document.createElement('div');
                item.className = 'upload-item';
                item.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
                        <i class="fa-solid fa-file"></i>
                        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${file.name}</span>
                        <span style="font-size:0.8em; color:#aaa;">(${this.formatBytes(file.size)})</span>
                    </div>
                    <i class="fa-solid fa-trash upload-remove" data-index="${index}" title="Remove"></i>
                `;
                listContainer.appendChild(item);
            });

            modal.querySelectorAll('.upload-remove').forEach(btn => {
                btn.onclick = (e) => {
                    const idx = parseInt(e.target.getAttribute('data-index'));
                    files.splice(idx, 1);
                    updateList();
                };
            });
        };

        const modalContent = `
            <h3>Upload Queue</h3>
            <div class="upload-list"></div>
            <div class="upload-progress-container">
                <div class="upload-progress-bar"></div>
            </div>
            <div class="upload-actions">
                <button class="btn-cancel">Cancel</button>
                <button class="btn-upload">Upload Files</button>
            </div>
        `;
        modal.innerHTML = modalContent;
        document.body.appendChild(modal);

        updateList();

        modal.querySelector('.btn-cancel').onclick = () => modal.remove();

        const uploadBtn = modal.querySelector('.btn-upload');
        const progressBar = modal.querySelector('.upload-progress-container');
        const progressBarFill = modal.querySelector('.upload-progress-bar');

        uploadBtn.onclick = async () => {
            uploadBtn.innerText = 'Uploading...';
            uploadBtn.disabled = true;
            progressBar.style.display = 'block';

            await this.processUpload(files, type, path, container, () => {
                progressBarFill.style.width = '100%';
                setTimeout(() => {
                    alert(`Uploaded ${files.length} files successfully.`);
                    modal.remove();
                }, 500);
            }, (err) => {
                alert('Upload failed: ' + err);
                uploadBtn.innerText = 'Retry';
                uploadBtn.disabled = false;
                progressBar.style.display = 'none';
                progressBarFill.style.width = '0%';
            }, (percent) => {
                progressBarFill.style.width = `${percent}%`;
            });
        };
    }

    static processUpload(files, type, path, container, onSuccess, onError, onProgress) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('action', 'upload');
            formData.append('type', type === 'my-doc' ? 'private' : 'public');
            formData.append('path', path);

            // Append files
            if (files instanceof FileList || Array.isArray(files)) {
                Array.from(files).forEach(file => formData.append('files[]', file));
            } else {
                formData.append('files[]', files);
            }

            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'api/files.php', true);

            // Progress event
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = (e.loaded / e.total) * 100;
                    if (onProgress) onProgress(percent);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (data.success) {
                            Notify.show('File(s) uploaded successfully', 'success');
                            // Refresh
                            if (container) {
                                this.load(container, type, path);
                            }
                            if (onSuccess) onSuccess();
                            resolve(data);
                        } else {
                            if (onError) onError(data.message);
                            else Notify.show('Upload failed: ' + data.message, 'error');
                            resolve(false);
                        }
                    } catch (e) {
                        if (onError) onError('Invalid server response');
                        resolve(false);
                    }
                } else {
                    if (onError) onError(`HTTP Error ${xhr.status}`);
                    resolve(false);
                }
            };

            xhr.onerror = () => {
                if (onError) onError('Connection error');
                else Notify.show('Connection error', 'error');
                resolve(false);
            };

            xhr.send(formData);
        });
    }

    static formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }
}
