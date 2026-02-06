// js/widgets.js

class Widgets {
    static init() {
        this.renderWidgets();
        this.startClock();
        this.loadPersonData();
    }

    static renderWidgets() {
        const area = document.getElementById('widget-area');
        area.innerHTML = `
            <!-- Clock Widget -->
            <div class="widget-card widget-clock">
                <div class="clock-time">00:00</div>
                <div class="clock-date">Mon, 01 Jan</div>
            </div>

            <!-- Person Widget -->
            <div class="widget-card widget-person">
                <img src="assets/defaults/avatar.png" class="person-avatar" id="widget-avatar">
                <div class="person-info">
                    <h3 id="widget-username">User</h3>
                    <div class="storage-bar">
                         <div class="storage-fill" style="width: 0%"></div>
                    </div>
                    <small id="widget-stats">0 items / 0 MB</small>
                </div>
            </div>

            <!-- File Detail Widget -->
            <div class="widget-card widget-file-detail" id="widget-file-detail" style="display:none;">
                <h4 style="margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;">File Info</h4>
                <div class="detail-label">Name</div>
                <div class="detail-val" id="detail-name">-</div>
                <div class="detail-label">Type</div>
                <div class="detail-val" id="detail-type">-</div>
                <div class="detail-label">Size</div>
                <div class="detail-val" id="detail-size">-</div>
                <div class="detail-label">Modified</div>
                <div class="detail-val" id="detail-mod">-</div>
            </div>

            <!-- Preview Widget (Sidebar) -->
             <div class="widget-card widget-preview" id="widget-preview" style="display:none; text-align:center;">
                  <h4 style="margin-bottom:10px;">Preview</h4>
                  <div id="sidebar-preview-content"></div>
             </div>
        `;
    }

    static startClock() {
        const update = () => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

            document.querySelector('.clock-time').textContent = timeStr;
            document.querySelector('.clock-date').textContent = dateStr;
        };
        update();
        setInterval(update, 1000);
    }

    static async loadPersonData() {
        try {
            const res = await fetch('api/stats.php');
            const data = await res.json();

            if (data.success) {
                document.getElementById('widget-username').textContent = data.username;
                const usedMB = (data.usedSpace / 1024 / 1024).toFixed(2);
                document.getElementById('widget-stats').textContent = `${data.fileCount} items / ${usedMB} MB`;
                document.querySelector('.storage-fill').style.width = `${data.percent}%`;

                // Set default avatar if not set (Todo: fetch specific avatar url)
                // document.getElementById('widget-avatar').src = ...
            }
        } catch (e) { console.error('Stats error', e); }
    }

    static updateFileDetail(file) {
        const detailWidget = document.getElementById('widget-file-detail');
        const previewWidget = document.getElementById('widget-preview');

        detailWidget.style.display = 'block';

        document.getElementById('detail-name').textContent = file.name;
        document.getElementById('detail-type').textContent = file.type.toUpperCase();
        document.getElementById('detail-size').textContent = this.formatBytes(file.size);
        document.getElementById('detail-mod').textContent = new Date(file.modTime * 1000).toLocaleString();

        // Preview Widget Logic
        if (['jpg', 'png', 'jpeg', 'gif'].includes(file.type)) {
            previewWidget.style.display = 'block';
            const ctx = document.querySelector('.file-grid').parentNode.getAttribute('data-type') === 'my-doc' ? 'private/' + document.getElementById('widget-username').textContent : 'public';
            const path = `eDoc/${ctx}/${file.relPath}`;

            document.getElementById('sidebar-preview-content').innerHTML = `
                <img src="${path}" style="max-width:100%; border-radius:8px;">
             `;
        } else {
            previewWidget.style.display = 'none';
        }
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
