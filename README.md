# e-Document System (Virtual Desktop)

Web-based virtual desktop for document storage, file preview, CSV pivot tables, dashboard charts, recycle bin workflows, and user widgets. Built with PHP, SQLite, vanilla JavaScript, and CSS.

## Features

### Virtual Desktop

- Responsive desktop icons that wrap on smaller screens.
- Taskbar shortcuts for Search, Recent Files, Recycle Bin, Dashboard Wizard, Upload, Settings, and Logout.
- Draggable, resizable, maximizable virtual windows.
- Personal widgets:
  - Clock widget.
  - Person widget with avatar, username, file count, and storage usage.
  - Detail widget with selected file metadata and preview.
  - **Picture frame widgets** — drag an image from My/Public Document onto the desktop or widget area to pin it as a framed photo. Frames persist in `localStorage`, can be reordered with other widgets, and show a broken state if the file is missing.
- Settings window for avatar and wallpaper upload.
- Statistics window for profile, private storage, and public storage stats.
- UI motion system (`css/animations.css`): desktop/taskbar entrance, window open/close, file grid stagger, drag-upload overlays, toast/modal transitions. Respects `prefers-reduced-motion`.

### File Management

- Private user storage and shared public storage.
- File grid with double-click open.
- Multi-select with `Ctrl` / `Cmd`.
- Right-click context menu for open, rename, copy, paste, copy to, move, delete, and ZIP download.
- **Keyboard shortcuts** in My Document / Public Document (click the window first):
  - `Ctrl/Cmd+A` — select all
  - `Ctrl/Cmd+C` — copy selected items to clipboard
  - `Ctrl/Cmd+V` — paste into the current folder (works across private/public)
  - `F2` — inline rename
  - `Delete` — move to Recycle Bin (My Document only)
  - `Backspace` — go to parent folder
- **Direct drag-and-drop upload** in My Document and Public Document windows:
  - Drop files onto the open file window to upload immediately to the current folder.
  - No upload confirmation modal for document windows.
  - Drop hint overlay shows the target location while dragging.
  - Inline progress overlay and automatic file list refresh after upload.
- Separate **Upload window** (taskbar) with destination selector, file queue, and manual upload button.
- Upload progress bar for both direct and queued uploads.
- Upload limits and basic blocked file type checks.
- Partial upload reporting when some files are skipped (type, size, or MIME checks).
- Copy/move collision handling with auto-renamed targets.
- Secure preview through `api/files.php?action=read_content` instead of direct file paths.
- Detail widget and picture frame previews also use authenticated `read_content` URLs.
- Drag image files from the file grid to the desktop to create picture frame widgets (internal drag; does not trigger upload).

### Search And Recent Files

- Search window for private/public files.
- Search filters by context and sort mode.
- **Recent Files** (desktop icon and taskbar):
  - Lists the **25 most recently modified** files across private and public storage.
  - Sorted by `modTime` (newest first); excludes trash and `.stats_cache.json`.
  - Shows file name, context, path, and size.
  - Click a row to open the file preview or jump to a folder in My/Public Document.
  - Refreshes automatically after upload, delete, rename, move, or copy.

### Recycle Bin

- Delete moves files/folders to `.trash` instead of immediate removal.
- Delete confirmation explains items can be restored from Recycle Bin.
- Recycle Bin is available from the taskbar.
- Restore individual trash items.
- Permanently delete individual trash items with `Del`.
- `Clear trash` permanently removes items from the current user's **private** recycle bin only (public trash is not bulk-cleared).
- Trash restore paths are validated server-side to prevent path traversal.
- Recycle bin contents are excluded from storage quota calculations.

### Image Viewer

Supports `jpg`, `jpeg`, `png`, `gif`, and `webp`.

- Zoom in / zoom out.
- Fit to window.
- Rotate left / right.
- Crop selection with `object-fit: contain`-aware crop math.
- Apply crop inside viewer.
- Download the cropped image.
- Load/error feedback when preview content cannot be fetched.

Current limitation: crop does not save back over the original server file.

### Word Viewer (DOCX)

Supports `.docx` preview only (legacy `.doc` is not supported).

- Double-click a `.docx` file to open a virtual preview window.
- Renders with **docx-preview.js** (vendored offline in `assets/vendor/`).
- Authenticated file load through `read_content`.
- Toolbar download button.
- Legacy `.doc` files show a message to save as `.docx`.

### PDF Viewer

Supports `.pdf` preview.

- Double-click a `.pdf` file to open a virtual preview window.
- Renders with **pdf.js** (vendored offline in `assets/vendor/`).
- Page navigation, zoom in/out, fit width, and download.
- Authenticated file load through `read_content`.

### CSV Pivot Viewer

Double-click a `.csv` file to open a **1024×760** CSV window with two tabs:

**Pivot Table** (default)

- Excel-style drag-and-drop field layout powered by **SortableJS**:
  - **Field palette** (left) — all CSV columns plus a virtual **Row Count** field.
  - Drop zones: **Rows**, **Columns**, and **Values** (one value field in the current build).
  - Reorder fields within a zone by dragging.
  - Values chips include an aggregation selector (Sum, Count, Avg, Min, Max).
  - `Row Count` can only be placed in Values.
- Cross-tab pivot output with optional row/column/grand totals.
- Config panel is **collapsed by default** to maximize table space; use **Show settings** / **Hide settings** to toggle.
- Pivot table columns are **resizable** — drag the header edge; double-click to auto-fit content. Widths persist until the window is closed.
- Print support for the pivot result.
- Handles ~10k-row CSVs client-side (full file loaded into memory).

**Raw Data**

- Tabulator grid with pagination (20/50/100/200 rows per page).
- Per-column text filter (`headerFilter: input`) for performance on large files.
- Optional group-by column and print.

Parsing uses PapaParse with BOM-safe headers (via `js/csvPivot.js`).

### Dashboard Wizard

Taskbar/desktop **Dashboard** opens a 3-step wizard for CSV analytics:

1. **Select CSV** — browse private/public CSV files with search and context filter.
2. **Design chart** — optional **data filters** (AND conditions) before aggregation; dimension, metric, aggregation, chart type, Top N limit, and optional chart title.
3. **Dashboard** — saved widget grid per CSV file.

Chart rendering uses **Chart.js** (bar, line, doughnut pie, KPI card, table). Widget configs are stored in browser `localStorage` under `edoc.dashboard.{context}.{path}` (not synced server-side). Supports editing and deleting saved widgets.

### Security

- **CSRF protection** — state-changing POST requests to `api/files.php` and `api/settings.php` require a session-bound `csrf_token`. The token is exposed to the frontend as `window.csrfToken` after login; client code appends it via `window.appendCsrf()`.
- **XSS hardening** — user-controlled filenames and window titles are escaped or rendered with `textContent` instead of raw `innerHTML`.
- **Rename extension policy** — `rename` rejects blocked extensions (same list as upload), preventing bypass of upload filters.
- **Path validation** — `cleanRelPath`, `safePath`, and trash restore checks block traversal outside allowed storage roots.
- **Preview allowlist** — `read_content` streams only approved extensions with session authentication.

### Logging

- Daily text logs under `logs/`.
- Tracks events such as login, logout, upload, delete, restore, permanent delete, clear trash, move, copy, rename, read, and download.
- `logview.php` replays log events visually.

## API Endpoints

### Authentication: `api/auth.php`

| Action | Method | Parameters | Description |
| --- | --- | --- | --- |
| `register` | POST | `username`, `password` | Create user and private storage. |
| `login` | POST | `username`, `password` | Start user session. |
| `logout` | POST | none | End user session. |

### File Management: `api/files.php`

All **POST** actions require `csrf_token` (form field or `X-CSRF-Token` header).

| Action | Method | Parameters | Description |
| --- | --- | --- | --- |
| `list` | GET | `type`, `path` | List files/folders. |
| `upload` | POST | `files[]`, `type`, `path`, `csrf_token` | Upload files. Returns `partial: true` when some files were skipped. Fails if no files were uploaded. |
| `delete` | POST | `path`, `context`, `csrf_token` | Move file/folder to trash. |
| `trash_list` | GET | `context` | List trash metadata. |
| `trash_restore` | POST | `id`, `context`, `csrf_token` | Restore one trash item. Trash path is validated before restore. |
| `trash_delete` | POST | `id`, `context`, `csrf_token` | Permanently delete one trash item. |
| `trash_clear` | POST | `context` (private only), `csrf_token` | Permanently delete all items in the current user's private recycle bin. |
| `move` | POST | `src`, `dest`, `csrf_token` | Move file/folder. |
| `copy` | POST | `src`, `dest`, `csrf_token` | Copy file/folder. |
| `rename` | POST | `path`, `newName`, `context`, `csrf_token` | Rename a file/folder in place. Blocked extensions are rejected. |
| `read_content` | GET | `type`, `path` | Stream preview content for allowlisted file types only (`jpg`, `jpeg`, `png`, `gif`, `webp`, `mp4`, `csv`, `json`, `txt`, `docx`, `pdf`). |
| `download_zip` | POST | `paths[]`, `context`, `csrf_token` | Download selected items as ZIP. |
| `csv_list` | GET | none | List available CSV files. |
| `recent` | GET | none | List the 25 most recently modified files (private + public), sorted by `modTime`. |

### Statistics: `api/stats.php`

| Method | Description |
| --- | --- |
| GET | Return user profile, private storage stats, and public storage stats. |

### Settings: `api/settings.php`

All **POST** requests require `csrf_token`.

| Action | Method | Description |
| --- | --- | --- |
| Avatar upload | POST | Upload user avatar image. |
| Wallpaper upload | POST | Upload desktop wallpaper image. |

## Technology Stack

- Frontend: HTML, CSS, vanilla JavaScript.
- Backend: PHP.
- Database: SQLite.
- Libraries:
  - FontAwesome (CDN).
  - PapaParse (CDN).
  - Tabulator (CDN).
  - Chart.js (CDN) — Dashboard Wizard charts.
  - SortableJS (CDN) — CSV pivot field drag-and-drop.
  - docx-preview + JSZip (offline, `assets/vendor/`).
  - pdf.js (offline, `assets/vendor/`).

## Project Structure

```text
eDoc/
├── api/
│   ├── auth.php
│   ├── csrf.php
│   ├── db.php
│   ├── files.php
│   ├── logger.php
│   ├── settings.php
│   └── stats.php
├── assets/
│   └── vendor/
│       ├── docx-preview.min.js
│       ├── jszip.min.js
│       ├── pdf.min.js
│       └── pdf.worker.min.js
├── css/
│   ├── animations.css
│   ├── csvPivot.css
│   ├── dashboardWizard.css
│   ├── desktop.css
│   ├── fileSystem.css
│   ├── logview.css
│   ├── main.css
│   └── window.css
├── database/
│   └── vDesktop.sqlite
├── eDoc/
│   ├── private/
│   └── public/
├── js/
│   ├── app.js
│   ├── csvPivot.js
│   ├── dashboardWizard.js
│   ├── desktop.js
│   ├── fileSystem.js
│   ├── logview.js
│   ├── widgets.js
│   └── windowManager.js
├── logs/
├── index.php
├── logview.php
└── check_config.php
```

## Database

### Table: `users`

| Column | Type | Description |
| --- | --- | --- |
| `id` | INTEGER PK | User ID. |
| `username` | TEXT | Unique username. |
| `password` | TEXT | Hashed password. |
| `created_at` | DATETIME | Account creation time. |
| `lastlogin` | DATETIME | Last successful login time. |
| `ipaddress` | TEXT | Last login IP address. |

## Installation

1. Put the project in a PHP web server root, such as `htdocs`, `www`, or similar.
2. Ensure PHP has SQLite enabled.
3. Open `check_config.php` to verify permissions and environment.
4. Open `index.php`.
5. Register a user and start using the desktop.

## Notes

- Runtime folders such as `eDoc/private`, `eDoc/public`, `.trash`, `.stats_cache.json`, and `logs` are generated/updated by app usage.
- Trash delete and clear trash are permanent.
- Image crop currently affects viewer/download output only; it does not overwrite server files.
- My Document / Public Document windows refresh automatically after a successful direct upload.
- The Upload window still uses a queue and requires clicking **Upload Files**; only document windows support instant drop-to-upload.
- DOCX and PDF preview libraries are bundled locally; FontAwesome, Tabulator, PapaParse, Chart.js, SortableJS, and Google Fonts still load from CDN unless you vendor them separately.
- Clipboard copy/paste uses in-app clipboard state (`Ctrl/Cmd+C` / `Ctrl/Cmd+V`), not the OS clipboard.
- Picture frame widgets are stored in browser `localStorage` under `edoc-picture-frames` (per browser/device, not synced server-side).
- Dashboard widgets use `localStorage` keys `edoc.dashboard.{context}.{path}`; pivot column widths and collapsed config state last for the current CSV window session only.
- CSV pivot supports one value field per pivot; multiple row/column fields are supported via drag order.
- After login, `index.php` sets `window.csrfToken`; custom API clients must include this token on POST requests to `files.php` and `settings.php`.
