class CsvPivot {
    static AGGREGATIONS = [
        ['sum', 'Sum'],
        ['count', 'Count'],
        ['avg', 'Avg'],
        ['min', 'Min'],
        ['max', 'Max'],
    ];

    static escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    static formatNumber(value) {
        return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    static parse(text) {
        if (typeof Papa === 'undefined') {
            throw new Error('PapaParse ไม่พร้อมใช้งาน');
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
        const rows = parsed.data || [];
        const columns = (parsed.meta.fields || Object.keys(rows[0] || {}))
            .filter(col => col && col !== '__parsed_extra');
        return { rows, columns, columnMeta: this.analyzeColumns(rows, columns) };
    }

    static analyzeColumns(rows, columns) {
        const meta = {};
        columns.forEach(col => {
            let seen = 0;
            let numeric = 0;
            rows.forEach(row => {
                const value = row[col];
                if (value === null || value === undefined || value === '') return;
                seen += 1;
                if (typeof value === 'number' && Number.isFinite(value)) numeric += 1;
            });
            meta[col] = { numeric: seen > 0 && numeric === seen, seen };
        });
        return meta;
    }

    static defaultConfig(columns, columnMeta) {
        const dims = columns.filter(c => !columnMeta[c]?.numeric);
        const nums = columns.filter(c => columnMeta[c]?.numeric);
        return {
            rows: dims[0] ? [dims[0]] : (columns[0] ? [columns[0]] : []),
            cols: dims[1] ? [dims[1]] : [],
            values: nums[0]
                ? [{ field: nums[0], aggregation: 'sum' }]
                : [{ field: '__count__', aggregation: 'count' }],
            showTotals: true,
        };
    }

    static normalizeConfig(config) {
        if (config.rows) return config;
        return {
            rows: config.rowFields || [],
            cols: config.colField ? [config.colField] : [],
            values: [{
                field: config.valueField || '__count__',
                aggregation: config.aggregation || 'count',
            }],
            showTotals: config.showTotals !== false,
        };
    }

    static getValueSpec(config) {
        const values = config.values || [];
        if (values.length) return values[0];
        return { field: '__count__', aggregation: 'count' };
    }

    static aggregateValues(values, aggregation, isCountMetric) {
        if (!values.length) return 0;
        if (isCountMetric || aggregation === 'count') return values.length;
        if (aggregation === 'sum') return values.reduce((a, b) => a + b, 0);
        if (aggregation === 'avg') return values.reduce((a, b) => a + b, 0) / values.length;
        if (aggregation === 'min') return Math.min(...values);
        if (aggregation === 'max') return Math.max(...values);
        return values.length;
    }

    static buildPivot(rows, config) {
        const rowFields = config.rows || [];
        const colFields = config.cols || [];
        const valueSpec = this.getValueSpec(config);
        const isCountMetric = valueSpec.field === '__count__';
        const grid = new Map();
        const colKeys = new Set();
        const rowKeyOrder = [];

        if (!rowFields.length) {
            return { rowKeys: [], colKeys: [], grid, rowFields, colFields, valueSpec };
        }

        rows.forEach(row => {
            const rowKey = rowFields.map(f => String(row[f] ?? '(ว่าง)')).join(' · ');
            const colKey = colFields.length
                ? colFields.map(f => String(row[f] ?? '(ว่าง)')).join(' · ')
                : 'รวม';
            colKeys.add(colKey);
            if (!grid.has(rowKey)) {
                grid.set(rowKey, new Map());
                rowKeyOrder.push(rowKey);
            }
            const colMap = grid.get(rowKey);
            if (!colMap.has(colKey)) colMap.set(colKey, []);

            if (isCountMetric) {
                colMap.get(colKey).push(1);
            } else {
                const v = Number(row[valueSpec.field]);
                if (!Number.isNaN(v)) colMap.get(colKey).push(v);
            }
        });

        const sortedColKeys = colFields.length
            ? [...colKeys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
            : ['รวม'];

        return { rowKeys: rowKeyOrder, colKeys: sortedColKeys, grid, rowFields, colFields, valueSpec };
    }

    static computeTotals(rows, config) {
        const valueSpec = this.getValueSpec(config);
        const isCount = valueSpec.field === '__count__';
        const rowFields = config.rows || [];
        const colFields = config.cols || [];
        const rowTotals = new Map();
        const colTotals = new Map();
        const allValues = [];

        rows.forEach(row => {
            let v;
            if (isCount) {
                v = 1;
            } else {
                const n = Number(row[valueSpec.field]);
                if (Number.isNaN(n)) return;
                v = n;
            }
            const rowKey = rowFields.map(f => String(row[f] ?? '(ว่าง)')).join(' · ');
            const colKey = colFields.length
                ? colFields.map(f => String(row[f] ?? '(ว่าง)')).join(' · ')
                : 'รวม';
            allValues.push(v);
            if (!rowTotals.has(rowKey)) rowTotals.set(rowKey, []);
            rowTotals.get(rowKey).push(v);
            if (!colTotals.has(colKey)) colTotals.set(colKey, []);
            colTotals.get(colKey).push(v);
        });

        const agg = (vals) => this.aggregateValues(vals, valueSpec.aggregation, isCount);
        return {
            rowTotals: new Map([...rowTotals.entries()].map(([k, vals]) => [k, agg(vals)])),
            colTotals: new Map([...colTotals.entries()].map(([k, vals]) => [k, agg(vals)])),
            grandTotal: agg(allValues),
        };
    }

    static render(container, text, meta = {}) {
        let parsed;
        try {
            parsed = this.parse(text);
        } catch (e) {
            container.innerHTML = `<div class="empty-state">${this.escape(e.message || 'อ่าน CSV ไม่ได้')}</div>`;
            return;
        }

        const { rows, columns, columnMeta } = parsed;
        if (!rows.length || !columns.length) {
            container.innerHTML = '<div class="empty-state">ไฟล์ CSV ว่าง</div>';
            return;
        }

        container.className = 'window-content csv-view-root';
        container._csvState = {
            rows,
            columns,
            columnMeta,
            meta,
            config: this.defaultConfig(columns, columnMeta),
            tab: 'pivot',
            tabulator: null,
            sortables: [],
            _refreshTimer: null,
            configCollapsed: true,
            colWidths: {},
        };

        container.innerHTML = `
            <div class="csv-view-tabs">
                <button type="button" class="csv-view-tab" data-tab="pivot">Pivot Table</button>
                <button type="button" class="csv-view-tab" data-tab="raw">ข้อมูลดิบ</button>
                <span class="csv-view-meta">${rows.length.toLocaleString()} แถว · ${columns.length} คอลัมน์</span>
            </div>
            <div class="csv-view-body"></div>
        `;

        container.querySelectorAll('.csv-view-tab').forEach(btn => {
            btn.onclick = () => this.switchTab(container, btn.dataset.tab);
        });
        this.switchTab(container, 'pivot');
    }

    static switchTab(container, tab) {
        const state = container._csvState;
        if (!state) return;
        state.tab = tab;
        container.querySelectorAll('.csv-view-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        this.destroySortables(state);

        if (tab === 'raw') {
            if (state.tabulator) {
                state.tabulator.destroy();
                state.tabulator = null;
            }
            this.renderRawTab(container);
            return;
        }

        if (state.tabulator) {
            state.tabulator.destroy();
            state.tabulator = null;
        }
        this.renderPivotTab(container);
    }

    static destroySortables(state) {
        (state.sortables || []).forEach(s => s.destroy());
        state.sortables = [];
    }

    static renderRawTab(container) {
        const state = container._csvState;
        const body = container.querySelector('.csv-view-body');
        body.innerHTML = `
            <div class="csv-raw-toolbar">
                <span style="color:#ccc;font-size:0.88rem;">จัดกลุ่ม:</span>
                <select class="csv-raw-group"></select>
                <button type="button" class="csv-pivot-btn csv-pivot-btn-ghost csv-raw-print" style="margin-left:auto;">
                    <i class="fa-solid fa-print"></i> พิมพ์
                </button>
            </div>
            <div class="csv-raw-grid"></div>
        `;

        const groupSelect = body.querySelector('.csv-raw-group');
        groupSelect.innerHTML = '<option value="">ไม่จัดกลุ่ม</option>'
            + state.columns.map(col => `<option value="${this.escape(col)}">${this.escape(col)}</option>`).join('');

        const columns = state.columns.map(key => ({
            title: key,
            field: key,
            headerFilter: 'input',
            headerFilterPlaceholder: 'กรอง...',
        }));

        const gridDiv = body.querySelector('.csv-raw-grid');
        state.tabulator = new Tabulator(gridDiv, {
            data: state.rows,
            layout: 'fitDataFill',
            columns,
            height: '100%',
            pagination: true,
            paginationSize: 50,
            paginationSizeSelector: [20, 50, 100, 200],
            movableColumns: true,
            printAsHtml: true,
            printHeader: `<h1>${this.escape(state.meta.name || 'CSV Data')}</h1>`,
            printStyle: true,
        });

        groupSelect.onchange = () => state.tabulator.setGroupBy(groupSelect.value || '');
        body.querySelector('.csv-raw-print').onclick = () => state.tabulator.print(false, true);
    }

    static fieldLabel(field) {
        return field === '__count__' ? 'จำนวนแถว' : field;
    }

    static fieldIcon(field, columnMeta) {
        if (field === '__count__') return '#';
        return columnMeta[field]?.numeric ? '#' : 'A';
    }

    static aggregationsForField(field, columnMeta) {
        if (field === '__count__' || !columnMeta[field]?.numeric) {
            return [['count', 'Count']];
        }
        return this.AGGREGATIONS;
    }

    static createFieldChip(field, state, options = {}) {
        const { zone = '', aggregation = 'sum', isSpecial = false } = options;
        const chip = document.createElement('div');
        chip.className = 'csv-field-chip' + (isSpecial || field === '__count__' ? ' csv-field-special' : '');
        chip.dataset.field = field;
        chip.innerHTML = `
            <span class="csv-field-grip"><i class="fa-solid fa-grip-vertical"></i></span>
            <span class="csv-field-type">${this.escape(this.fieldIcon(field, state.columnMeta))}</span>
            <span class="csv-field-name" title="${this.escape(this.fieldLabel(field))}">${this.escape(this.fieldLabel(field))}</span>
        `;

        if (zone === 'values') {
            const select = document.createElement('select');
            select.className = 'csv-field-agg';
            const aggs = this.aggregationsForField(field, state.columnMeta);
            const defaultAgg = aggs.some(([k]) => k === aggregation) ? aggregation : aggs[0][0];
            aggs.forEach(([k, label]) => {
                const opt = document.createElement('option');
                opt.value = k;
                opt.textContent = label;
                if (k === defaultAgg) opt.selected = true;
                select.appendChild(opt);
            });
            select.onmousedown = (e) => e.stopPropagation();
            select.onclick = (e) => e.stopPropagation();
            select.onchange = () => this.scheduleRefresh(containerFromChip(chip));
            chip.appendChild(select);
        }
        return chip;
    }

    static containerFromChip(chip) {
        return chip.closest('.csv-view-root');
    }

    static getAssignedFields(config) {
        const valueSpec = this.getValueSpec(config);
        const fields = [...(config.rows || []), ...(config.cols || [])];
        if (valueSpec.field) fields.push(valueSpec.field);
        return new Set(fields);
    }

    static populateZoneList(listEl, fields, state, zone, valueSpec = null) {
        listEl.innerHTML = '';
        fields.forEach(field => {
            const agg = zone === 'values' && valueSpec?.field === field ? valueSpec.aggregation : 'sum';
            listEl.appendChild(this.createFieldChip(field, state, {
                zone,
                aggregation: agg,
                isSpecial: field === '__count__',
            }));
        });
        this.updateEmptyZoneClass(listEl);
    }

    static updateEmptyZoneClass(listEl) {
        listEl.classList.toggle('csv-pivot-empty', listEl.querySelectorAll('.csv-field-chip').length === 0);
    }

    static renderPivotTab(container) {
        const state = container._csvState;
        state.config = this.normalizeConfig(state.config);
        const cfg = state.config;
        const assigned = this.getAssignedFields(cfg);
        const valueSpec = this.getValueSpec(cfg);

        const body = container.querySelector('.csv-view-body');
        const configCollapsed = state.configCollapsed ?? true;
        body.innerHTML = `
            <div class="csv-pivot-layout">
                <div class="csv-pivot-table-area">
                    <div class="csv-pivot-toolbar">
                        <button type="button" class="csv-pivot-btn csv-pivot-btn-ghost csv-pivot-toggle-config">
                            <i class="fa-solid fa-${configCollapsed ? 'chevron-down' : 'chevron-up'}"></i>
                            ${configCollapsed ? 'แสดงการตั้งค่า' : 'ซ่อนการตั้งค่า'}
                        </button>
                        <button type="button" class="csv-pivot-btn csv-pivot-btn-ghost csv-pivot-print">
                            <i class="fa-solid fa-print"></i> พิมพ์
                        </button>
                        <label><input type="checkbox" class="csv-pivot-totals"${cfg.showTotals ? ' checked' : ''}> ผลรวม</label>
                        <span class="csv-pivot-summary"></span>
                    </div>
                    <div class="csv-pivot-config-panel${configCollapsed ? ' collapsed' : ''}">
                        <aside class="csv-pivot-palette">
                            <div class="csv-pivot-palette-title"><i class="fa-solid fa-list"></i> ฟิลด์</div>
                            <div class="csv-pivot-zone-list csv-pivot-sortable" data-zone-list="palette"></div>
                        </aside>
                        <div class="csv-pivot-zones">
                            <div class="csv-pivot-zone" data-zone="rows">
                                <label>แถว</label>
                                <div class="csv-pivot-zone-list csv-pivot-sortable" data-zone-list="rows"></div>
                            </div>
                            <div class="csv-pivot-zone" data-zone="cols">
                                <label>คอลัมน์</label>
                                <div class="csv-pivot-zone-list csv-pivot-sortable" data-zone-list="cols"></div>
                            </div>
                            <div class="csv-pivot-zone" data-zone="values">
                                <label>ค่า</label>
                                <div class="csv-pivot-zone-list csv-pivot-sortable" data-zone-list="values"></div>
                            </div>
                        </div>
                    </div>
                    <div class="csv-pivot-result"></div>
                </div>
            </div>
        `;

        const paletteList = body.querySelector('[data-zone-list="palette"]');
        const rowsList = body.querySelector('[data-zone-list="rows"]');
        const colsList = body.querySelector('[data-zone-list="cols"]');
        const valuesList = body.querySelector('[data-zone-list="values"]');

        this.populateZoneList(rowsList, cfg.rows, state, 'rows');
        this.populateZoneList(colsList, cfg.cols, state, 'cols');
        this.populateZoneList(valuesList, valueSpec.field ? [valueSpec.field] : [], state, 'values', valueSpec);

        const paletteFields = state.columns.filter(c => !assigned.has(c));
        paletteFields.forEach(field => paletteList.appendChild(this.createFieldChip(field, state)));
        if (!assigned.has('__count__')) {
            paletteList.appendChild(this.createFieldChip('__count__', state, { isSpecial: true }));
        }
        this.updateEmptyZoneClass(paletteList);

        body.querySelector('.csv-pivot-totals').onchange = (e) => {
            cfg.showTotals = e.target.checked;
            this.renderPivotResult(container);
        };
        body.querySelector('.csv-pivot-print').onclick = () => window.print();
        body.querySelector('.csv-pivot-toggle-config').onclick = () => {
            state.configCollapsed = !state.configCollapsed;
            const panel = body.querySelector('.csv-pivot-config-panel');
            const btn = body.querySelector('.csv-pivot-toggle-config');
            panel.classList.toggle('collapsed', state.configCollapsed);
            btn.innerHTML = state.configCollapsed
                ? '<i class="fa-solid fa-chevron-down"></i> แสดงการตั้งค่า'
                : '<i class="fa-solid fa-chevron-up"></i> ซ่อนการตั้งค่า';
        };

        this.initSortables(container);
        this.renderPivotResult(container);
    }

    static initSortables(container) {
        const state = container._csvState;
        this.destroySortables(state);

        if (typeof Sortable === 'undefined') {
            console.warn('SortableJS not loaded');
            return;
        }

        const group = {
            name: 'csv-pivot-fields',
            pull: true,
            put: true,
        };

        const lists = container.querySelectorAll('.csv-pivot-sortable');
        lists.forEach(listEl => {
            const sortable = Sortable.create(listEl, {
                group,
                animation: 160,
                ghostClass: 'csv-field-ghost',
                chosenClass: 'csv-field-chosen',
                dragClass: 'csv-field-drag',
                fallbackOnBody: true,
                swapThreshold: 0.65,
                emptyInsertThreshold: 6,
                filter: '.csv-field-agg',
                preventOnFilter: false,
                onStart: () => {
                    container.querySelectorAll('.csv-pivot-zone-list').forEach(el => el.classList.add('sortable-drag-over'));
                },
                onEnd: (evt) => {
                    container.querySelectorAll('.csv-pivot-zone-list').forEach(el => el.classList.remove('sortable-drag-over'));
                    this.handleFieldDrop(container, evt);
                },
            });
            state.sortables.push(sortable);
        });
    }

    static zoneFromList(listEl) {
        if (listEl.dataset.zoneList === 'palette') return 'palette';
        return listEl.closest('[data-zone]')?.dataset.zone || 'palette';
    }

    static handleFieldDrop(container, evt) {
        const state = container._csvState;
        const item = evt.item;
        const field = item.dataset.field;
        const toZone = this.zoneFromList(evt.to);
        const fromZone = this.zoneFromList(evt.from);

        container.querySelectorAll('.csv-pivot-zone-list').forEach(el => this.updateEmptyZoneClass(el));

        if (field === '__count__' && toZone !== 'values' && toZone !== 'palette') {
            const ref = evt.from.children[evt.oldIndex] || null;
            evt.from.insertBefore(item, ref);
            container.querySelectorAll('.csv-pivot-zone-list').forEach(el => this.updateEmptyZoneClass(el));
            Notify?.show?.('จำนวนแถว วางได้เฉพาะในค่า (Values)', 'info');
            return;
        }

        if (toZone === 'values') {
            this.ensureSingleValue(container, evt.to, item);
            this.upgradeValueChip(item, state, container);
        } else {
            this.downgradeValueChip(item);
        }

        if (fromZone === 'values' && toZone !== 'values') {
            this.downgradeValueChip(item);
        }

        this.removeDuplicateField(container, field, item);
        this.rebalancePalette(container);
        this.syncConfigFromDOM(container);
        this.scheduleRefresh(container);
    }

    static ensureSingleValue(container, valuesList, keepItem) {
        const chips = [...valuesList.querySelectorAll('.csv-field-chip')];
        const palette = container.querySelector('[data-zone-list="palette"]');
        chips.forEach(chip => {
            if (chip !== keepItem) {
                this.downgradeValueChip(chip);
                palette.appendChild(chip);
            }
        });
        this.updateEmptyZoneClass(palette);
        this.updateEmptyZoneClass(valuesList);
    }

    static removeDuplicateField(container, field, keepItem) {
        const palette = container.querySelector('[data-zone-list="palette"]');
        container.querySelectorAll('.csv-field-chip').forEach(chip => {
            if (chip.dataset.field === field && chip !== keepItem) {
                this.downgradeValueChip(chip);
                palette.appendChild(chip);
            }
        });
        this.rebalancePalette(container);
    }

    static upgradeValueChip(chip, state, container) {
        if (chip.querySelector('.csv-field-agg')) return;
        const field = chip.dataset.field;
        const aggs = this.aggregationsForField(field, state.columnMeta);
        const select = document.createElement('select');
        select.className = 'csv-field-agg';
        aggs.forEach(([k, label]) => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = label;
            select.appendChild(opt);
        });
        select.onmousedown = (e) => e.stopPropagation();
        select.onclick = (e) => e.stopPropagation();
        select.onchange = () => this.scheduleRefresh(container);
        chip.appendChild(select);
    }

    static downgradeValueChip(chip) {
        chip.querySelector('.csv-field-agg')?.remove();
    }

    static rebalancePalette(container) {
        const state = container._csvState;
        const palette = container.querySelector('[data-zone-list="palette"]');
        const inDom = new Set([...container.querySelectorAll('.csv-field-chip')].map(c => c.dataset.field));
        const assigned = this.getAssignedFields(state.config);

        state.columns.forEach(col => {
            if (!inDom.has(col) && !assigned.has(col)) {
                palette.appendChild(this.createFieldChip(col, state));
                inDom.add(col);
            }
        });
        if (!inDom.has('__count__') && !assigned.has('__count__')) {
            palette.appendChild(this.createFieldChip('__count__', state, { isSpecial: true }));
        }
        this.updateEmptyZoneClass(palette);
    }

    static syncConfigFromDOM(container) {
        const state = container._csvState;
        const readFields = (zone) => {
            const list = container.querySelector(`[data-zone="${zone}"] .csv-pivot-zone-list`)
                || container.querySelector(`[data-zone-list="${zone}"]`);
            if (!list || zone === 'palette') return [];
            return [...list.querySelectorAll(':scope > .csv-field-chip')].map(chip => chip.dataset.field);
        };

        state.config.rows = readFields('rows');
        state.config.cols = readFields('cols');

        const valuesList = container.querySelector('[data-zone="values"] .csv-pivot-zone-list');
        const valueChips = valuesList ? [...valuesList.querySelectorAll(':scope > .csv-field-chip')] : [];
        state.config.values = valueChips.map(chip => ({
            field: chip.dataset.field,
            aggregation: chip.querySelector('.csv-field-agg')?.value
                || (chip.dataset.field === '__count__' ? 'count' : 'sum'),
        }));
        if (!state.config.values.length) {
            state.config.values = [{ field: '__count__', aggregation: 'count' }];
        }
    }

    static scheduleRefresh(container) {
        const state = container._csvState;
        clearTimeout(state._refreshTimer);
        state._refreshTimer = setTimeout(() => {
            this.syncConfigFromDOM(container);
            this.renderPivotResult(container);
        }, 150);
    }

    static renderPivotResult(container) {
        const state = container._csvState;
        const target = container.querySelector('.csv-pivot-result');
        if (!target) return;

        const config = state.config;
        if (!config.rows?.length) {
            target.innerHTML = '<div class="csv-pivot-empty">ลากฟิลด์ไปวางใน <strong>แถว (Rows)</strong> อย่างน้อย 1 ฟิลด์</div>';
            return;
        }

        const { rowKeys, colKeys, grid, rowFields, colFields, valueSpec } = this.buildPivot(state.rows, config);
        if (!rowKeys.length) {
            target.innerHTML = '<div class="csv-pivot-empty">ไม่มีข้อมูลสำหรับ Pivot นี้</div>';
            return;
        }

        const isCount = valueSpec.field === '__count__';
        const aggLabel = this.AGGREGATIONS.find(([k]) => k === valueSpec.aggregation)?.[1] || valueSpec.aggregation;
        const valLabel = this.fieldLabel(valueSpec.field);
        const totals = this.computeTotals(state.rows, config);

        const bodyRows = rowKeys.map(rowKey => {
            const colMap = grid.get(rowKey) || new Map();
            const cells = colKeys.map(colKey => {
                const values = colMap.get(colKey) || [];
                const val = this.aggregateValues(values, valueSpec.aggregation, isCount);
                const empty = !values.length;
                return `<td class="${empty ? 'empty-cell' : ''}">${empty ? '—' : this.formatNumber(val)}</td>`;
            }).join('');
            const totalCell = config.showTotals
                ? `<td>${this.formatNumber(totals.rowTotals.get(rowKey) || 0)}</td>`
                : '';
            return `<tr><th>${this.escape(rowKey)}</th>${cells}${totalCell}</tr>`;
        }).join('');

        const cornerLabel = rowFields.join(' · ');
        const colCount = 1 + colKeys.length + (config.showTotals ? 1 : 0);
        const defaultWidths = [160, ...colKeys.map(() => 100), ...(config.showTotals ? [88] : [])];
        const colgroup = Array.from({ length: colCount }, (_, idx) => {
            const w = state.colWidths[idx] || defaultWidths[idx] || 100;
            return `<col style="width:${w}px">`;
        }).join('');
        const colHeaders = colKeys.map((k, idx) =>
            `<th data-col-idx="${idx + 1}">${this.escape(k)}</th>`
        ).join('');
        const totalHeader = config.showTotals
            ? `<th data-col-idx="${colCount - 1}">รวม</th>`
            : '';
        const footer = config.showTotals ? `
            <tfoot>
                <tr class="total-row">
                    <th>รวมทั้งหมด</th>
                    ${colKeys.map(k => `<td>${this.formatNumber(totals.colTotals.get(k) || 0)}</td>`).join('')}
                    <td>${this.formatNumber(totals.grandTotal)}</td>
                </tr>
            </tfoot>
        ` : '';

        const summary = container.querySelector('.csv-pivot-summary');
        if (summary) {
            summary.textContent = `${aggLabel} · ${valLabel}${colFields.length ? ` · ${colFields.join(' · ')}` : ''} · ${state.rows.length.toLocaleString()} แถว`;
        }

        target.innerHTML = `
            <table class="csv-pivot-table">
                <colgroup>${colgroup}</colgroup>
                <thead>
                    <tr>
                        <th class="corner" data-col-idx="0">${this.escape(cornerLabel)}</th>
                        ${colHeaders}
                        ${totalHeader}
                    </tr>
                </thead>
                <tbody>${bodyRows}</tbody>
                ${footer}
            </table>
        `;
        this.initTableColumnResize(target.querySelector('.csv-pivot-table'), state);
    }

    static initTableColumnResize(table, state) {
        if (!table) return;
        const cols = table.querySelectorAll('colgroup col');
        table.querySelectorAll('thead th').forEach((th, idx) => {
            if (th.querySelector('.csv-col-resizer')) return;
            const resizer = document.createElement('span');
            resizer.className = 'csv-col-resizer';
            resizer.title = 'ลากปรับความกว้างคอลัมน์';
            th.appendChild(resizer);

            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const col = cols[idx];
                if (!col) return;
                const startX = e.pageX;
                const startW = th.getBoundingClientRect().width;

                const onMove = (ev) => {
                    const width = Math.max(56, Math.round(startW + (ev.pageX - startX)));
                    col.style.width = `${width}px`;
                    state.colWidths[idx] = width;
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    document.body.classList.remove('csv-pivot-resizing');
                };
                document.body.classList.add('csv-pivot-resizing');
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });

            resizer.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const col = cols[idx];
                if (!col) return;
                const cells = table.querySelectorAll(`tr > *:nth-child(${idx + 1})`);
                let max = 56;
                cells.forEach(cell => {
                    const span = document.createElement('span');
                    span.style.visibility = 'hidden';
                    span.style.position = 'absolute';
                    span.style.whiteSpace = 'nowrap';
                    span.textContent = cell.textContent;
                    document.body.appendChild(span);
                    max = Math.max(max, span.offsetWidth + 24);
                    span.remove();
                });
                const width = Math.min(max, 360);
                col.style.width = `${width}px`;
                state.colWidths[idx] = width;
            });
        });
    }
}