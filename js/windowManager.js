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
            FileSystem.load(contentArea, 'my-doc');
        } else if (type === 'public-doc') {
            FileSystem.load(contentArea, 'public-doc');
        } else if (type === 'preview-img') {
            contentArea.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:100%;"><img src="${data.src}" style="max-width:100%; max-height:100%; object-fit:contain;"></div>`;
        } else if (type === 'preview-video') {
            contentArea.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:100%;"><video src="${data.src}" controls style="max-width:100%; max-height:100%;"></video></div>`;
        } else if (type === 'csv-viewer') {
            contentArea.style.display = 'flex';
            contentArea.style.flexDirection = 'column';
            contentArea.innerHTML = `
                <div class="loading-spinner">Loading CSV...</div>
            `;

            // Fetch and render async
            console.log('Fetching CSV from:', data.src);
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
             `;
        } else if (type === 'search-results') {
            contentArea.innerHTML = `<p style="padding:20px;">Searching for: <b>${data.term}</b>...</p>`;
            // Todo: Call Search API
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

    static renderCSV(container, text) {
        // Simple CSV Parser
        const rows = text.trim().split('\n').map(row => {
            // Check if row contains quotes, if so, use regex, else split by comma
            if (row.includes('"')) {
                const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
                // This regex is basic. Let's use a slightly more robust one or fallback to simple split
                // Better simple regex for CSV: /,(?=(?:(?:[^"]*"){2})*[^"]*$)/
                return row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());
            }
            return row.split(',').map(v => v.trim());
        });

        if (rows.length === 0) {
            container.innerHTML = '<div class="empty-state">Empty CSV</div>';
            return;
        }

        const headers = rows[0];
        const data = rows.slice(1);
        let filteredData = [...data];

        container.innerHTML = `
            <div class="csv-toolbar">
                <input type="text" class="csv-search" placeholder="Search data...">
            </div>
            <div class="csv-table-container">
                <table class="csv-table">
                    <thead></thead>
                    <tbody></tbody>
                    <tfoot></tfoot>
                </table>
            </div>
        `;

        const table = container.querySelector('.csv-table');
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        const tfoot = table.querySelector('tfoot');
        const searchInput = container.querySelector('.csv-search');

        // Column filters
        const filters = new Array(headers.length).fill('');

        const renderHeader = () => {
            let tr = document.createElement('tr');
            headers.forEach((h, i) => {
                let th = document.createElement('th');
                th.innerHTML = `
                    <div>${h}</div>
                    <input type="text" placeholder="Filter..." data-idx="${i}">
                `;
                tr.appendChild(th);
            });
            thead.innerHTML = '';
            thead.appendChild(tr);

            // Bind filter inputs
            thead.querySelectorAll('input').forEach(input => {
                input.oninput = (e) => {
                    filters[e.target.dataset.idx] = e.target.value.toLowerCase();
                    applyFilters();
                };
            });
        };

        const renderBody = (displayData) => {
            tbody.innerHTML = '';
            displayData.forEach(row => {
                let tr = document.createElement('tr');
                row.forEach(cell => {
                    let td = document.createElement('td');
                    td.textContent = cell;
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            renderFooter(displayData);
        };

        const renderFooter = (displayData) => {
            tfoot.innerHTML = '';
            let tr = document.createElement('tr');
            tr.className = 'csv-footer-row';

            headers.forEach((_, i) => {
                let td = document.createElement('td');
                // Check if numeric
                const values = displayData.map(r => parseFloat(r[i])).filter(n => !isNaN(n));
                if (values.length > 0 && values.length === displayData.length) {
                    const sum = values.reduce((a, b) => a + b, 0);
                    const avg = sum / values.length;
                    td.innerHTML = `Sum: ${sum.toFixed(2)}<br>Avg: ${avg.toFixed(2)}`;
                } else {
                    td.innerText = '-';
                }
                tr.appendChild(td);
            });
            tfoot.appendChild(tr);
        };

        const applyFilters = () => {
            const term = searchInput.value.toLowerCase();
            filteredData = data.filter(row => {
                // Global search
                const matchesGlobal = term === '' || row.some(cell => cell.toLowerCase().includes(term));
                // Column filters
                const matchesCols = row.every((cell, i) => {
                    return filters[i] === '' || cell.toLowerCase().includes(filters[i]);
                });
                return matchesGlobal && matchesCols;
            });
            renderBody(filteredData);
        };

        searchInput.oninput = applyFilters;

        renderHeader();
        applyFilters(); // Initial render
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

