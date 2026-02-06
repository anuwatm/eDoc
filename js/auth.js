// js/auth.js

function toggleAuth(view) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (view === 'register') {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    } else {
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    }
}

async function handleAuth(event, action) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    formData.append('action', action);

    try {
        const response = await fetch('api/auth.php', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.success) {
            if (action === 'register') {
                alert('Registration successful! Please login.');
                toggleAuth('login');
                form.reset();
            } else if (action === 'login') {
                location.reload(); // Reload to show desktop
            }
        } else {
            alert(result.message || 'An error occurred.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('System error. Please try again.');
    }
}

document.getElementById('form-login')?.addEventListener('submit', (e) => handleAuth(e, 'login'));
document.getElementById('form-register')?.addEventListener('submit', (e) => handleAuth(e, 'register'));
