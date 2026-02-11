# e-Document System (Virtual Desktop)

A web-based virtual desktop environment featuring a premium macOS-inspired authentication system, file management, and personalizable widgets.

## 🚀 Features

### 🖥️ Virtual Desktop Interface
- **Window Management**: Open, close, minimize, maximize, resize, and drag virtual windows.
- **Taskbar**: Quick access to "My Documents", "Public Documents", Search, Uploads, and Settings.
- **Widgets**:
    - **Clock Widget**: Real-time digital clock with date.
    - **Person Widget**: Streamlined profile view showing avatar, username, **File Count**, and **Storage Usage** (with progress bar). Auto-updates on file operations.
    -   **Detail Widget**: Shows interactive **previews** (Images, MP4) and metadata. **Auto-hides** when context is lost (window closed or file deleted).
-   **Statistics Window**: Dedicated window for detailed system usage.
    -   **Split Layout**: Visual separation of User Profile and Storage Stats.
    -   **Detailed Profile**: Displays Avatar, Name, Role, **Last Login**, and **IP Address**.
    -   **Dual Storage Views**: Separate statistics for **Private** and **Public** document storage.
-   **Personalization**: Change user avatar and desktop wallpaper.

### 📂 Advanced File Management
- **File Explorer**: Browse private and public directories with grid views.
- **Drag & Drop Upload**: Upload files by dragging them directly into the "Upload" window or file folders.
- **Real-time Progress Bar**: Visual progress indicator for multiple file uploads.
- **Context Menus**: Right-click to open, copy, move, or delete files.
    -   **Smart Collision**: Automatically **renames** files with timestamps if a duplicate exists during Copy/Move.
- **Preview**: 
    - **Media**: Secure preview for images and videos via dynamic Detail Widget.
    - **CSV Viewer (Tabulator)**: High-performance data grid powered by **PapaParse** and **Tabulator**.
        -   **Virtual Scrolling**: Smooth performance for large datasets.
        -   **Advanced Filtering**: Dropdown filters for columns.
        -   **Data grouping**: Dynamic grouping by any column.
        -   **Printing**: Built-in print capability with custom styling.
- **Navigation**: Double-click to open folders, "Up" button for parent directory.

### 🔐 Secure Authentication
- **User System**: Secure registration and login with password hashing.
- **Session Management**: PHP session-based authentication.
- **Private Storage**: Automatic creation of private user directories upon registration.
- **System Logging**: 
    -   **Daily Logs**: Automatic recording of critical system events (Login, Logout, Upload, Move, Copy, Delete).
    -   **Audit Trail**: Logs include Timestamp, IP Address, Username, and Action details.

## 📡 API Endpoints

### 🔐 Authentication (`api/auth.php`)
| Action | Method | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `register` | POST | `username`, `password` | Registers a new user and creates private directories. |
| `login` | POST | `username`, `password` | Authenticates user and starts a session. Updates Last Login/IP. |
| `logout` | POST | - | Destroys user session and cookies. |

### 📂 File Management (`api/files.php`)
| Action | Method | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `list` | GET | `type` (private/public), `path` | Lists files and folders in the specified directory. |
| `upload` | POST | `files[]`, `type`, `path` | Uploads multiple files to the target directory. |
| `delete` | POST | `path`, `context` | Deletes a file or recursively deletes a folder. |
| `move` | POST | `src`, `dest` | Moves a file. **Auto-renames** on collision. |
| `copy` | POST | `src`, `dest` | Copies a file. **Auto-renames** on collision. |
| `read_content` | GET | `type`, `path` | Streams file content. |

### 📊 User Statistics (`api/stats.php`)
| Method | Description |
| :--- | :--- |
| GET | Returns JSON with User Info (Name, Avatar, Last Login, IP) and storage stats (Private & Public). |

## 🛠️ Technology Stack
- **Frontend**: Vanilla JavaScript (ES6+), CSS3 (Glassmorphism design), HTML5.
- **Libraries**: 
    -   **Tabulator** (Data Tables)
    -   **PapaParse** (CSV Parsing)
    -   FontAwesome 6 (Icons)
- **Backend**: PHP 8.x.
- **Database**: SQLite (`vDesktop.sqlite`).

## � System Structure

```
eDoc/
├── api/                # Backend PHP API endpoints
│   ├── auth.php        # Authentication logic
│   ├── files.php       # File operations
│   ├── stats.php       # User statistics
│   ├── logger.php      # Logging helper
│   └── db.php          # Database connection
├── assets/             # Static assets (default avatars, etc.)
├── css/                # Stylesheets (Glassmorphism, Desktop, Widgets)
├── database/           # SQLite database storage
├── js/                 # Frontend Logic
│   ├── app.js          # Core application logic
│   ├── desktop.js      # Desktop rendering
│   ├── fileSystem.js   # File management logic
│   ├── widgets.js      # Widget functionality
│   └── windowManager.js# Virtual window management
├── eDoc/               # File Storage Root
│   ├── private/        # User private directories
│   └── public/         # Shared public documents
├── logs/               # Daily system logs (action tracking)
└── index.php           # Main entry point
```

## 🗄️ Database Structure

### Table: `users`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PK | Unique User ID |
| `username` | TEXT | Unique Username |
| `password` | TEXT | Hashed Password (bcrypt) |
| `created_at` | DATETIME | Account creation timestamp |
| `lastlogin` | DATETIME | Timestamp of last successful login |
| `ipaddress` | TEXT | IP Address of last login |

## �📦 Installation
1.  Clone the repository:
    ```bash
    git clone https://github.com/anuwatm/eDoc.git
    ```
2.  Ensure you have a web server (Apache/Nginx) with PHP and SQLite enabled.
3.  Place the project in your server's root directory (e.g., `htdocs` or `www`).
4.  Navigate to `index.php` in your browser.
5.  Register a new account to get started.

## 📝 Note
This project involves code generated by **Google Gemini**.
