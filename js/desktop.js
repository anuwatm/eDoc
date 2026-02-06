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
                <div class="desktop-icon" onclick="Desktop.openSearch()">
                    <i class="fa-solid fa-magnifying-glass" style="color: #fff;"></i>
                    <span>Search</span>
                </div>
            </div>

            <!-- Widget Area -->
            <div id="widget-area"></div>

            <!-- Taskbar -->
            <div id="taskbar">
                <div class="taskbar-icon" onclick="Desktop.openSearch()" title="Search">
                    <i class="fa-solid fa-magnifying-glass"></i>
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
        // Todo: Implement Search Modal
        const term = prompt("Enter search term:");
        if (term) {
            // trigger search
            WindowManager.open(`Search: ${term}`, 'search-results', { term });
        }
    }





}
