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
                    <i class="fa-solid fa-folder-user" style="color: #FFD700;"></i>
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
            <div id="widget-area">
                <!-- Widgets injected here -->
            </div>

            <!-- Taskbar -->
            <div id="taskbar">
                <div class="taskbar-icon" onclick="Desktop.showPersonCard()" title="Profile">
                    <i class="fa-solid fa-user"></i>
                </div>
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

        // Initialize Widgets (Placeholder for now)
        this.initWidgets();
    }

    static openSearch() {
        // Todo: Implement Search Modal
        const term = prompt("Enter search term:");
        if (term) {
            // trigger search
            WindowManager.open(`Search: ${term}`, 'search-results', { term });
        }
    }

    static showPersonCard() {
        // Toggle the Person Widget visibility or highlight it
        const widget = document.querySelector('.widget-person');
        if (widget) {
            widget.style.animation = 'none';
            widget.offsetHeight; /* trigger reflow */
            widget.style.animation = 'pulse 0.5s';
            widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            alert('User Profile: ' + (window.currentUser || 'Guest'));
        }
    }

    initWidgets() {
        if (typeof Widgets !== 'undefined') {
            Widgets.init();
        }
    }
}
