// js/app.js

document.addEventListener('DOMContentLoaded', () => {
    // Check if we are in desktop mode (auth container hidden)
    const authContainer = document.getElementById('auth-container');
    if (authContainer && authContainer.classList.contains('hidden')) {
        window.desktopApp = new Desktop();
        console.log('Desktop Environment Loaded');
    }

    // Init Notifications & Modals
    // window.Notify and window.Modal are initialized at bottom of file or by class definition
});

class NotificationManager {
    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'notification-area';
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-check-circle';
        if (type === 'error') icon = 'fa-exclamation-circle';

        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;

        this.container.appendChild(toast);

        // Remove after duration
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

class ModalManager {
    confirm(title, message) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';

            overlay.innerHTML = `
                <div class="modal-box">
                    <div class="modal-title">${title}</div>
                    <div class="modal-message">${message}</div>
                    <div class="modal-actions">
                        <button class="btn-cancel">Cancel</button>
                        <button class="btn-confirm">Detect</button>
                    </div>
                </div>
            `;

            // Fix "Detect" typo from template -> "Confirm" / "Delete"
            // Let's make it generic "Confirm" usually 
            const confirmBtn = overlay.querySelector('.btn-confirm');
            confirmBtn.innerText = 'Confirm';

            // Allow customization if needed later, but simple for now

            document.body.appendChild(overlay);

            const close = (result) => {
                overlay.remove();
                resolve(result);
            };

            overlay.querySelector('.btn-cancel').onclick = () => close(false);
            confirmBtn.onclick = () => close(true);
        });
    }
}

// Init Globals
window.Notify = new NotificationManager();
window.Modal = new ModalManager();

// Global Logout Function
async function logout() {
    try {
        const formData = new FormData();
        formData.append('action', 'logout');

        const response = await fetch('api/auth.php', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.success) {
            location.reload();
        }
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

// Global Settings Upload Function
window.uploadSetting = async (type) => {
    const input = document.getElementById(type === 'avatar' ? 'upload-avatar' : 'upload-bg');
    if (input.files.length === 0) return Notify.show('Please select a file first.', 'error');

    const formData = new FormData();
    formData.append('file', input.files[0]);
    formData.append('type', type);

    try {
        const res = await fetch('api/settings.php', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            Notify.show('Update successful! Reloading...', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            Notify.show('Failed: ' + data.message, 'error');
        }
    } catch (e) { Notify.show('Network error during upload', 'error'); }
};
