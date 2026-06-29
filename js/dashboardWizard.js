class DashboardWizard {
    static state = {
        files: [],
        file: null,
        rows: [],
        columns: [],
        columnMeta: {},
        widgets: [],
        step: 1,
        editingIndex: null,
    };

    static chartInstances = new Map();
    static CHART_COLORS = ['#2575fc', '#6a11cb', '#2ecc71', '#f1c40f', '#e74c3c', '#1abc9c', '#9b59b6', '#e67e22'];
    static LIMIT_OPTIONS = [10, 15, 20, 30, 50, 100, 0];
    static UNIQUE_VALUE_LIMIT = 80;
    static TEXT_OPS = [
        ['eq', 'เท่ากับ'],
        ['neq', 'ไม่เท่ากับ'],
        ['contains', 'มีคำว่า'],
        ['empty', 'ว่าง'],
        ['not_empty', 'ไม่ว่าง'],
    ];
    static NUM_OPS = [
        ['eq', 'เท่ากับ'],
        ['neq', 'ไม่เท่ากับ'],
        ['gt', 'มากกว่า'],
        ['gte', 'มากกว่าหรือเท่า'],
        ['lt', 'น้อยกว่า'],
        ['lte', 'น้อยกว่าหรือเท่า'],
        ['empty', 'ว่าง'],
        ['not_empty', 'ไม่ว่าง'],
    ];

    static render(container) {
        this.container = container;
        container.classList.add('dw-root');
        container.innerHTML = `
            <div class="dw-header">
                <div class="dw-header-title" id="dw-file-title">Dashboard Wizard</div>
                <div class="dw-header-meta" id="dw-file-meta">เลือกไฟล์ CSV เพื่อเริ่มสร้างกราฟ</div>
                <div class="dw-steps">
                    <button class="dw-step active" data-step="1" type="button">1. เลือก CSV</button>
                    <button class="dw-step" data-step="2" type="button" disabled>2. ออกแบบกราฟ</button>
                    <button class="dw-step" data-step="3" type="button" disabled>3. แดชบอร์ด</button>
                </div>
            </div>
            <div class="dw-body"></div>
        `;
        this.body = container.querySelector('.dw-body');
        this.bindStepNav();
        this.goToStep(1);
    }

    static bindStepNav() {
        this.container.querySelectorAll('.dw-step').forEach(btn => {
            btn.onclick = () => {
                const step = Number(btn.dataset.step);
                if (btn.disabled) return;
                if (step === 1) this.goToStep(1);
                if (step === 2 && this.state.file) {
                    this.state.editingIndex = null;
                    this.renderDesignStep();
                }
                if (step === 3 && this.state.file) this.renderDashboard();
            };
        });
    }

    static setStepUI(step) {
        this.state.step = step;
        this.container.querySelectorAll('.dw-step').forEach(btn => {
            const n = Number(btn.dataset.step);
            btn.classList.toggle('active', n === step);
            if (n === 1) btn.disabled = false;
            if (n === 2) btn.disabled = !this.state.file;
            if (n === 3) btn.disabled = !this.state.file;
        });
    }

    static updateHeader() {
        const title = this.container.querySelector('#dw-file-title');
        const meta = this.container.querySelector('#dw-file-meta');
        if (!this.state.file) {
            title.textContent = 'Dashboard Wizard';
            meta.textContent = 'เลือกไฟล์ CSV เพื่อเริ่มสร้างกราฟ';
            return;
        }
        const f = this.state.file;
        title.textContent = f.name;
        const rows = this.state.rows.length.toLocaleString();
        const widgets = this.state.widgets.length;
        meta.textContent = `${f.context} · ${f.path} · ${rows} แถว · ${widgets} widget`;
    }

    static goToStep(step) {
        this.setStepUI(step);
        if (step === 1) this.loadFiles();
    }

    static async loadFiles() {
        this.setStepUI(1);
        this.body.innerHTML = '<div class="loading-spinner">กำลังโหลดรายการ CSV...</div>';
        try {
            const res = await fetch('api/files.php?action=csv_list');
            const data = await res.json();
            this.state.files = data.items || [];
            this.renderFilePicker();
        } catch (e) {
            this.body.innerHTML = '<p class="error">เชื่อมต่อไม่ได้</p>';
        }
    }

    static escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    static formatBytes(bytes) {
        if (!bytes) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        let n = bytes;
        let i = 0;
        while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
        return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
    }

    static renderFilePicker() {
        this.updateHeader();
        this.body.innerHTML = `
            <p class="dw-hint">เลือกไฟล์ CSV จาก My Document หรือ Public Document — รองรับข้อมูลหลักหมื่นแถว</p>
            <div class="dw-toolbar">
                <input class="dw-input dw-file-search" placeholder="ค้นหาชื่อหรือ path...">
                <select class="dw-select dw-context">
                    <option value="All">ทั้งหมด</option>
                    <option value="Private">Private</option>
                    <option value="Public">Public</option>
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
                (`${file.name} ${file.path}`.toLowerCase().includes(term))
            );
            list.innerHTML = filtered.length ? '' : '<div class="empty-state">ไม่พบไฟล์ CSV</div>';
            filtered.forEach(file => {
                const row = document.createElement('div');
                row.className = 'dw-file-row';
                row.innerHTML = `
                    <i class="fa-solid fa-file-csv"></i>
                    <div style="min-width:0;flex:1;">
                        <div class="dw-file-name">${this.escape(file.name)}</div>
                        <div class="dw-file-path">${this.escape(file.context)} / ${this.escape(file.path)} · ${this.formatBytes(file.size)}</div>
                    </div>
                    <i class="fa-solid fa-chevron-right" style="color:#666;"></i>
                `;
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
        this.state.editingIndex = null;
        this.body.innerHTML = '<div class="loading-spinner">กำลังอ่าน CSV...</div>';
        const type = file.context === 'Public' ? 'public' : 'private';
        const filePath = file.path || file.relPath || file.name || '';
        const url = `api/files.php?action=read_content&type=${type}&path=${encodeURIComponent(filePath)}`;
        try {
            const res = await fetch(url);
            const contentType = res.headers.get('Content-Type') || '';
            const text = await res.text();
            const trimmed = text.trim();
            if (!res.ok || contentType.includes('application/json')) {
                let message = trimmed || res.statusText || 'อ่าน CSV ไม่ได้';
                try {
                    const payload = JSON.parse(trimmed);
                    message = payload.message || message;
                } catch (_) {}
                throw new Error(message);
            }
            if (!trimmed) throw new Error('ไฟล์ CSV ว่าง');

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
            if (!this.state.columns.length) throw new Error('ไม่พบคอลัมน์ใน CSV');

            this.state.columnMeta = this.analyzeColumns();
            this.state.widgets = this.loadSavedWidgets(file);
            this.updateHeader();
            this.renderDesignStep();
        } catch (e) {
            const message = this.escape(e.message || 'อ่าน CSV ไม่ได้');
            this.body.innerHTML = `
                <p class="error">อ่าน CSV ไม่ได้: ${message}</p>
                <button class="dw-btn dw-btn-ghost dw-back-files" type="button">กลับไปเลือกไฟล์</button>
            `;
            this.body.querySelector('.dw-back-files').onclick = () => this.renderFilePicker();
        }
    }

    static analyzeColumns() {
        const meta = {};
        this.state.columns.forEach(col => {
            let seen = 0;
            let numeric = 0;
            let dateLike = 0;
            this.state.rows.forEach(row => {
                const value = row[col];
                if (value === null || value === undefined || value === '') return;
                seen += 1;
                if (typeof value === 'number' && Number.isFinite(value)) numeric += 1;
                else if (this.looksLikeDate(value)) dateLike += 1;
            });
            meta[col] = {
                numeric: seen > 0 && numeric === seen,
                dateLike: seen > 0 && dateLike >= seen * 0.8,
                seen,
            };
        });
        return meta;
    }

    static looksLikeDate(value) {
        if (value instanceof Date && !Number.isNaN(value.getTime())) return true;
        const s = String(value).trim();
        if (!s) return false;
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
        if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s)) return true;
        const d = Date.parse(s);
        return !Number.isNaN(d) && /[\/\-:]/.test(s);
    }

    static getDefaultConfig() {
        const dims = this.state.columns.filter(c => !this.state.columnMeta[c]?.numeric);
        const nums = this.state.columns.filter(c => this.state.columnMeta[c]?.numeric);
        const dimension = dims[0] || this.state.columns[0] || '';
        const metric = nums[0] || '__count';
        const chart = this.state.columnMeta[dimension]?.dateLike ? 'line' : 'bar';
        return {
            title: '',
            dimension,
            metric,
            aggregation: metric === '__count' ? 'count' : 'sum',
            chart,
            limit: 15,
            filters: [],
        };
    }

    static loadSavedWidgets(file) {
        const key = this.storageKey(file);
        try {
            const saved = JSON.parse(localStorage.getItem(key)) || [];
            return saved.map(w => ({ limit: 15, title: '', filters: [], ...w }));
        } catch {
            return [];
        }
    }

    static storageKey(file) {
        return `edoc.dashboard.${file.context}.${file.path}`;
    }

    static saveWidgets() {
        localStorage.setItem(this.storageKey(this.state.file), JSON.stringify(this.state.widgets));
        this.updateHeader();
    }

    static getOperators(column) {
        return this.state.columnMeta[column]?.numeric ? this.NUM_OPS : this.TEXT_OPS;
    }

    static needsValue(operator) {
        return operator !== 'empty' && operator !== 'not_empty';
    }

    static getUniqueValues(column) {
        const set = new Set();
        for (const row of this.state.rows) {
            const v = row[column];
            if (v === null || v === undefined || v === '') continue;
            set.add(String(v));
            if (set.size > this.UNIQUE_VALUE_LIMIT) {
                return { values: [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), truncated: true };
            }
        }
        return { values: [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), truncated: false };
    }

    static applyFilters(rows, filters) {
        const active = (filters || []).filter(f => f?.column);
        if (!active.length) return rows;
        return rows.filter(row => active.every(f => this.matchFilter(row, f)));
    }

    static matchFilter(row, filter) {
        const raw = row[filter.column];
        const isEmpty = raw === null || raw === undefined || String(raw).trim() === '';
        const str = isEmpty ? '' : String(raw).trim();
        const fVal = String(filter.value ?? '').trim();
        const isNumeric = this.state.columnMeta[filter.column]?.numeric;

        switch (filter.operator) {
            case 'empty': return isEmpty;
            case 'not_empty': return !isEmpty;
            case 'eq':
                return isNumeric ? Number(raw) === Number(fVal) : str === fVal;
            case 'neq':
                return isNumeric ? Number(raw) !== Number(fVal) : str !== fVal;
            case 'contains':
                return str.toLowerCase().includes(fVal.toLowerCase());
            case 'gt': return Number(raw) > Number(fVal);
            case 'gte': return Number(raw) >= Number(fVal);
            case 'lt': return Number(raw) < Number(fVal);
            case 'lte': return Number(raw) <= Number(fVal);
            default: return true;
        }
    }

    static collectFilters() {
        if (!this.body) return [];
        return [...this.body.querySelectorAll('.dw-filter-row')].map(row => ({
            column: row.querySelector('.dw-filter-col')?.value || '',
            operator: row.querySelector('.dw-filter-op')?.value || 'eq',
            value: row.querySelector('.dw-filter-val')?.value ?? '',
        })).filter(f => f.column);
    }

    static filterSummary(filters) {
        const active = (filters || []).filter(f => f?.column);
        if (!active.length) return '';
        const parts = active.map(f => {
            const op = [...this.TEXT_OPS, ...this.NUM_OPS].find(([k]) => k === f.operator)?.[1] || f.operator;
            if (!this.needsValue(f.operator)) return `${f.column} ${op}`;
            return `${f.column} ${op} "${f.value}"`;
        });
        return parts.join(' และ ');
    }

    static renderFilterValueInput(column, operator, value = '') {
        if (!this.needsValue(operator)) return '<span class="dw-filter-empty">—</span>';
        if (!column) return `<input class="dw-input dw-filter-val" placeholder="เลือกคอลัมน์ก่อน..." value="${this.escape(value)}">`;
        const { values, truncated } = this.getUniqueValues(column);
        if (!truncated && values.length > 0 && values.length <= this.UNIQUE_VALUE_LIMIT) {
            const options = ['<option value="">-- เลือก --</option>']
                .concat(values.map(v => `<option value="${this.escape(v)}"${value === v ? ' selected' : ''}>${this.escape(v)}</option>`));
            return `<select class="dw-select dw-filter-val">${options.join('')}</select>`;
        }
        return `<input class="dw-input dw-filter-val" placeholder="ค่าที่ต้องการ..." value="${this.escape(value)}">`;
    }

    static renderFilterRow(filter = { column: '', operator: 'eq', value: '' }) {
        const row = document.createElement('div');
        row.className = 'dw-filter-row';
        const colOptions = this.state.columns
            .map(col => `<option value="${this.escape(col)}"${filter.column === col ? ' selected' : ''}>${this.escape(col)}</option>`)
            .join('');
        const column = filter.column || this.state.columns[0] || '';
        const ops = this.getOperators(column);
        const opOptions = ops
            .map(([k, label]) => `<option value="${k}"${filter.operator === k ? ' selected' : ''}>${label}</option>`)
            .join('');

        row.innerHTML = `
            <select class="dw-select dw-filter-col"><option value="">-- คอลัมน์ --</option>${colOptions}</select>
            <select class="dw-select dw-filter-op">${opOptions}</select>
            <div class="dw-filter-val-wrap">${this.renderFilterValueInput(column, filter.operator || 'eq', filter.value)}</div>
            <button class="dw-filter-remove" type="button" title="ลบเงื่อนไข"><i class="fa-solid fa-xmark"></i></button>
        `;

        const colEl = row.querySelector('.dw-filter-col');
        const opEl = row.querySelector('.dw-filter-op');
        const valWrap = row.querySelector('.dw-filter-val-wrap');
        const onChange = () => this.onFilterChange();

        const refreshValue = () => {
            const op = opEl.value;
            const valEl = row.querySelector('.dw-filter-val');
            const current = valEl ? valEl.value : '';
            valWrap.innerHTML = this.renderFilterValueInput(colEl.value, op, current);
            valWrap.querySelector('.dw-filter-val')?.addEventListener('input', onChange);
            valWrap.querySelector('.dw-filter-val')?.addEventListener('change', onChange);
        };

        const refreshOps = () => {
            const col = colEl.value;
            const currentOp = opEl.value;
            const newOps = this.getOperators(col);
            opEl.innerHTML = newOps
                .map(([k, label]) => `<option value="${k}"${currentOp === k ? ' selected' : ''}>${label}</option>`)
                .join('');
            if (!newOps.some(([k]) => k === currentOp)) opEl.value = newOps[0][0];
            refreshValue();
        };

        colEl.onchange = () => { refreshOps(); onChange(); };
        opEl.onchange = () => { refreshValue(); onChange(); };
        valWrap.querySelector('.dw-filter-val')?.addEventListener('input', onChange);
        valWrap.querySelector('.dw-filter-val')?.addEventListener('change', onChange);
        row.querySelector('.dw-filter-remove').onclick = () => {
            const list = row.parentElement;
            row.remove();
            if (list && !list.querySelector('.dw-filter-row')) {
                list.innerHTML = '<div class="dw-filter-empty">ยังไม่มีเงื่อนไข — กด "เพิ่มเงื่อนไข" เพื่อกรองข้อมูลก่อนสร้างกราฟ</div>';
            }
            this.onFilterChange();
        };
        return row;
    }

    static renderFilterPanel(filters = []) {
        const list = this.body.querySelector('.dw-filter-list');
        const status = this.body.querySelector('.dw-filter-status');
        if (!list) return;

        list.innerHTML = '';
        const items = filters.length ? filters : [];
        if (!items.length) {
            list.innerHTML = '<div class="dw-filter-empty">ยังไม่มีเงื่อนไข — กด "เพิ่มเงื่อนไข" เพื่อกรองข้อมูลก่อนสร้างกราฟ</div>';
        } else {
            items.forEach(f => list.appendChild(this.renderFilterRow(f)));
        }
        this.updateFilterStatus(status);
    }

    static updateFilterStatus(el) {
        const status = el || this.body?.querySelector('.dw-filter-status');
        if (!status) return;
        const filters = this.collectFilters();
        const filtered = this.applyFilters(this.state.rows, filters);
        const total = this.state.rows.length;
        const count = filtered.length;
        if (!filters.length) {
            status.textContent = `ใช้ข้อมูลทั้งหมด ${total.toLocaleString()} แถว`;
            status.classList.remove('active');
            return;
        }
        status.textContent = `กรองแล้ว ${count.toLocaleString()} จาก ${total.toLocaleString()} แถว`;
        status.classList.toggle('active', count < total);
        if (!count) status.textContent += ' — ไม่มีแถวที่ตรงเงื่อนไข';
    }

    static onFilterChange() {
        this.updateFilterStatus();
        const wrap = this.body.querySelector('.dw-chart-wrap');
        if (wrap && this.body.querySelector('.dw-dim')) {
            this.renderWidget(wrap, this.getDesignConfig(), 'preview');
        }
    }

    static getDesignConfig() {
        return {
            title: this.body.querySelector('.dw-title')?.value.trim() || '',
            dimension: this.body.querySelector('.dw-dim')?.value || '',
            metric: this.body.querySelector('.dw-metric')?.value || '__count',
            aggregation: this.body.querySelector('.dw-agg')?.value || 'sum',
            chart: this.body.querySelector('.dw-chart')?.value || 'bar',
            limit: Number(this.body.querySelector('.dw-limit')?.value ?? 15),
            filters: this.collectFilters(),
        };
    }

    static renderDesignStep() {
        this.setStepUI(2);
        const config = this.state.editingIndex !== null
            ? { ...this.getDefaultConfig(), ...this.state.widgets[this.state.editingIndex] }
            : this.getDefaultConfig();

        const numeric = this.state.columns.filter(c => this.state.columnMeta[c]?.numeric);
        const dimensions = [
            ...this.state.columns.filter(c => !this.state.columnMeta[c]?.numeric),
            ...numeric,
        ];
        const metricOptions = ['__count', ...numeric]
            .map(col => `<option value="${this.escape(col)}"${config.metric === col ? ' selected' : ''}>${col === '__count' ? 'จำนวนแถว (Count)' : this.escape(col)}</option>`)
            .join('');
        const columnOptions = dimensions
            .map(col => {
                const tag = this.state.columnMeta[col]?.dateLike ? ' · วันที่' : (numeric.includes(col) ? ' · ตัวเลข' : '');
                return `<option value="${this.escape(col)}"${config.dimension === col ? ' selected' : ''}>${this.escape(col)}${tag}</option>`;
            })
            .join('');
        const limitOptions = this.LIMIT_OPTIONS
            .map(n => `<option value="${n}"${config.limit === n ? ' selected' : ''}>${n === 0 ? 'ทั้งหมด' : `Top ${n}`}</option>`)
            .join('');
        const chartOptions = [
            ['bar', 'แท่ง (Bar)'],
            ['line', 'เส้น (Line)'],
            ['pie', 'วงกลม (Pie)'],
            ['kpi', 'ตัวเลขเด่น (KPI)'],
            ['table', 'ตาราง (Table)'],
        ].map(([v, label]) => `<option value="${v}"${config.chart === v ? ' selected' : ''}>${label}</option>`).join('');
        const aggOptions = ['sum', 'avg', 'count', 'min', 'max']
            .map(a => `<option${config.aggregation === a ? ' selected' : ''}>${a}</option>`).join('');

        const editing = this.state.editingIndex !== null;
        this.body.innerHTML = `
            <p class="dw-hint">${editing ? 'แก้ไข widget' : 'เลือกว่าจะจัดกลุ่มตามคอลัมน์ไหน และวัดค่าอะไร — ดูตัวอย่างด้านล่างก่อนกดเพิ่ม'}</p>
            <div class="dw-summary">
                <span class="dw-summary-chip"><i class="fa-solid fa-table"></i> ${this.state.rows.length.toLocaleString()} แถว</span>
                <span class="dw-summary-chip"><i class="fa-solid fa-columns"></i> ${this.state.columns.length} คอลัมน์</span>
                <span class="dw-summary-chip"><i class="fa-solid fa-chart-pie"></i> ${this.state.widgets.length} widget บันทึกแล้ว</span>
            </div>
            <div class="dw-filter-panel">
                <div class="dw-filter-header">
                    <span><i class="fa-solid fa-filter"></i> กรองข้อมูลก่อนสร้างกราฟ</span>
                    <button class="dw-btn dw-btn-ghost dw-add-filter" type="button"><i class="fa-solid fa-plus"></i> เพิ่มเงื่อนไข</button>
                </div>
                <div class="dw-filter-list"></div>
                <div class="dw-filter-status"></div>
            </div>
            <div class="dw-form-grid">
                <div class="dw-field" style="grid-column:1/-1;">
                    <label>ชื่อกราฟ (ไม่บังคับ)</label>
                    <input class="dw-input dw-title" placeholder="เช่น ยอดขายตามภาค" value="${this.escape(config.title)}">
                </div>
                <div class="dw-field">
                    <label>จัดกลุ่มตาม</label>
                    <select class="dw-select dw-dim">${columnOptions}</select>
                    <div class="dw-field-hint">แกน X / หมวดหมู่</div>
                </div>
                <div class="dw-field">
                    <label>วัดค่า</label>
                    <select class="dw-select dw-metric">${metricOptions}</select>
                    <div class="dw-field-hint">ตัวเลขที่จะรวม</div>
                </div>
                <div class="dw-field">
                    <label>รวมแบบ</label>
                    <select class="dw-select dw-agg">${aggOptions}</select>
                </div>
                <div class="dw-field">
                    <label>แสดงเป็น</label>
                    <select class="dw-select dw-chart">${chartOptions}</select>
                </div>
                <div class="dw-field">
                    <label>จำกัดจำนวน</label>
                    <select class="dw-select dw-limit">${limitOptions}</select>
                    <div class="dw-field-hint">แนะนำ Top 15–20 ถ้าหมวดเยอะ</div>
                </div>
            </div>
            <div class="dw-actions">
                <button class="dw-btn dw-btn-primary dw-preview" type="button"><i class="fa-solid fa-eye"></i> ดูตัวอย่าง</button>
                <button class="dw-btn dw-btn-success dw-add" type="button"><i class="fa-solid fa-plus"></i> ${editing ? 'บันทึกการแก้ไข' : 'เพิ่มลงแดชบอร์ด'}</button>
                <button class="dw-btn dw-btn-ghost dw-open-dashboard" type="button">ไปแดชบอร์ด (${this.state.widgets.length})</button>
                ${editing ? '<button class="dw-btn dw-btn-ghost dw-cancel-edit" type="button">ยกเลิก</button>' : ''}
            </div>
            <div class="dw-preview-area"><div class="dw-chart-wrap"></div></div>
            <div class="dw-sample-table" id="dw-sample"></div>
        `;

        this.renderFilterPanel(config.filters || []);
        this.body.querySelector('.dw-add-filter').onclick = () => {
            const list = this.body.querySelector('.dw-filter-list');
            const empty = list.querySelector('.dw-filter-empty');
            if (empty) empty.remove();
            list.appendChild(this.renderFilterRow({ column: this.state.columns[0] || '', operator: 'eq', value: '' }));
            this.onFilterChange();
        };

        const preview = () => this.renderWidget(this.body.querySelector('.dw-chart-wrap'), this.getDesignConfig(), 'preview');

        this.body.querySelectorAll('.dw-dim, .dw-metric, .dw-agg, .dw-chart, .dw-limit').forEach(el => {
            el.onchange = preview;
        });
        this.body.querySelector('.dw-preview').onclick = preview;
        this.body.querySelector('.dw-add').onclick = () => {
            const cfg = this.getDesignConfig();
            if (this.state.editingIndex !== null) {
                this.state.widgets[this.state.editingIndex] = cfg;
                this.state.editingIndex = null;
            } else {
                this.state.widgets.push(cfg);
            }
            this.saveWidgets();
            this.renderDashboard();
        };
        this.body.querySelector('.dw-open-dashboard').onclick = () => this.renderDashboard();
        if (editing) {
            this.body.querySelector('.dw-cancel-edit').onclick = () => {
                this.state.editingIndex = null;
                this.renderDesignStep();
            };
        }
        this.renderSampleTable();
        preview();
    }

    static renderSampleTable() {
        const wrap = this.body.querySelector('#dw-sample');
        if (!wrap) return;
        const cols = this.state.columns.slice(0, 6);
        const rows = this.state.rows.slice(0, 5);
        wrap.innerHTML = `
            <table class="dw-table">
                <thead><tr>${cols.map(c => `<th>${this.escape(c)}</th>`).join('')}${this.state.columns.length > 6 ? '<th>...</th>' : ''}</tr></thead>
                <tbody>${rows.map(row => `<tr>${cols.map(c => `<td>${this.escape(row[c] ?? '')}</td>`).join('')}${this.state.columns.length > 6 ? '<td>...</td>' : ''}</tr>`).join('')}</tbody>
            </table>
        `;
    }

    static aggregate(config) {
        const groups = new Map();
        const isDateDim = this.state.columnMeta[config.dimension]?.dateLike;
        const rows = this.applyFilters(this.state.rows, config.filters);

        rows.forEach(row => {
            const key = row[config.dimension] ?? '(ว่าง)';
            const raw = config.metric === '__count' ? 1 : row[config.metric];
            const value = config.metric === '__count' ? 1 : Number(raw);
            if (!groups.has(key)) groups.set(key, []);
            if (config.metric === '__count' || !Number.isNaN(value)) groups.get(key).push(value);
        });

        let result = [...groups.entries()].map(([label, values]) => {
            let value = values.length;
            if (config.metric !== '__count') {
                if (config.aggregation === 'sum') value = values.reduce((a, b) => a + b, 0);
                if (config.aggregation === 'avg') value = values.reduce((a, b) => a + b, 0) / (values.length || 1);
                if (config.aggregation === 'min') value = Math.min(...values);
                if (config.aggregation === 'max') value = Math.max(...values);
                if (config.aggregation === 'count') value = values.length;
            }
            return { label: String(label), value: Number(value) || 0, sortKey: label };
        });

        if (isDateDim && config.chart === 'line') {
            result.sort((a, b) => {
                const da = Date.parse(a.label);
                const db = Date.parse(b.label);
                if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
                return String(a.label).localeCompare(String(b.label));
            });
        } else {
            result.sort((a, b) => b.value - a.value);
        }

        if (config.limit > 0) result = result.slice(0, config.limit);
        return result;
    }

    static destroyChart(key) {
        const chart = this.chartInstances.get(key);
        if (chart) {
            chart.destroy();
            this.chartInstances.delete(key);
        }
    }

    static renderWidget(target, config, chartKey = 'widget') {
        this.destroyChart(chartKey);
        const data = this.aggregate(config);
        target.innerHTML = '';

        if (!data.length) {
            target.innerHTML = '<div class="empty-state">ไม่มีข้อมูลสำหรับกราฟนี้</div>';
            return;
        }

        if (config.chart === 'kpi') {
            const total = data.reduce((sum, item) => sum + item.value, 0);
            const display = config.metric === '__count' && config.aggregation === 'count'
                ? total
                : (data.length === 1 ? data[0].value : total);
            const aggLabel = config.metric === '__count' ? 'จำนวนแถว' : `${config.aggregation} ${config.metric}`;
            target.innerHTML = `
                <div class="dw-kpi">
                    <div>
                        <div class="dw-kpi-value">${this.formatNumber(display)}</div>
                        <div class="dw-kpi-label">${this.escape(aggLabel)}${data.length > 1 ? ` (รวม ${data.length} หมวด)` : ''}</div>
                    </div>
                </div>
            `;
            return;
        }

        if (config.chart === 'table') {
            target.innerHTML = `
                <div style="overflow:auto;max-height:260px;">
                    <table class="dw-table">
                        <thead><tr>
                            <th>${this.escape(config.dimension)}</th>
                            <th class="num">${this.escape(config.metric === '__count' ? 'จำนวน' : config.metric)}</th>
                        </tr></thead>
                        <tbody>${data.map(item => `
                            <tr>
                                <td>${this.escape(item.label)}</td>
                                <td class="num">${this.formatNumber(item.value)}</td>
                            </tr>
                        `).join('')}</tbody>
                    </table>
                </div>
            `;
            return;
        }

        if (typeof Chart === 'undefined') {
            target.innerHTML = '<p class="error">Chart.js ไม่พร้อมใช้งาน</p>';
            return;
        }

        const canvas = document.createElement('canvas');
        target.appendChild(canvas);
        const labels = data.map(d => d.label);
        const values = data.map(d => d.value);
        const colors = labels.map((_, i) => this.CHART_COLORS[i % this.CHART_COLORS.length]);

        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: config.chart === 'pie',
                    position: 'right',
                    labels: { color: '#ccc', boxWidth: 12, font: { size: 11 } },
                },
                tooltip: {
                    backgroundColor: 'rgba(15,12,41,0.95)',
                    titleColor: '#fff',
                    bodyColor: '#ddd',
                    callbacks: {
                        label: (ctx) => {
                            const v = ctx.parsed.y ?? ctx.parsed;
                            return ` ${this.formatNumber(v)}`;
                        },
                    },
                },
            },
        };

        let chartConfig;
        if (config.chart === 'pie') {
            chartConfig = {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }],
                },
                options: {
                    ...commonOptions,
                    cutout: '45%',
                    plugins: {
                        ...commonOptions.plugins,
                        legend: { ...commonOptions.plugins.legend, display: labels.length <= 12 },
                    },
                },
            };
        } else if (config.chart === 'line') {
            chartConfig = {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: config.metric === '__count' ? 'จำนวน' : config.metric,
                        data: values,
                        borderColor: '#2ecc71',
                        backgroundColor: 'rgba(46,204,113,0.15)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: labels.length > 30 ? 0 : 3,
                        pointHoverRadius: 5,
                    }],
                },
                options: {
                    ...commonOptions,
                    scales: {
                        x: { ticks: { color: '#888', maxRotation: 45, autoSkip: true, maxTicksLimit: 12 }, grid: { color: 'rgba(255,255,255,0.06)' } },
                        y: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.08)' }, beginAtZero: true },
                    },
                },
            };
        } else {
            chartConfig = {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: config.metric === '__count' ? 'จำนวน' : config.metric,
                        data: values,
                        backgroundColor: colors.map(c => c + 'cc'),
                        borderRadius: 4,
                        maxBarThickness: 48,
                    }],
                },
                options: {
                    ...commonOptions,
                    scales: {
                        x: { ticks: { color: '#888', maxRotation: 45, autoSkip: true, maxTicksLimit: 15 }, grid: { display: false } },
                        y: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.08)' }, beginAtZero: true },
                    },
                },
            };
        }

        const chart = new Chart(canvas, chartConfig);
        this.chartInstances.set(chartKey, chart);
    }

    static widgetTitle(config) {
        if (config.title) return config.title;
        const metric = config.metric === '__count' ? 'จำนวนแถว' : config.metric;
        const chartNames = { bar: 'แท่ง', line: 'เส้น', pie: 'วงกลม', kpi: 'KPI', table: 'ตาราง' };
        return `${chartNames[config.chart] || config.chart}: ${metric} ตาม ${config.dimension}`;
    }

    static renderDashboard() {
        this.setStepUI(3);
        this.state.editingIndex = null;
        this.updateHeader();
        this.destroyChart('preview');

        this.body.innerHTML = `
            <p class="dw-hint">กราฟที่บันทึกไว้ใน browser — คลิก <i class="fa-solid fa-pen"></i> แก้ไข หรือ <i class="fa-solid fa-xmark"></i> ลบ</p>
            <div class="dw-actions">
                <button class="dw-btn dw-btn-primary dw-back" type="button"><i class="fa-solid fa-plus"></i> เพิ่มกราฟใหม่</button>
                <button class="dw-btn dw-btn-ghost dw-change-csv" type="button">เปลี่ยนไฟล์ CSV</button>
            </div>
            <div class="dw-dashboard-grid"></div>
        `;
        this.body.querySelector('.dw-back').onclick = () => {
            this.state.editingIndex = null;
            this.renderDesignStep();
        };
        this.body.querySelector('.dw-change-csv').onclick = () => this.goToStep(1);

        const grid = this.body.querySelector('.dw-dashboard-grid');
        if (!this.state.widgets.length) {
            grid.innerHTML = '<div class="empty-state">ยังไม่มีกราฟ — กด "เพิ่มกราฟใหม่"</div>';
            return;
        }

        this.state.widgets.forEach((config, idx) => {
            const card = document.createElement('div');
            card.className = 'dw-card';
            const limitLabel = config.limit > 0 ? `Top ${config.limit}` : 'ทั้งหมด';
            const filterLabel = this.filterSummary(config.filters);
            const rowCount = this.applyFilters(this.state.rows, config.filters).length;
            card.innerHTML = `
                <div class="dw-card-actions">
                    <button class="dw-card-btn dw-card-btn-edit" type="button" title="แก้ไข"><i class="fa-solid fa-pen"></i></button>
                    <button class="dw-card-btn dw-card-btn-delete" type="button" title="ลบ"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="dw-card-title">${this.escape(this.widgetTitle(config))}</div>
                <div class="dw-card-sub">${this.escape(config.aggregation)} · ${limitLabel} · ${rowCount.toLocaleString()} แถว${filterLabel ? ` · กรอง: ${this.escape(filterLabel)}` : ''}</div>
                <div class="dw-card-body"><div class="dw-chart-wrap"></div></div>
            `;
            card.querySelector('.dw-card-btn-edit').onclick = () => {
                this.state.editingIndex = idx;
                this.renderDesignStep();
            };
            card.querySelector('.dw-card-btn-delete').onclick = () => {
                this.state.widgets.splice(idx, 1);
                this.saveWidgets();
                this.renderDashboard();
            };
            grid.appendChild(card);
            this.renderWidget(card.querySelector('.dw-chart-wrap'), config, `card-${idx}`);
        });
    }

    static formatNumber(value) {
        return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
}