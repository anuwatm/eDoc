// js/trashWindow.js

class TrashWindow {
static async render(container) {
        container.setAttribute('data-view', 'trash-window');
        container.innerHTML = '<div class="loading-spinner">Loading recycle bin...</div>';
        try {
            const [privateRes, publicRes] = await Promise.all([
                fetch('api/files.php?action=trash_list&context=private'),
                fetch('api/files.php?action=trash_list&context=public')
            ]);
            if (!privateRes.ok || !publicRes.ok) {
                container.innerHTML = '<p class="error">Failed to load recycle bin</p>';
                return;
            }
            const privateData = await privateRes.json();
            const publicData = await publicRes.json();
            if (!privateData.success || !publicData.success) {
                const message = privateData.message || publicData.message || 'Failed to load recycle bin';
                container.innerHTML = `<p class="error">Error: ${UIHelpers.escapeHtml(message)}</p>`;
                return;
            }
            const items = [...(privateData.items || []), ...(publicData.items || [])];
            TrashWindow.renderList(container, items);
        } catch (e) {
            container.innerHTML = `<p class="error">Connection Error: ${UIHelpers.escapeHtml(e.message)}</p>`;
        }
    }



static renderList(container, items) {
        container.innerHTML = `
            <div class="trash-list window-list-scroll"></div>
            <div class="trash-footer">
                <button class="win-btn trash-clear window-action-btn danger">Clear trash</button>
            </div>
        `;
        container.classList.add('window-pane');
        const list = container.querySelector('.trash-list');
        const clearBtn = container.querySelector('.trash-clear');
        const privateCount = items.filter(item => item.context === 'private').length;
        clearBtn.disabled = !privateCount;
        clearBtn.style.opacity = privateCount ? '1' : '.45';
        clearBtn.title = privateCount ? 'Clear your private recycle bin' : 'No private trash items to clear';
        clearBtn.onclick = () => FileSystem.clearTrash();
        if (!items.length) {
            list.innerHTML = '<div class="empty-state">Recycle bin is empty</div>';
            return;
        }
        items.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
        items.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'window-list-row';
            row.style.setProperty('--enter-delay', `${Math.min(index, 12) * 24}ms`);

            const ext = (item.name.split('.').pop() || '').toLowerCase();
            const icon = document.createElement('i');
            icon.className = `fa-solid ${item.isDir ? 'fa-folder' : SearchWindow.iconForExtension(ext)}`;
            icon.classList.add('window-list-icon');
            if (item.isDir) icon.classList.add('folder');

            const textWrap = document.createElement('div');
            textWrap.className = 'window-list-text';

            const name = document.createElement('div');
            name.className = 'window-list-title';
            name.textContent = item.name;

            const path = document.createElement('div');
            path.className = 'window-list-meta';
            path.textContent = `${item.context} / ${item.originalPath}`;

            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'win-btn trash-restore window-action-btn compact';
            restoreBtn.textContent = 'Restore';
            restoreBtn.onclick = () => FileSystem.restoreTrashItem(item.id, item.context);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'win-btn trash-delete window-action-btn compact danger';
            deleteBtn.textContent = 'Del';
            deleteBtn.onclick = () => FileSystem.deleteTrashItem(item.id, item.context, item.name);

            textWrap.appendChild(name);
            textWrap.appendChild(path);
            row.appendChild(icon);
            row.appendChild(textWrap);
            row.appendChild(restoreBtn);
            row.appendChild(deleteBtn);
            list.appendChild(row);
        });
    }


}
