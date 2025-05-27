document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const sunriseTimeInput = document.getElementById('sunriseTimeInput');
    const sunsetTimeInput = document.getElementById('sunsetTimeInput');
    const saveSunriseSunsetButton = document.getElementById('saveSunriseSunsetButton');
    const displaySunriseSunset = document.getElementById('displaySunriseSunset');

    const alarmLabelInput = document.getElementById('alarmLabelInput');
    const alarmTypeSelect = document.getElementById('alarmTypeSelect');
    const fixedTimeSettings = document.getElementById('fixedTimeSettings');
    const alarmTimeInput = document.getElementById('alarmTimeInput');
    const relativeTimeSettings = document.getElementById('relativeTimeSettings');
    const alarmOffsetInput = document.getElementById('alarmOffsetInput');
    const addAlarmButton = document.getElementById('addAlarmButton');
    const alarmsListUI = document.getElementById('alarmsList');
    const alarmAudio = document.getElementById('alarmAudio');

    // Data
    let alarms = []; // {id, type, time (fixed), offset (relative), label, isActive, triggeredToday}
    let sunriseTime = null; // 'HH:MM'
    let sunsetTime = null; // 'HH:MM'

    const ALARM_CHECK_INTERVAL = 5000; // Check every 5 seconds

    // --- Initialization ---
    function init() {
        loadData();
        requestNotificationPermission();
        updateSunriseSunsetDisplay();
        renderAlarms();
        attachEventListeners();
        setInterval(checkAlarms, ALARM_CHECK_INTERVAL);
        // Attempt to play and pause audio to enable playback later if browser allows
        alarmAudio.play().then(() => alarmAudio.pause()).catch(() => {});
    }

    // --- Event Listeners ---
    function attachEventListeners() {
        saveSunriseSunsetButton.addEventListener('click', handleSaveSunriseSunset);
        alarmTypeSelect.addEventListener('change', handleAlarmTypeChange);
        addAlarmButton.addEventListener('click', handleAddAlarm);
        alarmsListUI.addEventListener('click', handleAlarmListActions);
    }

    // --- Data Management (localStorage) ---
    function loadData() {
        const storedAlarms = localStorage.getItem('alarmsData');
        if (storedAlarms) {
            alarms = JSON.parse(storedAlarms);
            // Reset triggeredToday status on load (alarms are per day for simplicity)
            alarms.forEach(alarm => alarm.triggeredToday = false);
        }
        sunriseTime = localStorage.getItem('sunriseTime') || null;
        sunsetTime = localStorage.getItem('sunsetTime') || null;

        if (sunriseTime) sunriseTimeInput.value = sunriseTime;
        if (sunsetTime) sunsetTimeInput.value = sunsetTime;
    }

    function saveData() {
        localStorage.setItem('alarmsData', JSON.stringify(alarms));
        if (sunriseTime) localStorage.setItem('sunriseTime', sunriseTime);
        else localStorage.removeItem('sunriseTime');
        if (sunsetTime) localStorage.setItem('sunsetTime', sunsetTime);
        else localStorage.removeItem('sunsetTime');
    }

    // --- Sunrise/Sunset Times ---
    function handleSaveSunriseSunset() {
        const newSunrise = sunriseTimeInput.value;
        const newSunset = sunsetTimeInput.value;

        if (!newSunrise || !newSunset) {
            alert("Please enter both sunrise and sunset times.");
            return;
        }
        sunriseTime = newSunrise;
        sunsetTime = newSunset;
        // Reset triggered status for all alarms as their calculated times might change
        alarms.forEach(alarm => alarm.triggeredToday = false);
        saveData();
        updateSunriseSunsetDisplay();
        renderAlarms(); // Re-render to update calculated times
        alert("Sunrise/Sunset times saved.");
    }

    function updateSunriseSunsetDisplay() {
        if (sunriseTime && sunsetTime) {
            displaySunriseSunset.textContent = `Today's Sunrise: ${sunriseTime}, Sunset: ${sunsetTime}`;
        } else {
            displaySunriseSunset.textContent = "Sunrise/Sunset times not set. Relative alarms will not work.";
        }
    }

    // --- Alarm Management ---
    function handleAlarmTypeChange() {
        if (alarmTypeSelect.value === 'fixed') {
            fixedTimeSettings.style.display = 'block';
            relativeTimeSettings.style.display = 'none';
        } else {
            fixedTimeSettings.style.display = 'none';
            relativeTimeSettings.style.display = 'block';
        }
    }

    function handleAddAlarm() {
        const label = alarmLabelInput.value.trim();
        const type = alarmTypeSelect.value;
        const isActive = true; // Default to active
        const id = `alarm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        if (!label) {
            alert("Please enter an alarm label.");
            return;
        }

        let alarm = { id, label, type, isActive, triggeredToday: false };

        if (type === 'fixed') {
            const time = alarmTimeInput.value;
            if (!time) {
                alert("Please enter a time for the fixed alarm.");
                return;
            }
            alarm.time = time;
        } else { // 'sunrise_relative' or 'sunset_relative'
            const offset = parseInt(alarmOffsetInput.value, 10);
            if (isNaN(offset)) {
                alert("Please enter a valid offset in minutes.");
                return;
            }
            if (!sunriseTime || !sunsetTime) {
                alert("Please set sunrise and sunset times before adding relative alarms.");
                return;
            }
            alarm.offset = offset;
        }

        alarms.push(alarm);
        saveData();
        renderAlarms();
        // Clear inputs
        alarmLabelInput.value = '';
        alarmTimeInput.value = '';
        alarmOffsetInput.value = '';
    }

    function handleAlarmListActions(e) {
        const target = e.target;
        const alarmItem = target.closest('li');
        if (!alarmItem) return;

        const alarmId = alarmItem.dataset.alarmId;
        const alarm = alarms.find(a => a.id === alarmId);
        if (!alarm) return;

        if (target.classList.contains('delete-alarm-button')) {
            alarms = alarms.filter(a => a.id !== alarmId);
        } else if (target.classList.contains('toggle-alarm-button')) {
            alarm.isActive = !alarm.isActive;
            if (alarm.isActive) alarm.triggeredToday = false; // Re-arm if activated
        }
        saveData();
        renderAlarms();
    }
    
    function calculateAlarmTime(alarm) {
        if (alarm.type === 'fixed') {
            return alarm.time;
        }
        
        let baseTimeStr;
        if (alarm.type === 'sunrise_relative') {
            baseTimeStr = sunriseTime;
        } else if (alarm.type === 'sunset_relative') {
            baseTimeStr = sunsetTime;
        }

        if (!baseTimeStr) return null; // Cannot calculate

        const [hours, minutes] = baseTimeStr.split(':').map(Number);
        const baseDate = new Date();
        baseDate.setHours(hours, minutes, 0, 0);
        
        const alarmDate = new Date(baseDate.getTime() + alarm.offset * 60000);
        
        return `${String(alarmDate.getHours()).padStart(2, '0')}:${String(alarmDate.getMinutes()).padStart(2, '0')}`;
    }


    // --- Rendering ---
    function renderAlarms() {
        alarmsListUI.innerHTML = ''; // Clear existing alarms
        if (alarms.length === 0) {
            alarmsListUI.innerHTML = '<li>No alarms set.</li>';
            return;
        }

        alarms.forEach(alarm => {
            const li = document.createElement('li');
            li.dataset.alarmId = alarm.id;
            if (!alarm.isActive) {
                li.style.opacity = 0.6;
            }

            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'alarm-details';

            const labelSpan = document.createElement('span');
            labelSpan.className = 'alarm-label';
            labelSpan.textContent = alarm.label;

            const timeSpan = document.createElement('span');
            timeSpan.className = 'alarm-time';
            
            const calculatedTime = calculateAlarmTime(alarm);
            let displayTime = calculatedTime || "N/A (Set Sun Times)";

            if (alarm.type === 'fixed') {
                timeSpan.textContent = ` at ${displayTime}`;
            } else if (alarm.type === 'sunrise_relative') {
                timeSpan.textContent = ` (${alarm.offset > 0 ? '+' : ''}${alarm.offset}m from Sunrise) - Target: ${displayTime}`;
                if (calculatedTime) timeSpan.classList.add('calculated');
            } else if (alarm.type === 'sunset_relative') {
                timeSpan.textContent = ` (${alarm.offset > 0 ? '+' : ''}${alarm.offset}m from Sunset) - Target: ${displayTime}`;
                if (calculatedTime) timeSpan.classList.add('calculated');
            }
            
            if (alarm.triggeredToday) {
                timeSpan.textContent += " (Triggered)";
                li.style.backgroundColor = "#e0e0e0"; // Visually mark triggered
            }


            detailsDiv.appendChild(labelSpan);
            detailsDiv.appendChild(timeSpan);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'alarm-actions';

            const toggleButton = document.createElement('button');
            toggleButton.className = 'toggle-alarm-button';
            toggleButton.textContent = alarm.isActive ? 'Deactivate' : 'Activate';
            if (!alarm.isActive) toggleButton.classList.add('deactivated');

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-alarm-button';
            deleteButton.textContent = 'Delete';

            actionsDiv.appendChild(toggleButton);
            actionsDiv.appendChild(deleteButton);

            li.appendChild(detailsDiv);
            li.appendChild(actionsDiv);
            alarmsListUI.appendChild(li);
        });
    }

    // --- Alarm Triggering & Notifications ---
    function requestNotificationPermission() {
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log("Notification permission granted.");
                } else {
                    console.log("Notification permission denied.");
                }
            });
        }
    }

    function checkAlarms() {
        const now = new Date();
        const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        alarms.forEach(alarm => {
            if (alarm.isActive && !alarm.triggeredToday) {
                const actualAlarmTime = calculateAlarmTime(alarm);
                if (actualAlarmTime && actualAlarmTime === currentTimeStr) {
                    triggerAlarm(alarm);
                }
            }
        });
    }

    function triggerAlarm(alarm) {
        console.log(`Alarm Triggered: ${alarm.label}`);
        alarm.triggeredToday = true; // Mark as triggered for today
        
        // Notification
        if (Notification.permission === 'granted') {
            new Notification("Alarm!", {
                body: alarm.label,
                icon: 'alarm_icon.png' // Optional: Add an icon to the folder
            });
        } else {
            alert(`Alarm: ${alarm.label}`); // Fallback for no notification permission
        }

        // Sound
        alarmAudio.currentTime = 0; // Rewind to start
        alarmAudio.play().catch(e => console.error("Error playing sound:", e));
        
        saveData();
        renderAlarms(); // Update UI to show "triggered"
    }
    
    // --- Dummy MP3 (as I can't create real files) ---
    function createDummyAlarmSound() {
        // This is a placeholder. In a real scenario, upload an actual .mp3 file.
        // For now, the <audio> tag will point to a non-existent file,
        // which won't play but also won't break the script.
        console.log("Conceptual: `alarm_sound.mp3` would be in the `alarm_setter` folder.");
    }

    // --- Start the app ---
    createDummyAlarmSound();
    init();
});
