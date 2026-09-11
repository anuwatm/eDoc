const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ Notify: { show() {} } });
vm.runInContext(fs.readFileSync('js/fileSystem.js', 'utf8') + '\nthis.FS = FileSystem;', context);
const manager = context.FS;
const files = Array.from({ length: 10000 }, (_, i) => ({ name: `file-${i}.csv`, relPath: `folder/file-${i}.csv` }));
const nodes = files.slice(0, 150).map(file => ({
    selected: false,
    getAttribute() { return file.relPath; },
    classList: { add() {}, toggle() {} }
}));
const container = { querySelectorAll() { return nodes; } };
const state = { files, selected: new Set(), status: {} };
manager.folderStates.set(container, state);
manager.selectAll(container);
assert.equal(manager.getSelectedItems(container).length, 10000);
assert.equal(nodes.length, 150, 'Select all must not render hidden files');
manager.copySelection(container, 'my-doc');
assert.equal(manager.clipboard.items.length, 10000);
manager.selectFile({ ctrlKey: true }, nodes[0], files[0], 'my-doc', container);
assert.equal(manager.getSelectedItems(container).length, 9999);
assert.ok(!manager.getSelectedItems(container).some(file => file.relPath === files[0].relPath));
manager.selectFile({}, nodes[1], files[1], 'my-doc', container);
assert.equal(manager.getSelectedItems(container).length, 1);
assert.equal(manager.getSelectedItems(container)[0].relPath, files[1].relPath);
manager.selectAll(container);
manager.startInlineRename(container, 'my-doc'); // Multi-selection must return before querying a rename target.
const second = { querySelectorAll() { return []; } };
manager.folderStates.set(second, { files: [], selected: new Set(), status: {} });
assert.equal(manager.getSelectedItems(second).length, 0);
assert.equal(manager.getSelectedItems(container).length, 10000);
console.log('PASS: 10,000-file selection, copy, deselect, single-select, rename guard, window isolation');
