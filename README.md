# e-Document System (Virtual Desktop)

Web-based virtual desktop for document storage, file preview, CSV analysis, recycle bin workflows, and user widgets. Built with PHP, SQLite, vanilla JavaScript, and CSS.

## Features

### Virtual Desktop

- Responsive desktop icons that wrap on smaller screens.
- Taskbar shortcuts for Search, Recent Files, Recycle Bin, Dashboard Wizard, Upload, Settings, and Logout.
- Draggable, resizable, maximizable virtual windows.
- Personal widgets:
  - Clock widget.
  - Person widget with avatar, username, file count, and storage usage.
  - Detail widget with selected file metadata and preview.
- Settings window for avatar and wallpaper upload.
- Statistics window for profile, private storage, and public storage stats.

### File Management

- Private user storage and shared public storage.
- File grid with double-click open.
- Multi-select with `Ctrl` / `Cmd`.
- Right-click context menu for open, copy, move, delete, and ZIP download.
- Drag and drop upload from file windows or Upload window.
- Upload progress bar.
- Upload limits and basic blocked file type checks.
- Copy/move collision handling with auto-renamed targets.
- Secure preview through `api/files.php?action=read_content` instead of direct file paths.

### Search And Recent Files

- Search window for private/public files.
- Search filters by context and sort mode.
- Recent Files window using latest modified files.

### Recycle Bin

- Delete moves files/folders to `.trash` instead of immediate removal.
- Recycle Bin is available from the taskbar.
- Restore individual trash items.
- Permanently delete individual trash items with `Del`.
- `Clear trash` button permanently removes all trash items.

### Image Viewer

Supports `jpg`, `jpeg`, `png`, `gif`, and `webp`.

- Zoom in / zoom out.
- Fit to window.
- Rotate left / right.
- Crop selection.
- Apply crop inside viewer.
- Download the cropped image.

Current limitation: crop does not save back over the original server file.

### CSV Tools

- CSV preview with PapaParse and Tabulator.
- Sorting, filtering, grouping, virtual scrolling, and printing.
- Dashboard Wizard for CSV files:
  - Select CSV from private/public storage.
  - Choose dimension, metric, aggregation, and display type.
  - Display as bar, line, pie, KPI, or table.
  - Save dashboard widgets per CSV in `localStorage`.

### Logging

- Daily text logs under `logs/`.
- Tracks events such as login, logout, upload, delete, restore, permanent delete, clear trash, move, copy, read, and download.
- `logview.php` replays log events visually.

## API Endpoints

### Authentication: `api/auth.php`

| Action | Method | Parameters | Description |
| --- | --- | --- | --- |
| `register` | POST | `username`, `password` | Create user and private storage. |
| `login` | POST | `username`, `password` | Start user session. |
| `logout` | POST | none | End user session. |

### File Management: `api/files.php`

| Action | Method | Parameters | Description |
| --- | --- | --- | --- |
| `list` | GET | `type`, `path` | List files/folders. |
| `upload` | POST | `files[]`, `type`, `path` | Upload files. |
| `delete` | POST | `path`, `context` | Move file/folder to trash. |
| `trash_list` | GET | `context` | List trash metadata. |
| `trash_restore` | POST | `id`, `context` | Restore one trash item. |
| `trash_delete` | POST | `id`, `context` | Permanently delete one trash item. |
| `trash_clear` | POST | none | Permanently delete all trash items. |
| `move` | POST | `src`, `dest` | Move file/folder. |
| `copy` | POST | `src`, `dest` | Copy file/folder. |
| `read_content` | GET | `type`, `path` | Stream safe preview content. |
| `download_zip` | POST | `paths[]`, `context` | Download selected items as ZIP. |
| `csv_list` | GET | none | List available CSV files. |
| `recent` | GET | none | List recent files. |

### Statistics: `api/stats.php`

| Method | Description |
| --- | --- |
| GET | Return user profile, private storage stats, and public storage stats. |

### Settings: `api/settings.php`

| Action | Method | Description |
| --- | --- | --- |
| Avatar upload | POST | Upload user avatar image. |
| Wallpaper upload | POST | Upload desktop wallpaper image. |

## Technology Stack

- Frontend: HTML, CSS, vanilla JavaScript.
- Backend: PHP.
- Database: SQLite.
- Libraries:
  - FontAwesome.
  - PapaParse.
  - Tabulator.

## Project Structure

```text
eDoc/
├── api/
│   ├── auth.php
│   ├── db.php
│   ├── files.php
│   ├── logger.php
│   ├── settings.php
│   └── stats.php
├── assets/
├── css/
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
