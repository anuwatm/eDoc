// js/csvViewer.js

class CsvViewer {
static render(container, text, meta = {}) {
        if (typeof CsvPivot !== 'undefined') {
            CsvPivot.render(container, text, meta);
            return;
        }
        container.innerHTML = '<div class="empty-state">CsvPivot module not loaded</div>';
    }

}
