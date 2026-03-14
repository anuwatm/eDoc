<?php
session_start();
if (!isset($_SESSION['user_id'])) {
    header("Location: index.php");
    exit();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>eDoc - Animated Log Replay</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="css/logview.css" rel="stylesheet">
</head>
<body>

<div class="top-bar">
    <div class="logo"><i class="fa-solid fa-film"></i> 8-Bit Log Replay</div>
    <div class="controls">
        <select id="log-selector">
            <option value="">Loading logs...</option>
        </select>
        <button id="btn-play"><i class="fa-solid fa-play"></i> Play</button>
        <button id="btn-pause" disabled><i class="fa-solid fa-pause"></i> Pause</button>
        <button class="btn-exit" onclick="window.close()"><i class="fa-solid fa-door-open"></i> Exit</button>
    </div>
</div>

<div class="room-container">
    <div class="room-wall">
        <div class="window">
            <div class="sky"></div>
            <div class="clouds"></div>
            <div class="window-frame"></div>
        </div>
        <div class="door">
            <div class="door-frame"></div>
            <div class="door-panel closed" id="room-door"></div>
        </div>
        <div class="digital-clock" id="wall-clock">--:--:--</div>
    </div>
    <div class="room-floor">
        <div class="box my-doc" id="box-mydoc">
            <div class="box-label">My Doc</div>
        </div>
        <div class="box public" id="box-public">
            <div class="box-label">Public</div>
        </div>
        <div class="bin" id="box-bin">
            <div class="bin-label">Bin</div>
        </div>
    </div>
    
    <!-- Area for spawning character sprites -->
    <div id="entities-layer"></div>
</div>

<!-- Text overlay for playing log event details -->
<div id="event-hud">
    <h3>Current Event</h3>
    <p id="hud-text">Waiting for playback to begin...</p>
</div>

<script src="js/logview.js"></script>
</body>
</html>
