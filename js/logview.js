// js/logview.js

const logSelector = document.getElementById('log-selector');
const btnPlay = document.getElementById('btn-play');
const btnPause = document.getElementById('btn-pause');
const clockElement = document.getElementById('wall-clock');
const doorElement = document.getElementById('room-door');
const layer = document.getElementById('entities-layer');
const hudText = document.getElementById('hud-text');

let currentSequence = [];
let playIndex = 0;
let isPlaying = false;
let globalCharacter = null; // Reusing one character for simplicity

// Positions
const POS = {
    door: 80,
    mydoc: 410,
    public: 560,
    bin: window.innerWidth - 130
};

// Update resize pos
window.addEventListener('resize', () => {
    POS.bin = window.innerWidth - 130;
});

// Calculate distance and time (Sped up)
const calcWalkTime = (start, end) => {
    const dist = Math.abs(start - end);
    return Math.max(0.2, dist * 0.0015); // Seconds
};

async function init() {
    try {
        const res = await fetch('api/get_logs.php?action=list');
        const files = await res.json();
        
        logSelector.innerHTML = '<option value="">Select a log date...</option>';
        files.forEach(f => {
            const dateStr = f.replace('log_', '').replace('.txt', '');
            logSelector.innerHTML += `<option value="${f}">${dateStr}</option>`;
        });

        // Initialize reusable character
        globalCharacter = document.createElement('div');
        globalCharacter.className = 'character';
        globalCharacter.innerHTML = `
            <div class="username-label">User</div>
            <div class="held-item"></div>
        `;
        layer.appendChild(globalCharacter);

    } catch (e) {
        hudText.innerText = "Error loading logs list.";
    }
}

logSelector.addEventListener('change', async (e) => {
    const file = e.target.value;
    btnPlay.disabled = true;
    if (!file) return;

    hudText.innerText = `Fetching ${file}...`;
    try {
        const res = await fetch(`api/get_logs.php?file=${file}`);
        currentSequence = await res.json();
        playIndex = 0;
        hudText.innerText = `Ready. Found ${currentSequence.length} events.`;
        if (currentSequence.length > 0) btnPlay.disabled = false;
    } catch(err) {
        hudText.innerText = "Failed to parse log file.";
    }
});

btnPlay.addEventListener('click', () => {
    if (playIndex >= currentSequence.length) playIndex = 0; // Restart
    isPlaying = true;
    btnPlay.disabled = true;
    btnPause.disabled = false;
    logSelector.disabled = true;
    playNextEvent();
});

btnPause.addEventListener('click', () => {
    isPlaying = false;
    btnPlay.disabled = false;
    btnPause.disabled = true;
    logSelector.disabled = false;
});

const wait = (ms) => new Promise(res => setTimeout(res, ms));

async function playNextEvent() {
    if (!isPlaying || playIndex >= currentSequence.length) {
        isPlaying = false;
        btnPlay.disabled = false;
        btnPause.disabled = true;
        logSelector.disabled = false;
        if (playIndex >= currentSequence.length) hudText.innerText = "Playback finished.";
        return;
    }

    const ev = currentSequence[playIndex];
    hudText.innerHTML = `<b>Action:</b> ${ev.action.toUpperCase()}<br><b>User:</b> ${ev.user}<br><b>Details:</b> ${ev.details}`;
    
    // Update Clock
    clockElement.innerText = ev.timestamp.split(' ')[1]; // Get time part

    // Parse user logic
    const char = globalCharacter;
    char.querySelector('.username-label').innerText = ev.user;
    let currentX = parseFloat(char.style.transform.replace('translateX(', '').replace('px)', '')) || POS.door;

    // Helper for Walk
    const walkTo = async (targetX, faceRight = true) => {
        const t = calcWalkTime(currentX, targetX);
        char.style.transition = `transform ${t}s linear`;
        const scaleX = faceRight ? 1 : -1;
        // The rotation flips the sprite left/right
        char.style.transform = `translateX(${targetX}px) scaleX(${scaleX})`;
        currentX = targetX;
        await wait(t * 1000 + 50);
    };

    // Sequence based on Action
    if (ev.action === 'login') {
        char.style.opacity = '0';
        char.style.transform = `translateX(${POS.door}px) scaleX(1)`;
        currentX = POS.door;
        
        doorElement.classList.add('open');
        await wait(200);
        char.style.opacity = '1';
        await walkTo(POS.door + 100, true);
        doorElement.classList.remove('open');
        await wait(200);

    } else if (ev.action === 'logout') {
        await walkTo(POS.door, false);
        doorElement.classList.add('open');
        await wait(200);
        char.style.opacity = '0';
        await wait(200);
        doorElement.classList.remove('open');

    } else if (ev.action === 'failed_login') {
        char.style.opacity = '0';
        char.style.transform = `translateX(${POS.door - 50}px) scaleX(1)`;
        currentX = POS.door - 50; 
        
        // Run at door
        char.style.opacity = '1';
        await walkTo(POS.door, true);
        
        // Bounce off closed door
        char.style.transition = `transform 0.1s linear`;
        char.style.transform = `translateX(${POS.door - 20}px) scaleX(-1) rotate(-15deg)`;
        await wait(100);
        char.style.transform = `translateX(${POS.door - 30}px) scaleX(-1)`;
        await wait(100);
        
        // Walk away
        char.style.transition = `transform 0.5s linear`;
        await walkTo(POS.door - 100, false);
        char.style.opacity = '0';
        await wait(200);

    } else if (ev.action === 'read') {
        const isPublic = ev.details.toLowerCase().includes('public');
        const targetX = isPublic ? POS.public : POS.mydoc;
        
        // Walk to box
        await walkTo(targetX, targetX >= currentX);
        await wait(100);
        
        // Pick up and read
        char.classList.add('holding');
        
        // Face forward (by overriding scaleX without translation change)
        char.style.transform = `translateX(${targetX}px) scaleX(1)`;
        await wait(800); // Reading...
        
        // Put away
        char.classList.remove('holding');
        await wait(100);

    } else if (ev.action === 'download' || ev.action === 'download_zip') {
        const isPublic = ev.details.toLowerCase().includes('public');
        const targetX = isPublic ? POS.public : POS.mydoc;
        
        // Walk to box
        await walkTo(targetX, targetX >= currentX);
        await wait(100);
        
        // Pick up item and walk out
        char.classList.add('holding');
        await walkTo(POS.door, false);
        doorElement.classList.add('open');
        await wait(200);
        char.style.opacity = '0';
        await wait(200);
        doorElement.classList.remove('open');
        char.classList.remove('holding'); // reset

    } else if (ev.action === 'move') {
        const isFromPublic = ev.details.toLowerCase().includes('from public') || ev.details.split(' to ')[0].toLowerCase().includes('public/');
        const isToPublic = ev.details.split(' to ')[1]?.toLowerCase().includes('public') || false;

        const sourceX = isFromPublic ? POS.public : POS.mydoc;
        const destX = isToPublic ? POS.public : POS.mydoc;

        // Walk to source box
        await walkTo(sourceX, sourceX >= currentX);
        await wait(100);

        // Pick up item
        char.classList.add('holding');
        await wait(100);

        // Walk to destination box
        await walkTo(destX, destX >= currentX);
        await wait(100);

        // Drop item
        char.classList.remove('holding');
        const box = isToPublic ? document.getElementById('box-public') : document.getElementById('box-mydoc');
        box.style.transform = 'translateY(-10px)';
        await wait(50);
        box.style.transform = 'translateY(0)';
        await wait(100);

    } else if (ev.action === 'upload') {
        // Holding file (coming from user PC)
        char.classList.add('holding');
        
        // Target Box
        const isPublic = ev.details.toLowerCase().includes('public');
        const targetX = isPublic ? POS.public : POS.mydoc;
        
        // Face correct direction
        await walkTo(targetX, targetX >= currentX);
        
        // Drop animation (remove holding)
        await wait(100);
        char.classList.remove('holding');
        
        // Small box shake feedback
        const box = isPublic ? document.getElementById('box-public') : document.getElementById('box-mydoc');
        box.style.transform = 'translateY(-10px)';
        await wait(50);
        box.style.transform = 'translateY(0)';
        await wait(100);

    } else if (ev.action === 'copy') {
        const isFromPublic = ev.details.toLowerCase().includes('from public') || ev.details.split(' to ')[0].toLowerCase().includes('public/');
        const isToPublic = ev.details.split(' to ')[1]?.toLowerCase().includes('public') || false;

        const sourceX = isFromPublic ? POS.public : POS.mydoc;
        const destX = isToPublic ? POS.public : POS.mydoc;

        // Walk to source box
        await walkTo(sourceX, sourceX >= currentX);
        await wait(100);

        // Pick up item and "Duplicate" it (flash yellow)
        char.classList.add('holding');
        const heldItem = char.querySelector('.held-item');
        if (heldItem) {
            heldItem.style.backgroundColor = '#ffeb3b'; // flash yellow
            await wait(200);
            heldItem.style.backgroundColor = '#fff'; // back to normal
        }

        // Walk to destination box
        await walkTo(destX, destX >= currentX);
        await wait(100);

        // Drop item
        char.classList.remove('holding');
        const box = isToPublic ? document.getElementById('box-public') : document.getElementById('box-mydoc');
        box.style.transform = 'translateY(-10px)';
        await wait(50);
        box.style.transform = 'translateY(0)';
        await wait(100);

    } else if (ev.action === 'rename') {
        const isPublic = ev.details.toLowerCase().includes('public');
        const targetX = isPublic ? POS.public : POS.mydoc;
        
        // Walk to target box
        await walkTo(targetX, targetX >= currentX);
        await wait(100);
        
        // Pull out "Name Tag"
        char.classList.add('holding');
        
        // Face forward briefly like displaying the tag
        char.style.transform = `translateX(${targetX}px) scaleX(1)`;
        await wait(400); 

        // Apply it (shake box)
        const box = isPublic ? document.getElementById('box-public') : document.getElementById('box-mydoc');
        box.style.transform = 'scale(1.1) rotate(5deg)';
        await wait(100);
        box.style.transform = 'scale(1) rotate(0deg)';
        
        char.classList.remove('holding');
        await wait(200);

    } else if (ev.action === 'delete') {
        char.classList.add('holding');
        await walkTo(POS.bin, POS.bin >= currentX);
        await wait(100);
        char.classList.remove('holding');
        
        const bin = document.getElementById('box-bin');
        bin.style.transform = 'scale(1.1)';
        await wait(50);
        bin.style.transform = 'scale(1)';
        await wait(100);
    }

    // Wait before next event
    await wait(300);
    
    playIndex++;
    playNextEvent();
}

init();
