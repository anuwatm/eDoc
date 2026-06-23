// js/desktop.js

class Desktop {
    constructor() {
        this.container = document.getElementById('desktop-container');
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <!-- Desktop Icons -->
            <div id="desktop-icons">
                <div class="desktop-icon" onclick="WindowManager.open('My Document', 'my-doc')">
                    <i class="fa-solid fa-folder" style="color: #FFD700;"></i>
                    <span>My Document</span>
                </div>
                <div class="desktop-icon" onclick="WindowManager.open('Public Document', 'public-doc')">
                    <i class="fa-solid fa-folder-open" style="color: #00BFFF;"></i>
                    <span>Public Document</span>
                </div>
                <div class="desktop-icon" onclick="WindowManager.open('Search', 'search-results')">
                    <i class="fa-solid fa-magnifying-glass" style="color: #fff;"></i>
                    <span>Search</span>
                </div>
                <div class="desktop-icon" onclick="WindowManager.open('Recent Files', 'recent-files')">
                    <i class="fa-solid fa-clock-rotate-left" style="color: #2ecc71;"></i>
                    <span>Recent</span>
                </div>
                <div class="desktop-icon" onclick="WindowManager.open('Dashboard Wizard', 'dashboard-wizard')">
                    <i class="fa-solid fa-chart-column" style="color: #f1c40f;"></i>
                    <span>Dashboard</span>
                </div>
                <div class="desktop-icon" onclick="WindowManager.open('Statistics', 'stats-window')">
                    <i class="fa-solid fa-chart-pie" style="color: #e74c3c;"></i>
                    <span>Stat</span>
                </div>
                <div class="desktop-icon" onclick="window.open('logview.php', '_blank')">
                    <i class="fa-solid fa-film" style="color: #9b59b6;"></i>
                    <span>Log Replay</span>
                </div>
            </div>

            <!-- Widget Area -->
            <div id="widget-area"></div>

            <!-- Taskbar -->
            <div id="taskbar">
                <div class="taskbar-icon" onclick="Desktop.openSearch()" title="Search">
                    <i class="fa-solid fa-magnifying-glass"></i>
                </div>
                <div class="taskbar-icon" onclick="WindowManager.open('Recent Files', 'recent-files')" title="Recent Files">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                </div>
                <div class="taskbar-icon" onclick="WindowManager.open('Recycle Bin', 'trash-window')" title="Recycle Bin">
                    <i class="fa-solid fa-trash-can"></i>
                </div>
                <div class="taskbar-icon" onclick="WindowManager.open('Dashboard Wizard', 'dashboard-wizard')" title="Dashboard Wizard">
                    <i class="fa-solid fa-chart-column"></i>
                </div>
                <div class="taskbar-icon" onclick="WindowManager.open('Upload', 'upload')" title="Upload">
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                </div>
                <div class="taskbar-icon" onclick="WindowManager.open('Settings', 'settings')" title="Settings">
                    <i class="fa-solid fa-gear"></i>
                </div>
                <div class="taskbar-icon logout" onclick="logout()" title="Logout">
                    <i class="fa-solid fa-power-off"></i>
                </div>
            </div>
        `;

        if (typeof Widgets !== 'undefined') {
            Widgets.init();
        }


    }

    static openSearch() {
        WindowManager.open('Search', 'search-results');
    }





}
