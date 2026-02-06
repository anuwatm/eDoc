// js/widgets.js

// js/widgets.js

class Widgets {
    static init() {
        this.renderWidgets();
    }

    static renderWidgets() {
        const area = document.getElementById('widget-area');
        area.innerHTML = `
            <!-- Clock Widget -->
            <div class="widget-card widget-clock" id="widget-clock" draggable="true">
                <div class="clock-time">00:00</div>
                <div class="clock-date"><i class="fa-regular fa-calendar"></i> <span>Mon, 01 Jan</span></div>
            </div>

            <!-- Person Widget -->
            <div class="widget-card widget-person" id="widget-person" draggable="true">
                <div class="person-info">
                    <img src="assets/defaults/avatar.png" alt="User Avatar" class="person-avatar" id="widget-avatar">
                    <div class="person-details">
                        <h3 id="widget-username">Loading...</h3>
                        <span class="person-role">Administrator</span>
                    </div>
                </div>
                <div class="storage-stats">
                    <div class="stat-row">
                        <span><i class="fa-solid fa-file"></i> Files</span>
                        <span id="widget-file-count">0</span>
                    </div>
                    <div class="stat-row">
                        <span><i class="fa-solid fa-hard-drive"></i> Storage</span>
                        <span id="widget-storage-size">0 MB</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="widget-storage-progress" style="width: 0%"></div>
                    </div>
                </div>
            </div>

            <!-- Detail Widget -->
            <div class="widget-card widget-detail" id="widget-detail" draggable="true" style="display:none;">
                <div class="detail-preview" id="detail-preview">
                    <!-- Preview content (img/video/icon) goes here -->
                    <i class="fa-solid fa-file-lines"></i>
                </div>
                <div class="detail-info">
                    <h4 id="detail-filename">Filename.txt</h4>
                    <div class="detail-row">
                        <span>Type:</span> <span id="detail-type">TXT</span>
                    </div>
                    <div class="detail-row">
                        <span>Size:</span> <span id="detail-size">12 KB</span>
                    </div>
                    <div class="detail-row">
                        <span>Path:</span> <span id="detail-path" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; display: inline-block; vertical-align: bottom;">/My Documents</span>
                    </div>
                    <div class="detail-row">
                        <span>Date:</span> <span id="detail-date">2023-01-01</span>
                    </div>
                </div>
            </div>
        `;

        this.startClock();
        this.updatePersonWidget();
        this.enableDragAndDrop();
    }

    static updateDetailWidget(file, type) {
        const widget = document.getElementById('widget-detail');
        if (!file) {
            widget.style.display = 'none';
            return;
        }
        widget.style.display = 'flex';

        // Update Text Info
        document.getElementById('detail-filename').innerText = file.name;
        document.getElementById('detail-type').innerText = file.isDir ? 'Folder' : file.type.toUpperCase();

        // Size
        const formatSize = (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };
        document.getElementById('detail-size').innerText = file.isDir ? '-' : formatSize(file.size);

        // Path (Construct visual path)
        const basePath = type === 'my-doc' ? '/My Documents' : '/Public';
        const relPath = file.relPath.substring(0, file.relPath.lastIndexOf(file.name));
        document.getElementById('detail-path').innerText = basePath + (relPath ? '/' + relPath : '');
        document.getElementById('detail-path').title = basePath + (relPath ? '/' + relPath : '');

        // Date (Timestamp to Date String)
        const date = new Date(file.modTime * 1000);
        document.getElementById('detail-date').innerText = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Update Preview
        const previewContainer = document.getElementById('detail-preview');
        previewContainer.innerHTML = ''; // Clear

        const realBasePath = type === 'my-doc' ? `private/${window.currentUser}` : 'public';
        const fullWebPath = `eDoc/${realBasePath}/${file.relPath}`;

        if (['jpg', 'png', 'jpeg', 'gif', 'webp'].includes(file.type)) {
            previewContainer.innerHTML = `<img src="${fullWebPath}" style="width:100%; height:100%; object-fit:contain; border-radius:10px;">`;
        } else if (file.type === 'mp4') {
            previewContainer.innerHTML = `
                <video src="${fullWebPath}" style="width:100%; height:100%; object-fit:contain; border-radius:10px;" muted loop autoplay></video>
             `;
        } else {
            // Icons based on type
            let iconClass = 'fa-file-lines';
            let color = '#fff';

            if (file.isDir) { iconClass = 'fa-folder'; color = '#FFD700'; }
            else if (file.type === 'pdf') { iconClass = 'fa-file-pdf'; color = '#e74c3c'; }
            else if (file.type === 'csv') { iconClass = 'fa-file-csv'; color = '#2ecc71'; }
            else if (file.type === 'zip' || file.type === 'rar') { iconClass = 'fa-file-zipper'; color = '#f39c12'; }
            else if (['doc', 'docx'].includes(file.type)) { iconClass = 'fa-file-word'; color = '#3498db'; }

            previewContainer.innerHTML = `<i class="fa-solid ${iconClass}" style="font-size: 3rem; color: ${color};"></i>`;
        }
    }

    static async updatePersonWidget() {
        try {
            const response = await fetch('api/stats.php');
            const data = await response.json();

            if (data.success) {
                document.getElementById('widget-username').innerText = data.username;
                document.getElementById('widget-avatar').src = data.avatar;
                document.getElementById('widget-file-count').innerText = data.fileCount;

                // Format Bytes
                const formatSize = (bytes) => {
                    if (bytes === 0) return '0 B';
                    const k = 1024;
                    const sizes = ['B', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                };

                document.getElementById('widget-storage-size').innerText = formatSize(data.usedSpace);
                document.getElementById('widget-storage-progress').style.width = data.percent + '%';
            }
        } catch (error) {
            console.error('Failed to load person widget data', error);
        }
    }

    static startClock() {
        const update = () => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

            const timeEl = document.querySelector('.clock-time');
            const dateEl = document.querySelector('.clock-date span');

            if (timeEl) timeEl.textContent = timeStr;
            if (dateEl) dateEl.textContent = dateStr;
        };
        update();
        setInterval(update, 1000);
    }

    static enableDragAndDrop() {
        const container = document.getElementById('widget-area');
        const widgets = container.querySelectorAll('.widget-card');

        widgets.forEach(widget => {
            widget.addEventListener('dragstart', () => {
                widget.classList.add('dragging');
            });

            widget.addEventListener('dragend', () => {
                widget.classList.remove('dragging');
            });
        });

        container.addEventListener('dragover', e => {
            e.preventDefault(); // Allow dropping
            const afterElement = this.getDragAfterElement(container, e.clientY);
            const draggable = document.querySelector('.dragging');
            if (afterElement == null) {
                container.appendChild(draggable);
            } else {
                container.insertBefore(draggable, afterElement);
            }
        });
    }

    static getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.widget-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
}
