// js/app.js

document.addEventListener('DOMContentLoaded', () => {
    // Check if we are in desktop mode (auth container hidden)
    const authContainer = document.getElementById('auth-container');
    if (authContainer && authContainer.classList.contains('hidden')) {
        window.desktopApp = new Desktop();
        console.log('Desktop Environment Loaded');
    }
});

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
    if (input.files.length === 0) return alert('Please select a file first.');

    const formData = new FormData();
    formData.append('file', input.files[0]);
    formData.append('type', type);

    try {
        const res = await fetch('api/settings.php', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            alert('Update successful! Please restart or reload to see changes.');
            location.reload();
        } else {
            alert('Failed: ' + data.message);
        }
    } catch (e) { alert('Network error during upload'); }
};
