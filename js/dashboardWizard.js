class DashboardWizard {
    static state = { files: [], file: null, rows: [], columns: [], widgets: [] };

    static render(container) {
        this.container = container;
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.innerHTML = `
            <div style="display:flex; gap:8px; padding:12px; border-bottom:1px solid rgba(255,255,255,.1);">
                <button class="win-btn dw-step" data-step="1">1. CSV</button>
                <button class="win-btn dw-step" data-step="2" disabled>2. Design</button>
                <button class="win-btn dw-step" data-step="3" disabled>3. Dashboard</button>
            </div>
            <div class="dw-body" style="flex:1; overflow:auto; padding:14px;"></div>
        `;
        this.body = container.querySelector('.dw-body');
        this.loadFiles();
    }

    static setStep(step) {
        this.container.querySelectorAll('.dw-step').forEach(btn => {
            btn.style.background = btn.dataset.step === String(step) ? 'var(--primary-color)' : 'rgba(255,255,255,.08)';
            btn.style.color = 'white';
            btn.style.border = 'none';
            btn.style.borderRadius = '6px';
            btn.style.padding = '8px 10px';
        });
    }

    static async loadFiles() {
        this.setStep(1);
        this.body.innerHTML = '<div class="loading-spinner">Loading CSV files...</div>';
        try {
            const res = await fetch('api/files.php?action=csv_list');
            const data = await res.json();
            this.state.files = data.items || [];
            this.renderFilePicker();
        } catch (e) {
            this.body.innerHTML = '<p class="error">Connection Error</p>';
        }
    }

    static escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    static renderFilePicker() {
        this.body.innerHTML = `
            <div style="display:flex; gap:8px; margin-bottom:12px;">
                <input class="dw-file-search" placeholder="Filter CSV..." style="flex:1; padding:9px; border-radius:6px; border:1px solid rgba(255,255,255,.2); background:rgba(0,0,0,.25); color:white;">
                <select class="dw-context" style="padding:9px; border-radius:6px; background:#111; color:white; border:1px solid rgba(255,255,255,.2);">
                    <option>All</option><option>Private</option><option>Public</option>
                </select>
            </div>
            <div class="dw-file-list"></div>
        `;
        const input = this.body.querySelector('.dw-file-search');
        const context = this.body.querySelector('.dw-context');
        const list = this.body.querySelector('.dw-file-list');
        const renderList = () => {
            const term = input.value.toLowerCase();
            const filtered = this.state.files.filter(file =>
                (context.value === 'All' || file.context === context.value) &&
                (`${this.escape(file.name)} ${this.escape(file.path)}`.toLowerCase().includes(term))
            );
            list.innerHTML = filtered.length ? '' : '<div class="empty-state">No CSV files found</div>';
            filtered.forEach(file => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:8px;padding:10px;background:rgba(255,255,255,.05);border-radius:8px;cursor:pointer;';
                row.innerHTML = `<i class="fa-solid fa-file-csv" style="color:#32CD32;font-size:1.5rem;"></i><div style="min-width:0;"><div style="color:#fff;font-weight:600;">${this.escape(file.name)}</div><div style="color:#aaa;font-size:.85em;">${this.escape(file.context)} / ${this.escape(file.path)}</div></div>`;
                row.onclick = () => this.loadCsv(file);
                list.appendChild(row);
            });
        };
        input.oninput = renderList;
        context.onchange = renderList;
        renderList();
    }

    static async loadCsv(file) {
        this.state.file = file;
        this.body.innerHTML = '<div class="loading-spinner">Reading CSV...</div>';
        const type = file.context === 'Public' ? 'public' : 'private';
        const filePath = file.path || file.relPath || file.name || '';
        const url = `api/files.php?action=read_content&type=${type}&path=${encodeURIComponent(filePath)}`;
        console.debug('[DashboardWizard] read CSV', { type, path: filePath, file, url });
        try {
            const res = await fetch(url);
            const contentType = res.headers.get('Content-Type') || '';
            const text = await res.text();
            const trimmed = text.trim();
            if (!res.ok || contentType.includes('application/json')) {
                let message = trimmed || res.statusText || 'Could not read CSV';
                try {
                    const payload = JSON.parse(trimmed);
                    message = payload.message || message;
                } catch (_) {}
                throw new Error(message);
            }
            if (!trimmed) {
                throw new Error('CSV file is empty');
            }
            const parsed = Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
                transformHeader: (header, index) => {
                    const clean = String(header || '').replace(/^\ufeff/, '').trim();
                    return clean || `Column ${index + 1}`;
                },
            });
            this.state.rows = parsed.data || [];
            this.state.columns = (parsed.meta.fields || Object.keys(this.state.rows[0] || {}))
                .filter(col => col && col !== '__parsed_extra');
            if (!this.state.columns.length) {
                throw new Error('No CSV columns found');
            }
            this.state.widgets = this.loadSavedWidgets(file);
            this.container.querySelector('[data-step="2"]').disabled = false;
            this.container.querySelector('[data-step="3"]').disabled = false;
            this.renderDesignStep();
        } catch (e) {
            const message = this.escape(e.message || 'Could not read CSV');
            const debug = this.escape(`type=${type}&path=${filePath}`);
            this.body.innerHTML = `<p class="error">Could not read CSV: ${message}</p><div style="margin:8px 0 12px;color:#aaa;font-size:.85em;word-break:break-all;">${debug}</div><button class="win-btn dw-back-files" style="padding:8px 10px;background:rgba(255,255,255,.12);border:none;border-radius:6px;color:white;">Back to CSV list</button>`;
            this.body.querySelector('.dw-back-files').onclick = () => this.renderFilePicker();
        }
    }

    static loadSavedWidgets(file) {
        const key = this.storageKey(file);
        try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
    }

    static storageKey(file) {
        return `edoc.dashboard.${file.context}.${file.path}`;
    }

    static renderDesignStep() {
        this.setStep(2);
        const numeric = this.state.columns.filter(col => this.isNumericColumn(col));
        const dimensions = [
            ...this.state.columns.filter(col => !numeric.includes(col)),
            ...numeric,
        ];
        const metricOptions = ['__count', ...numeric]
            .map(col => `<option value="${this.escape(col)}">${col === '__count' ? 'Row Count' : this.escape(col)}</option>`)
            .join('');
        const columnOptions = dimensions
            .map(col => `<option value="${this.escape(col)}">${this.escape(col)}${numeric.includes(col) ? ' (number)' : ''}</option>`)
            .join('');
        this.body.innerHTML = `
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:14px;">
                <label style="color:#ccc;">Dimension<select class="dw-dim">${columnOptions}</select></label>
                <label style="color:#ccc;">Metric<select class="dw-metric">${metricOptions}</select></label>
                <label style="color:#ccc;">Aggregation<select class="dw-agg"><option>sum</option><option>avg</option><option>count</option><option>min</option><option>max</option></select></label>
                <label style="color:#ccc;">Display<select class="dw-chart"><option value="bar">Bar chart</option><option value="line">Line chart</option><option value="pie">Pie chart</option><option value="kpi">KPI card</option><option value="table">Table</option></select></label>
            </div>
            <div style="display:flex; gap:8px; margin-bottom:12px;">
                <button class="win-btn dw-preview" style="padding:9px 12px; background:var(--primary-color); border:none; border-radius:6px; color:white;">Preview</button>
                <button class="win-btn dw-add" style="padding:9px 12px; background:#2ecc71; border:none; border-radius:6px; color:white;">Add to dashboard</button>
                <button class="win-btn dw-open-dashboard" style="padding:9px 12px; background:rgba(255,255,255,.12); border:none; border-radius:6px; color:white;">Dashboard</button>
            </div>
            <div class="dw-preview-area" style="min-height:260px; background:rgba(0,0,0,.18); border-radius:8px; padding:12px;"></div>
        `;
        this.body.querySelectorAll('select').forEach(select => {
            select.style.cssText = 'display:block;width:100%;margin-top:5px;padding:8px;border-radius:6px;background:#111;color:white;border:1px solid rgba(255,255,255,.2);';
        });
        const getConfig = () => ({
            dimension: this.body.querySelector('.dw-dim').value,
            metric: this.body.querySelector('.dw-metric').value,
            aggregation: this.body.querySelector('.dw-agg').value,
            chart: this.body.querySelector('.dw-chart').value,
        });
        this.body.querySelector('.dw-preview').onclick = () => this.renderWidget(this.body.querySelector('.dw-preview-area'), getConfig());
        this.body.querySelector('.dw-add').onclick = () => {
            this.state.widgets.push(getConfig());
            localStorage.setItem(this.storageKey(this.state.file), JSON.stringify(this.state.widgets));
            this.renderDashboard();
        };
        this.body.querySelector('.dw-open-dashboard').onclick = () => this.renderDashboard();
        this.renderWidget(this.body.querySelector('.dw-preview-area'), getConfig());
    }

    static isNumericColumn(column) {
        let seen = 0;
        let numeric = 0;
        this.state.rows.forEach(row => {
            const value = row[column];
            if (value === null || value === undefined || value === '') return;
            seen += 1;
            if (typeof value === 'number' && Number.isFinite(value)) numeric += 1;
        });
        return seen > 0 && numeric === seen;
    }

    static aggregate(config) {
        const groups = new Map();
        this.state.rows.forEach(row => {
            const key = row[config.dimension] ?? '(blank)';
            const value = config.metric === '__count' ? 1 : Number(row[config.metric]);
            if (!groups.has(key)) groups.set(key, []);
            if (!Number.isNaN(value)) groups.get(key).push(value);
        });
        return [...groups.entries()].map(([label, values]) => {
            let value = values.length;
            if (config.metric !== '__count') {
                if (config.aggregation === 'sum') value = values.reduce((a, b) => a + b, 0);
                if (config.aggregation === 'avg') value = values.reduce((a, b) => a + b, 0) / (values.length || 1);
                if (config.aggregation === 'min') value = Math.min(...values);
                if (config.aggregation === 'max') value = Math.max(...values);
                if (config.aggregation === 'count') value = values.length;
            }
            return { label: String(label), value: Number(value) || 0 };
        }).sort((a, b) => b.value - a.value).slice(0, 12);
    }

    static renderWidget(target, config) {
        const data = this.aggregate(config);
        target.innerHTML = '';
        if (config.chart === 'kpi') {
            const total = data.reduce((sum, item) => sum + item.value, 0);
            target.innerHTML = `<div style="display:flex;height:100%;align-items:center;justify-content:center;text-align:center;"><div><div style="font-size:2.4rem;font-weight:700;color:#fff;">${this.formatNumber(total)}</div><div style="color:#aaa;">${this.escape(config.aggregation)} ${this.escape(config.metric)}</div></div></div>`;
            return;
        }
        if (config.chart === 'table') {
            target.innerHTML = `<table style="width:100%;border-collapse:collapse;color:white;"><thead><tr><th style="text-align:left;padding:6px;border-bottom:1px solid rgba(255,255,255,.15);">${this.escape(config.dimension)}</th><th style="text-align:right;padding:6px;border-bottom:1px solid rgba(255,255,255,.15);">${this.escape(config.metric)}</th></tr></thead><tbody>${data.map(item => `<tr><td style="padding:6px;border-bottom:1px solid rgba(255,255,255,.06);">${this.escape(item.label)}</td><td style="padding:6px;text-align:right;border-bottom:1px solid rgba(255,255,255,.06);">${this.formatNumber(item.value)}</td></tr>`).join('')}</tbody></table>`;
            return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = target.clientWidth || 520;
        canvas.height = 260;
        target.appendChild(canvas);
        this.drawChart(canvas, data, config.chart);
    }

    static drawChart(canvas, data, type) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = '12px Outfit, sans-serif';
        const max = Math.max(...data.map(item => item.value), 1);
        if (type === 'pie') {
            const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
            let angle = -Math.PI / 2;
            const colors = ['#3498db', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6', '#1abc9c', '#e67e22'];
            data.forEach((item, i) => {
                const slice = (item.value / total) * Math.PI * 2;
                ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.arc(w / 2, h / 2, 82, angle, angle + slice); ctx.closePath();
                ctx.fillStyle = colors[i % colors.length]; ctx.fill(); angle += slice;
            });
            data.slice(0, 6).forEach((item, i) => { ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(12, 18 + i * 20, 10, 10); ctx.fillStyle = '#ddd'; ctx.fillText(item.label, 28, 28 + i * 20); });
            return;
        }
        const pad = 34;
        if (type === 'line') {
            ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 2; ctx.beginPath();
            data.forEach((item, i) => {
                const x = pad + (i * (w - pad * 2)) / Math.max(data.length - 1, 1);
                const y = h - pad - (item.value / max) * (h - pad * 2);
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            });
            ctx.stroke();
        } else {
            const barW = (w - pad * 2) / Math.max(data.length, 1) - 6;
            data.forEach((item, i) => {
                const barH = (item.value / max) * (h - pad * 2);
                const x = pad + i * (barW + 6);
                const y = h - pad - barH;
                ctx.fillStyle = '#3498db'; ctx.fillRect(x, y, barW, barH);
                ctx.fillStyle = '#aaa'; ctx.save(); ctx.translate(x, h - 10); ctx.rotate(-0.55); ctx.fillText(item.label.slice(0, 12), 0, 0); ctx.restore();
            });
        }
    }

    static renderDashboard() {
        this.setStep(3);
        this.body.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <div style="color:#fff;font-weight:700;">${this.state.file.name}</div>
                <button class="win-btn dw-back" style="padding:8px 10px;background:rgba(255,255,255,.12);border:none;border-radius:6px;color:white;">Add widget</button>
            </div>
            <div class="dw-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;"></div>
        `;
        this.body.querySelector('.dw-back').onclick = () => this.renderDesignStep();
        const grid = this.body.querySelector('.dw-grid');
        if (!this.state.widgets.length) grid.innerHTML = '<div class="empty-state">No dashboard widgets yet</div>';
        this.state.widgets.forEach((config, idx) => {
            const card = document.createElement('div');
            card.style.cssText = 'min-height:300px;background:rgba(255,255,255,.05);border-radius:8px;padding:10px;position:relative;';
            card.innerHTML = `<button style="position:absolute;right:8px;top:8px;background:#e74c3c;color:white;border:none;border-radius:4px;padding:3px 7px;">x</button><div style="color:#ccc;margin-bottom:8px;">${this.escape(config.chart)} - ${this.escape(config.aggregation)} ${this.escape(config.metric)} by ${this.escape(config.dimension)}</div><div class="dw-card-body" style="height:260px;"></div>`;
            card.querySelector('button').onclick = () => { this.state.widgets.splice(idx, 1); localStorage.setItem(this.storageKey(this.state.file), JSON.stringify(this.state.widgets)); this.renderDashboard(); };
            grid.appendChild(card);
            this.renderWidget(card.querySelector('.dw-card-body'), config);
        });
    }

    static formatNumber(value) {
        return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
}
