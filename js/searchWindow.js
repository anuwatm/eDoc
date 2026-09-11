// js/searchWindow.js

class RecentWindow {
static async render(container) {
        container.setAttribute('data-view', 'recent-files');
        container.innerHTML = '<div class="loading-spinner">Loading recent files...</div>';
        try {
            const res = await fetch('api/files.php?action=recent');
            if (!res.ok) {
                container.innerHTML = `<p class="error">HTTP ${res.status}: Failed to load recent files</p>`;
                return;
            }
            const data = await res.json();
            if (!data.success) {
                container.innerHTML = `<p class="error">Error: ${UIHelpers.escapeHtml(data.message || 'Failed to load recent files')}</p>`;
                return;
            }
            RecentWindow.renderFileList(container, data.items || [], 'No recent files');
        } catch (e) {
            container.innerHTML = `<p class="error">Connection Error: ${UIHelpers.escapeHtml(e.message)}</p>`;
        }
    }



static renderFileList(container, items, emptyText) {
        container.innerHTML = '';
        if (!items.length) {
            container.innerHTML = `<div class="empty-state">${emptyText}</div>`;
            return;
        }
        items.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'file-item window-list-row';
            row.style.setProperty('--enter-delay', `${Math.min(index, 12) * 24}ms`);

            const icon = document.createElement('i');
            icon.className = `fa-solid ${SearchWindow.iconForExtension(item.type)}`;
            icon.classList.add('window-list-icon');

            const textWrap = document.createElement('div');
            textWrap.className = 'window-list-text';

            const name = document.createElement('div');
            name.className = 'window-list-title';
            name.textContent = item.name;

            const meta = document.createElement('div');
            meta.className = 'window-list-meta';
            meta.textContent = `${item.context} / ${item.path} • ${UIHelpers.formatSize(item.size || 0)}`;

            textWrap.appendChild(name);
            textWrap.appendChild(meta);
            row.appendChild(icon);
            row.appendChild(textWrap);
            row.onclick = () => SearchWindow.openResult(item);
            container.appendChild(row);
        });
    }


}

class SearchWindow {
static appendHighlighted(element, text, term) {
        const value = String(text || '');
        const query = String(term || '').trim();
        if (!query) {
            element.textContent = value;
            return;
        }
        const pattern = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
        value.split(pattern).forEach(part => {
            if (!part) return;
            const node = document.createElement(part.toLowerCase() === query.toLowerCase() ? 'mark' : 'span');
            node.textContent = part;
            element.appendChild(node);
        });
    }
static render(container, term) {
        container.classList.add('window-pane');

        const query = (term || '').trim();

        container.innerHTML = `
            <div class="window-toolbar">
                <div class="window-toolbar-row">
                    <input class="search-window-input window-input" type="text" value="" placeholder="Search files...">
                    <select class="search-context-filter window-select">
                        <option value="All">All</option>
                        <option value="Private">Private</option>
                        <option value="Public">Public</option>
                    </select>
                    <select class="search-sort window-select">
                        <option value="name">Name</option>
                        <option value="type">Type</option>
                        <option value="context">Location</option>
                    </select>
                    <button class="win-btn search-window-btn window-action-btn">Search</button>
                </div>
            </div>
            <div class="search-window-results window-list-scroll">
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
            SearchWindow.renderList(resultsArea, filtered, input.value.trim());
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



static renderList(container, results, term) {
        container.innerHTML = '';

        const summary = document.createElement('div');
        summary.className = 'window-list-summary';
        summary.textContent = `${results.length} result(s) for "${term}"`;
        container.appendChild(summary);

        if (results.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No files found';
            container.appendChild(empty);
            return;
        }

        results.forEach((result, index) => {
            const item = document.createElement('div');
            item.className = 'file-item window-list-row';
            item.style.setProperty('--enter-delay', `${Math.min(index, 12) * 24}ms`);

            const isFolder = result.type === 'folder';
            const icon = document.createElement('i');
            icon.className = `fa-solid ${isFolder ? 'fa-folder' : SearchWindow.iconForExtension(result.type)}`;
            icon.classList.add('window-list-icon');
            if (isFolder) icon.classList.add('folder');

            const textWrap = document.createElement('div');
            textWrap.className = 'window-list-text';

            const name = document.createElement('div');
            name.className = 'window-list-title';
            this.appendHighlighted(name, result.name, term);

            const path = document.createElement('div');
            path.className = 'window-list-meta';
            this.appendHighlighted(path, `${result.context} / ${result.path}`, term);

            textWrap.appendChild(name);
            textWrap.appendChild(path);
            item.appendChild(icon);
            item.appendChild(textWrap);
            item.onclick = () => SearchWindow.openResult(result);

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



static openResult(result) {
        const type = result.context === 'Public' ? 'public-doc' : 'my-doc';
        const title = type === 'public-doc' ? 'Public Document' : 'My Document';

        if (result.type === 'folder') {
            WindowManager.open(title, type, { path: result.path });
            return;
        }

        FileSystem.preview({
            name: result.name,
            isDir: false,
            type: result.type,
            relPath: result.path
        }, type);
    }


}
