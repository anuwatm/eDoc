// js/fileSystem.js

class FileSystem {
    static clipboard = null; // { action: 'copy', sourceType, items: [{ relPath, name }] }
    static activeContainer = null;

    static escapeHtml(value) {
        return typeof window.escapeHtml === 'function' ? window.escapeHtml(value) : String(value ?? '');
    }

    static postToFiles(formData) {
        if (typeof window.appendCsrf === 'function') window.appendCsrf(formData);
        return fetch('api/files.php', { method: 'POST', body: formData });
    }

    static async load(container, type, path = '') {
        container.innerHTML = '<div class="loading-spinner">Loading files...</div>';
        container.setAttribute('data-path', path);
        container.setAttribute('data-type', type);

        this.enableDragDrop(container, type, path);
        this.enableKeyboard(container);

        try {
            const response = await fetch(`api/files.php?action=list&type=${type === 'my-doc' ? 'private' : 'public'}&path=${path}`);
            const result = await response.json();

            if (result.success) {
                this.render(container, result.files, type, path);
            } else {
                container.innerHTML = `<p class="error">Error: ${this.escapeHtml(result.message)}</p>`;
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

        files.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'file-item file-item-enter';
            item.style.animationDelay = `${Math.min(index, 14) * 35}ms`;
            item.setAttribute('data-name', file.name);
            item.setAttribute('data-type', file.type);
            item.setAttribute('data-relpath', file.relPath);
            item.onclick = (e) => this.selectFile(e, item, file, type, container);
            item.ondblclick = () => this.openFile(file, type);
            item.oncontextmenu = (e) => this.showContextMenu(e, file, type, container);

            if (['jpg', 'png', 'jpeg', 'gif', 'webp'].includes(file.type)) {
                item.draggable = true;
                item.addEventListener('dragstart', (e) => {
                    e.stopPropagation();
                    const payload = { relPath: file.relPath, name: file.name, type: file.type, docType: type };
                    e.dataTransfer.setData('application/x-edoc-image', JSON.stringify(payload));
                    e.dataTransfer.setData('text/plain', file.name);
                    e.dataTransfer.effectAllowed = 'copy';
                    item.classList.add('dragging-file');
                });
                item.addEventListener('dragend', () => item.classList.remove('dragging-file'));
            }

            let iconClass = 'fa-file';
            let iconColor = '#ccc';

            if (file.isDir) { iconClass = 'fa-folder'; iconColor = '#FFD700'; }
            else if (['jpg', 'png', 'jpeg', 'gif', 'webp'].includes(file.type)) { iconClass = 'fa-image'; iconColor = '#00BFFF'; }
            else if (file.type === 'mp4') { iconClass = 'fa-film'; iconColor = '#FF4500'; }
            else if (file.type === 'csv') { iconClass = 'fa-file-csv'; iconColor = '#32CD32'; }
            else if (file.type === 'pdf') { iconClass = 'fa-file-pdf'; iconColor = '#FF0000'; }
            else if (['doc', 'docx'].includes(file.type)) { iconClass = 'fa-file-word'; iconColor = '#2B579A'; }

            const icon = document.createElement('i');
            icon.className = `fa-solid ${iconClass}`;
            icon.style.color = iconColor;
            const nameSpan = document.createElement('span');
            nameSpan.className = 'file-name';
            nameSpan.textContent = file.name;
            item.appendChild(icon);
            item.appendChild(nameSpan);

            grid.appendChild(item);
        });

        container.appendChild(grid);
    }

    static selectFile(e, element, file, type, container) {
        if (e.ctrlKey || e.metaKey) {
            element.classList.toggle('selected');
        } else {
            container.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
            element.classList.add('selected');
        }

        // Update Widget (only logic change: if multiple selected, hide detail widget, else show)
        const selectedCount = container.querySelectorAll('.file-item.selected').length;
        if (typeof Widgets !== 'undefined') {
            if (selectedCount === 1 && element.classList.contains('selected')) {
                Widgets.updateDetailWidget(file, type);
            } else {
                Widgets.updateDetailWidget(null);
            }
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
        const apiUrl = `api/files.php?action=read_content&type=${contextType === 'my-doc' ? 'private' : 'public'}&path=${encodeURIComponent(file.relPath)}`;

        if (['jpg', 'png', 'jpeg', 'gif', 'webp'].includes(file.type)) {
            WindowManager.open(`Preview: ${file.name}`, 'preview-img', { src: apiUrl, name: file.name });
        } else if (file.type === 'mp4') {
            WindowManager.open(`Preview: ${file.name}`, 'preview-video', { src: apiUrl });
        } else if (file.type === 'csv') {
            WindowManager.open(`CSV: ${file.name}`, 'csv-viewer', {
                src: apiUrl,
                name: file.name,
                relPath: file.relPath,
                context: contextType === 'my-doc' ? 'Private' : 'Public',
            });
        } else if (file.type === 'docx') {
            WindowManager.open(`Preview: ${file.name}`, 'preview-docx', { src: apiUrl, name: file.name });
        } else if (file.type === 'pdf') {
            WindowManager.open(`Preview: ${file.name}`, 'preview-pdf', { src: apiUrl, name: file.name });
        } else if (file.type === 'doc') {
            Notify.show('Legacy .doc is not supported. Save as .docx to preview.', 'info');
        } else {
            Notify.show('No preview available for this file type.', 'info');
        }
    }

    static showContextMenu(e, file, type, container) {
        e.preventDefault();
        document.querySelectorAll('.context-menu').forEach(el => el.remove());

        // If clicking on an unselected item, select only it
        const clickedItem = e.currentTarget;
        if (!clickedItem.classList.contains('selected')) {
            container.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
            clickedItem.classList.add('selected');
        }

        const selectedItems = Array.from(container.querySelectorAll('.file-item.selected'));
        const selectedPaths = selectedItems.map(item => item.getAttribute('data-relpath')).filter(Boolean);

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.top = `${e.clientY}px`;
        menu.style.left = `${e.clientX}px`;

        const options = [];

        if (this.clipboard?.items?.length) {
            options.push({ label: 'Paste', action: () => this.pasteClipboard(container, type) });
        }

        if (selectedItems.length === 1) {
            options.push({ label: 'Open', action: () => this.openFile(file, type) });
            options.push({ label: 'Rename', action: () => this.startInlineRename(container, type) });
        }

        options.push({ label: 'Copy', action: () => this.copySelection(container, type) });
        options.push({ label: 'Copy to...', action: () => this.copyFile(selectedPaths, type) });
        options.push({ label: 'Move to...', action: () => this.moveFile(selectedPaths, type) });
        options.push({ label: 'Download as ZIP', action: () => this.downloadZip(selectedPaths, type) });

        if (type === 'my-doc') {
            options.push({ label: 'Delete', action: () => this.deleteFile(selectedPaths, type) });
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

    static async deleteFile(paths, type) {
        if (!Array.isArray(paths)) paths = [paths.relPath]; // Legacy fallback if object passed
        
        let msg = paths.length === 1 ? `Are you sure you want to delete <b>this file</b>?` : `Are you sure you want to delete <b>${paths.length} items</b>?`;
        if (!await Modal.confirm('Delete', `${msg}<br>Items will be moved to the Recycle Bin and can be restored.`)) return;

        let hasError = false;
        for (const path of paths) {
            const formData = new FormData();
            formData.append('action', 'delete');
            formData.append('path', path);
            formData.append('context', type === 'my-doc' ? 'private' : 'public');

            try {
                const res = await this.postToFiles(formData);
                const data = await res.json();
                if (!data.success) hasError = true;
            } catch (e) {
                hasError = true;
            }
        }

        if (!hasError) {
            Notify.show('Deleted successfully', 'success');
        } else {
            Notify.show('Some items failed to delete', 'warn');
        }

        if (typeof Widgets !== 'undefined') {
            Widgets.updateDetailWidget(null);
            Widgets.updatePersonWidget();
        }

        const targetType = type === 'my-doc' ? 'my-doc' : 'public-doc';
        document.querySelectorAll(`.window-content[data-type="${targetType}"]`).forEach(c => {
            this.load(c, targetType, c.getAttribute('data-path'));
        });
    }


    static normalizeDocType(type) {
        if (type === 'my-doc' || type === 'private') return 'my-doc';
        if (type === 'public-doc' || type === 'public') return 'public-doc';
        return null;
    }

    static refreshDocWindows(type) {
        const docType = this.normalizeDocType(type);
        if (!docType) return false;

        document.querySelectorAll(`.window-content[data-type="${docType}"]`).forEach(container => {
            this.load(container, docType, container.getAttribute('data-path') || '');
        });
        return true;
    }

    static refreshViews(type = null) {
        const targetType = type ? this.normalizeDocType(type) : null;
        document.querySelectorAll('.window-content[data-type]').forEach(container => {
            const currentType = container.getAttribute('data-type');
            if (!targetType || currentType === targetType) {
                this.load(container, currentType, container.getAttribute('data-path') || '');
            }
        });
        document.querySelectorAll('.window-content[data-view="trash-window"]').forEach(container => WindowManager.renderTrash(container));
        document.querySelectorAll('.window-content[data-view="recent-files"]').forEach(container => WindowManager.renderRecentFiles(container));
    }

    static async restoreTrashItem(id, context) {
        const formData = new FormData();
        formData.append('action', 'trash_restore');
        formData.append('id', id);
        formData.append('context', context.toLowerCase());

        try {
            const res = await this.postToFiles(formData);
            const data = await res.json();
            if (data.success) {
                Notify.show('Restored successfully', 'success');
                this.refreshViews();
                if (typeof Widgets !== 'undefined') Widgets.updatePersonWidget();
            } else {
                Notify.show(`Error: ${data.message}`, 'error');
            }
        } catch (e) {
            Notify.show('Connection error', 'error');
        }
    }

    static async deleteTrashItem(id, context, name) {
        const safeName = String(name || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
        if (!await Modal.confirm('Delete forever', `Permanently delete <b>${safeName}</b>?<br>This cannot be undone.`)) return;

        const formData = new FormData();
        formData.append('action', 'trash_delete');
        formData.append('id', id);
        formData.append('context', context.toLowerCase());

        try {
            const res = await this.postToFiles(formData);
            const data = await res.json();
            if (data.success) {
                Notify.show('Deleted forever', 'success');
                this.refreshViews();
                if (typeof Widgets !== 'undefined') Widgets.updatePersonWidget();
            } else {
                Notify.show(`Error: ${data.message}`, 'error');
            }
        } catch (e) {
            Notify.show('Connection error', 'error');
        }
    }
    static async clearTrash() {
        if (!await Modal.confirm('Clear trash', 'Permanently delete <b>all items</b> in your private Recycle Bin?<br>Public trash items are not affected.')) return;

        const formData = new FormData();
        formData.append('action', 'trash_clear');
        formData.append('context', 'private');

        try {
            const res = await this.postToFiles(formData);
            const data = await res.json();
            if (data.success) {
                Notify.show('Trash cleared', 'success');
                this.refreshViews();
                if (typeof Widgets !== 'undefined') Widgets.updatePersonWidget();
            } else {
                Notify.show(`Error: ${data.message}`, 'error');
            }
        } catch (e) {
            Notify.show('Connection error', 'error');
        }
    }

    // Download ZIP
    static downloadZip(paths, type) {
        if (!paths || paths.length === 0) return;

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = 'api/files.php';
        form.target = '_blank';
        form.style.display = 'none';

        const actionInput = document.createElement('input');
        actionInput.type = 'hidden';
        actionInput.name = 'action';
        actionInput.value = 'download_zip';
        form.appendChild(actionInput);

        const contextInput = document.createElement('input');
        contextInput.type = 'hidden';
        contextInput.name = 'context';
        contextInput.value = type === 'my-doc' ? 'private' : 'public';
        form.appendChild(contextInput);

        paths.forEach(p => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'paths[]';
            input.value = p;
            form.appendChild(input);
        });

        if (window.csrfToken) {
            const csrfInput = document.createElement('input');
            csrfInput.type = 'hidden';
            csrfInput.name = 'csrf_token';
            csrfInput.value = window.csrfToken;
            form.appendChild(csrfInput);
        }

        document.body.appendChild(form);
        form.submit();
        setTimeout(() => form.remove(), 1000);
    }

    // Placeholder actions
    static copyFile(paths, type) {
        this.showFileSelector('Copy to...', async (destType, destPath) => {
            for (const p of paths) {
                await this.performFileAction('copy', {relPath: p, name: p.split('/').pop()}, type, destType, destPath);
            }
        });
    }

    static moveFile(paths, type) {
        this.showFileSelector('Move to...', async (destType, destPath) => {
            for (const p of paths) {
                await this.performFileAction('move', {relPath: p, name: p.split('/').pop()}, type, destType, destPath);
            }
        });
    }

    static async performFileAction(action, fileObj, srcType, destType, destPath, options = {}) {
        const { silent = false, skipRefresh = false } = options;
        const formData = new FormData();
        formData.append('action', action);

        const mkPath = (t, p) => t === 'my-doc' ? p : 'public/' + p;

        formData.append('src', mkPath(srcType, fileObj.relPath));
        formData.append('dest', mkPath(destType, (destPath ? destPath + '/' : '') + fileObj.name));

        try {
            const res = await this.postToFiles(formData);
            const data = await res.json();
            if (data.success) {
                if (!silent) {
                    Notify.show(`${action === 'move' ? 'Moved' : 'Copied'} successfully.`, 'success');
                }
                if (!skipRefresh) {
                    this.refreshViews();
                    if (typeof Widgets !== 'undefined') Widgets.updatePersonWidget();
                }
                return true;
            }
            if (!silent) Notify.show(`Error: ${data.message}`, 'error');
            return false;
        } catch (e) {
            console.error(e);
            if (!silent) Notify.show('Connection error', 'error');
            return false;
        }
    }

    static isTypingTarget(el) {
        if (!el) return false;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }

    static getFocusedContainer() {
        const active = document.activeElement;
        if (active?.classList?.contains('file-manager-focusable')) return active;
        if (this.activeContainer?.isConnected) return this.activeContainer;
        return document.querySelector('.window-content.file-manager-focusable[data-type]');
    }

    static getSelectedItems(container) {
        return Array.from(container.querySelectorAll('.file-item.selected')).map(item => ({
            relPath: item.getAttribute('data-relpath'),
            name: item.getAttribute('data-name')
        })).filter(item => item.relPath && item.name);
    }

    static selectAll(container) {
        container.querySelectorAll('.file-item').forEach(el => el.classList.add('selected'));
        if (typeof Widgets !== 'undefined') Widgets.updateDetailWidget(null);
    }

    static navigateUp(container, type) {
        const currentPath = container.getAttribute('data-path') || '';
        if (!currentPath) return;
        const newPath = currentPath.split('/').slice(0, -1).join('/');
        this.load(container, type, newPath);
    }

    static copySelection(container, type) {
        const items = this.getSelectedItems(container);
        if (!items.length) {
            Notify.show('Select file(s) to copy', 'info');
            return;
        }
        this.clipboard = { action: 'copy', sourceType: type, items };
        Notify.show(`Copied ${items.length} item(s)`, 'success');
    }

    static async pasteClipboard(container, type) {
        if (!this.clipboard?.items?.length) {
            Notify.show('Clipboard is empty', 'info');
            return;
        }

        const destPath = container.getAttribute('data-path') || '';
        const { action, sourceType, items } = this.clipboard;
        let ok = 0;
        let fail = 0;

        for (const item of items) {
            const success = await this.performFileAction(action, item, sourceType, type, destPath, {
                silent: true,
                skipRefresh: true
            });
            if (success) ok++;
            else fail++;
        }

        if (ok) Notify.show(`Pasted ${ok} item(s)`, 'success');
        if (fail) Notify.show(`${fail} item(s) failed to paste`, 'warn');

        this.refreshViews();
        if (typeof Widgets !== 'undefined') Widgets.updatePersonWidget();
    }

    static startInlineRename(container, type) {
        const selected = container.querySelector('.file-item.selected');
        if (!selected) {
            Notify.show('Select one file to rename', 'info');
            return;
        }

        const nameEl = selected.querySelector('.file-name');
        if (!nameEl || selected.querySelector('.file-rename-input')) return;

        const currentName = selected.getAttribute('data-name') || nameEl.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'file-rename-input';
        input.value = currentName;

        let committed = false;
        const finish = async (save) => {
            if (committed) return;
            committed = true;
            const newName = input.value.trim();
            if (input.isConnected) input.replaceWith(nameEl);
            if (!save || !newName || newName === currentName) return;

            const relPath = selected.getAttribute('data-relpath');
            const formData = new FormData();
            formData.append('action', 'rename');
            formData.append('path', relPath);
            formData.append('newName', newName);
            formData.append('context', type === 'my-doc' ? 'private' : 'public');

            try {
                const res = await this.postToFiles(formData);
                const data = await res.json();
                if (data.success) {
                    Notify.show('Renamed successfully', 'success');
                    this.refreshViews(type);
                } else {
                    Notify.show(`Rename failed: ${data.message}`, 'error');
                }
            } catch (e) {
                Notify.show('Connection error', 'error');
            }
        };

        input.onkeydown = (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                e.preventDefault();
                finish(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                finish(false);
            }
        };
        input.onblur = () => finish(true);

        nameEl.replaceWith(input);
        input.focus();
        input.select();
    }

    static handleKeyboard(e, container) {
        const type = container.getAttribute('data-type');
        if (!this.normalizeDocType(type)) return;
        if (this.isTypingTarget(e.target)) return;

        const mod = e.ctrlKey || e.metaKey;
        const key = e.key;

        if (mod && key.toLowerCase() === 'a') {
            e.preventDefault();
            this.selectAll(container);
            return;
        }
        if (mod && key.toLowerCase() === 'c') {
            e.preventDefault();
            this.copySelection(container, type);
            return;
        }
        if (mod && key.toLowerCase() === 'v') {
            e.preventDefault();
            this.pasteClipboard(container, type);
            return;
        }
        if (key === 'F2') {
            e.preventDefault();
            this.startInlineRename(container, type);
            return;
        }
        if (key === 'Delete' && type === 'my-doc') {
            const paths = this.getSelectedItems(container).map(item => item.relPath);
            if (!paths.length) return;
            e.preventDefault();
            this.deleteFile(paths, type);
            return;
        }
        if (key === 'Backspace') {
            e.preventDefault();
            this.navigateUp(container, type);
        }
    }

    static enableKeyboard(container) {
        if (container._keyboardBound) return;
        container._keyboardBound = true;
        container.classList.add('file-manager-focusable');
        container.setAttribute('tabindex', '0');

        container.addEventListener('mousedown', () => {
            this.activeContainer = container;
            container.focus({ preventScroll: true });
        });

        container.addEventListener('keydown', (e) => this.handleKeyboard(e, container));
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
                        const folderIcon = document.createElement('i');
                        folderIcon.className = 'fa-solid fa-folder';
                        folderIcon.style.cssText = 'color:#FFD700; margin-right:5px;';
                        d.appendChild(folderIcon);
                        d.appendChild(document.createTextNode(` ${f.name}`));
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
        const dropZone = container.querySelector('.upload-drop-zone') || container;
        const docType = this.normalizeDocType(type);

        const showDropHint = () => {
            if (!docType || container.querySelector('.drop-upload-hint')) return;
            const currentPath = container.getAttribute('data-path') ?? path ?? '';
            const label = docType === 'my-doc' ? 'My Documents' : 'Public';
            const folder = currentPath ? `/${currentPath}` : '/';
            const hint = document.createElement('div');
            hint.className = 'drop-upload-hint';
            hint.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i><span>Drop to upload to <strong>${label}${folder}</strong></span>`;
            container.appendChild(hint);
        };

        const hideDropHint = () => {
            container.querySelector('.drop-upload-hint')?.remove();
        };

        container.ondragenter = (e) => {
            e.preventDefault();
            if (e.dataTransfer.types.includes('application/x-edoc-image')) return;
            dragCounter++;
            dropZone.classList.add('drag-over');
            showDropHint();
        };
        container.ondragover = (e) => { e.preventDefault(); };
        container.ondragleave = () => {
            dragCounter--;
            if (dragCounter === 0) {
                dropZone.classList.remove('drag-over');
                hideDropHint();
            }
        };
        container.ondrop = (e) => {
            e.preventDefault();
            dragCounter = 0;
            dropZone.classList.remove('drag-over');
            hideDropHint();

            if (e.dataTransfer.files.length > 0) {
                const destination = container.querySelector('#upload-destination')?.value || type;
                const currentPath = container.getAttribute('data-path') ?? path ?? '';
                this.handleUploadQueue(e.dataTransfer.files, destination, currentPath, container);
            }
        };
    }

    static handleUploadQueue(fileList, type, path, container) {
        const files = Array.from(fileList);
        const docType = this.normalizeDocType(type) || this.normalizeDocType(container.getAttribute('data-type'));

        if (docType && !container.querySelector('.upload-queue-container')) {
            this.handleDirectUpload(files, docType, path, container);
            return;
        }

        const embeddedContainer = container.querySelector('.upload-queue-container');
        if (embeddedContainer) {
            this.renderEmbeddedQueue(files, embeddedContainer, type, path, container);
        } else {
            this.showUploadModal(files, type, path, container);
        }
    }

    static handleDirectUpload(files, type, path, container) {
        const overlay = this.showUploadOverlay(container, files.length, path, type);
        const progressFill = overlay.querySelector('.direct-upload-progress-bar');
        const statusEl = overlay.querySelector('.direct-upload-status');

        this.processUpload(files, type, path, container, () => {
            if (statusEl) statusEl.textContent = 'Upload complete';
            if (progressFill) progressFill.style.width = '100%';
            setTimeout(() => overlay.remove(), 600);
        }, (err) => {
            if (statusEl) statusEl.textContent = 'Upload failed';
            Notify.show('Upload failed: ' + err, 'error');
            setTimeout(() => overlay.remove(), 1500);
        }, (percent) => {
            if (progressFill) progressFill.style.width = `${percent}%`;
            if (statusEl) statusEl.textContent = `Uploading ${files.length} file(s)... ${Math.round(percent)}%`;
        });
    }

    static showUploadOverlay(container, fileCount, path, type) {
        container.querySelector('.direct-upload-overlay')?.remove();

        const label = type === 'my-doc' ? 'My Documents' : 'Public';
        const folder = path ? `/${path}` : '/';
        const overlay = document.createElement('div');
        overlay.className = 'direct-upload-overlay';
        overlay.innerHTML = `
            <div class="direct-upload-panel">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <div class="direct-upload-status">Uploading ${fileCount} file(s)...</div>
                <div class="direct-upload-dest">${label}${folder}</div>
                <div class="direct-upload-progress"><div class="direct-upload-progress-bar"></div></div>
            </div>
        `;
        container.appendChild(overlay);
        return overlay;
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

                const row = document.createElement('div');
                row.style.cssText = 'display:flex; align-items:center; gap:8px; overflow:hidden;';
                const fileIcon = document.createElement('i');
                fileIcon.className = 'fa-solid fa-file';
                fileIcon.style.color = '#aaa';
                const nameSpan = document.createElement('span');
                nameSpan.style.cssText = 'white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;';
                nameSpan.textContent = file.name;
                const sizeSpan = document.createElement('span');
                sizeSpan.style.cssText = 'font-size:0.8em; color:#666;';
                sizeSpan.textContent = `(${this.formatBytes(file.size)})`;
                row.appendChild(fileIcon);
                row.appendChild(nameSpan);
                row.appendChild(sizeSpan);

                const removeBtn = document.createElement('i');
                removeBtn.className = 'fa-solid fa-trash upload-remove';
                removeBtn.style.cssText = 'color:#ff6b6b; cursor:pointer;';
                removeBtn.dataset.index = String(index);
                removeBtn.title = 'Remove';

                item.appendChild(row);
                item.appendChild(removeBtn);
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

        const progressDiv = document.createElement('div');
        progressDiv.innerHTML = `
            <div class="upload-progress-container" style="margin-bottom: 15px; text-align: left;">
                <div class="upload-progress-bar"></div>
            </div>
        `;
        actionDiv.appendChild(progressDiv);

        const renderActions = () => {
            // Only re-render the button part to avoid destroying the progress bar element
            const existingBtn = actionDiv.querySelector('.btn-upload');
            if (existingBtn) existingBtn.remove();
            
            if (files.length === 0) return;

            const btn = document.createElement('button');
            btn.className = 'btn-upload';
            btn.style.width = '100%';
            btn.style.padding = '10px';
            btn.innerText = `Upload ${files.length} Files`;
            
            const progressBar = actionDiv.querySelector('.upload-progress-container');
            const progressBarFill = actionDiv.querySelector('.upload-progress-bar');
            
            btn.onclick = async () => {
                btn.innerText = 'Uploading...';
                btn.disabled = true;
                progressBar.style.display = 'block';
                progressBarFill.style.width = '0%';
                
                await this.processUpload(files, type, path, container, () => {
                    progressBarFill.style.width = '100%';
                    targetElement.innerHTML = '<div style="text-align:center; color:#4caf50; margin-top:20px;"><i class="fa-solid fa-check-circle"></i> Upload Complete</div>';
                    setTimeout(() => {
                        if (targetElement.innerText.includes('Upload Complete'))
                            targetElement.innerHTML = '<div style="text-align:center; color:#666; font-size:0.9rem; margin-top:20px;">Queue is empty</div>';
                    }, 3000);
                }, (err) => {
                    btn.innerText = 'Retry';
                    btn.disabled = false;
                    progressBar.style.display = 'none';
                    alert(err);
                }, (percent) => {
                    progressBarFill.style.width = `${percent}%`;
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

                const row = document.createElement('div');
                row.style.cssText = 'display:flex; align-items:center; gap:8px; overflow:hidden;';
                const fileIcon = document.createElement('i');
                fileIcon.className = 'fa-solid fa-file';
                const nameSpan = document.createElement('span');
                nameSpan.style.cssText = 'white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
                nameSpan.textContent = file.name;
                const sizeSpan = document.createElement('span');
                sizeSpan.style.cssText = 'font-size:0.8em; color:#aaa;';
                sizeSpan.textContent = `(${this.formatBytes(file.size)})`;
                row.appendChild(fileIcon);
                row.appendChild(nameSpan);
                row.appendChild(sizeSpan);

                const removeBtn = document.createElement('i');
                removeBtn.className = 'fa-solid fa-trash upload-remove';
                removeBtn.dataset.index = String(index);
                removeBtn.title = 'Remove';

                item.appendChild(row);
                item.appendChild(removeBtn);
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
            const uploadType = (type === 'my-doc' || type === 'private') ? 'private' : 'public';
            formData.append('action', 'upload');
            formData.append('type', uploadType);
            formData.append('path', path || '');
            if (typeof window.appendCsrf === 'function') window.appendCsrf(formData);

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
                const raw = xhr.responseText || '';
                let data = null;
                try {
                    data = JSON.parse(raw.trim());
                } catch (e) {
                    const match = raw.match(/\{[\s\S]*\}\s*$/);
                    if (match) {
                        try { data = JSON.parse(match[0]); } catch (_) {}
                    }
                }

                if (!data) {
                    console.error('Upload invalid response:', raw);
                    if (onError) onError('Invalid server response. Check console for raw response.');
                    resolve(false);
                    return;
                }

                if (xhr.status >= 200 && xhr.status < 300 && data.success) {
                    if (data.partial) {
                        Notify.show(data.message || 'Some files were skipped', 'info');
                    } else {
                        Notify.show('File(s) uploaded successfully', 'success');
                    }
                    if (!this.refreshDocWindows(type) && container) {
                        const docType = this.normalizeDocType(container.getAttribute('data-type'));
                        if (docType) {
                            this.load(container, docType, container.getAttribute('data-path') || path || '');
                        } else {
                            this.load(container, type, path || '');
                        }
                    }
                    if (typeof Widgets !== 'undefined') Widgets.updatePersonWidget();
                    if (onSuccess) onSuccess();
                    resolve(data);
                    return;
                }

                const message = data.message || `HTTP Error ${xhr.status}`;
                if (onError) onError(message);
                else Notify.show('Upload failed: ' + message, 'error');
                resolve(false);
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
