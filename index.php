<?php
session_start();
$isLoggedIn = isset($_SESSION['user_id']);
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>e-Document | Virtual Desktop</title>
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <!-- Styles -->
    <link rel="stylesheet" href="css/main.css">
    <link rel="stylesheet" href="css/desktop.css">
    <link rel="stylesheet" href="css/window.css">
    <link rel="stylesheet" href="css/widgets.css">
    <link rel="stylesheet" href="css/fileSystem.css">
    <!-- FontAwesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>

<body>

    <!-- Authentication Screen -->
    <div id="auth-container" class="<?php echo $isLoggedIn ? 'hidden' : ''; ?>">
        <div id="login-form">
            <div class="auth-header">
                <h1>e-Document</h1>
                <p>Sign in to your virtual workspace</p>
            </div>
            <form id="form-login">
                <div class="input-group">
                    <label>Username</label>
                    <input type="text" name="username" required>
                </div>
                <div class="input-group">
                    <label>Password</label>
                    <input type="password" name="password" required>
                </div>
                <button type="submit" class="btn-primary">Login</button>
                <div class="toggle-link" onclick="toggleAuth('register')">
                    New here? <span>Create account</span>
                </div>
            </form>
        </div>

        <div id="register-form" class="hidden">
            <div class="auth-header">
                <h1>Create Account</h1>
                <p>Start your journey</p>
            </div>
            <form id="form-register">
                <div class="input-group">
                    <label>Username</label>
                    <input type="text" name="username" required>
                </div>
                <div class="input-group">
                    <label>Password (Min 6 chars)</label>
                    <input type="password" name="password" required>
                </div>
                <button type="submit" class="btn-primary">Register</button>
                <div class="toggle-link" onclick="toggleAuth('login')">
                    Already have an account? <span>Login</span>
                </div>
            </form>
        </div>
    </div>

    <!-- Virtual Desktop -->
    <div id="desktop-container" class="<?php echo $isLoggedIn ? '' : 'hidden'; ?>">
        <!-- Desktop content will be injected here via JS -->
    </div>

    <!-- Scripts -->
    <script>
        window.currentUser = '<?php echo isset($_SESSION['username']) ? $_SESSION['username'] : ''; ?>';
    </script>
    <script src="js/auth.js"></script>
    <script src="js/windowManager.js"></script>
    <script src="js/desktop.js"></script>
    <script src="js/fileSystem.js"></script>
    <script src="js/widgets.js"></script>
    <script src="js/app.js"></script>
</body>

</html>