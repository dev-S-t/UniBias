document.addEventListener('DOMContentLoaded', () => {
    const windDownStartInput = document.getElementById('windDownStart');
    const windDownEndInput = document.getElementById('windDownEnd');
    const restrictedSitesInput = document.getElementById('restrictedSites');
    const saveSettingsButton = document.getElementById('saveSettings');

    // Load settings from localStorage
    loadSettings();

    saveSettingsButton.addEventListener('click', saveSettings);

    function loadSettings() {
        const settings = JSON.parse(localStorage.getItem('digitalSunsetSettings'));
        if (settings) {
            windDownStartInput.value = settings.windDownStart || '';
            windDownEndInput.value = settings.windDownEnd || '';
            restrictedSitesInput.value = settings.restrictedSites ? settings.restrictedSites.join(',') : '';
        }
    }

    function saveSettings() {
        const windDownStart = windDownStartInput.value;
        const windDownEnd = windDownEndInput.value;
        const restrictedSites = restrictedSitesInput.value.split(',').map(site => site.trim()).filter(site => site);

        if (!windDownStart || !windDownEnd) {
            alert("Please specify both wind-down start and end times.");
            return;
        }

        localStorage.setItem('digitalSunsetSettings', JSON.stringify({
            windDownStart,
            windDownEnd,
            restrictedSites
        }));
        alert("Settings saved!");
        applyWindDownEffects(); // Apply immediately if needed
    }

    function isWindDownPeriod(startTimeStr, endTimeStr) {
        if (!startTimeStr || !endTimeStr) return false;

        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();

        const [startHours, startMinutes] = startTimeStr.split(':').map(Number);
        const [endHours, endMinutes] = endTimeStr.split(':').map(Number);

        const currentTimeInMinutes = currentHours * 60 + currentMinutes;
        const startTimeInMinutes = startHours * 60 + startMinutes;
        const endTimeInMinutes = endHours * 60 + endMinutes;
        
        // Handle overnight wind-down periods
        if (endTimeInMinutes < startTimeInMinutes) { // e.g., 10 PM to 2 AM
            return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes < endTimeInMinutes;
        } else {
            return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
        }
    }

    function isRestrictedSite(restrictedSitesList) {
        if (!restrictedSitesList || restrictedSitesList.length === 0) return false;
        const currentHostname = window.location.hostname;
        return restrictedSitesList.some(site => currentHostname.includes(site));
    }

    function applyWindDownEffects() {
        const settings = JSON.parse(localStorage.getItem('digitalSunsetSettings'));
        if (!settings) return;

        const { windDownStart, windDownEnd, restrictedSites } = settings;

        if (isWindDownPeriod(windDownStart, windDownEnd)) {
            // Optional screen warming
            // document.body.classList.add('digital-sunset-active');
            
            // Create and inject overlay for screen warming (optional)
            let overlay = document.getElementById('digital-sunset-overlay-id');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'digital-sunset-overlay-id';
                overlay.className = 'digital-sunset-overlay';
                document.body.appendChild(overlay);
            }


            if (isRestrictedSite(restrictedSites)) {
                let banner = document.getElementById('digital-sunset-banner-id');
                if (!banner) {
                    banner = document.createElement('div');
                    banner.id = 'digital-sunset-banner-id';
                    banner.className = 'digital-sunset-banner';
                    banner.textContent = "Wind-down mode active. Time to disconnect!";
                    document.body.appendChild(banner);
                }
            }
            scheduleNotifications(windDownStart, windDownEnd, "active");
        } else {
            // document.body.classList.remove('digital-sunset-active');
            const overlay = document.getElementById('digital-sunset-overlay-id');
            if (overlay) overlay.remove();
            
            const banner = document.getElementById('digital-sunset-banner-id');
            if (banner) banner.remove();
            scheduleNotifications(windDownStart, windDownEnd, "inactive");
        }
    }
    
    // Notification logic
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

    let reminderTimeout15Min = null;
    let startNotificationShown = false;
    let endNotificationShown = false;

    function scheduleNotifications(startTimeStr, endTimeStr, currentState) {
        if (Notification.permission !== 'granted') {
            requestNotificationPermission(); // Request permission if not already granted or denied
            return;
        }
        
        clearTimeout(reminderTimeout15Min); // Clear any existing 15-min reminder

        const now = new Date();
        const [startHours, startMinutes] = startTimeStr.split(':').map(Number);
        
        const windDownStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHours, startMinutes, 0);
        
        // 15-minute reminder before wind-down
        const fifteenMinutesBeforeStart = new Date(windDownStartTime.getTime() - 15 * 60 * 1000);

        if (now < fifteenMinutesBeforeStart && currentState === "inactive") {
            reminderTimeout15Min = setTimeout(() => {
                new Notification("Digital Sunset Reminder", { body: "Wind-down period starting in 15 minutes." });
            }, fifteenMinutesBeforeStart.getTime() - now.getTime());
        }

        // Wind-down start notification
        if (isWindDownPeriod(startTimeStr, endTimeStr) && !startNotificationShown && currentState === "active") {
             new Notification("Digital Sunset Active", { body: "Your wind-down period has started." });
             startNotificationShown = true; // Ensure it's shown only once per activation
             endNotificationShown = false; // Reset end notification status
        } else if (!isWindDownPeriod(startTimeStr, endTimeStr) && currentState === "inactive") {
            startNotificationShown = false; // Reset for next cycle
            // Wind-down end notification
            if (!endNotificationShown && localStorage.getItem('digitalSunsetJustEnded')) {
                 new Notification("Digital Sunset Ended", { body: "Your wind-down period has ended." });
                 endNotificationShown = true;
                 localStorage.removeItem('digitalSunsetJustEnded'); // Clean up flag
            }
        }
         // Set a flag when wind-down ends to show notification on next check (if browser was closed)
        if (!isWindDownPeriod(startTimeStr, endTimeStr) && startNotificationShown && currentState === "inactive") {
            localStorage.setItem('digitalSunsetJustEnded', 'true');
        }

    }


    // Initial check and setup interval
    requestNotificationPermission(); // Request permission on load
    applyWindDownEffects();
    setInterval(applyWindDownEffects, 60 * 1000); // Check every minute
});
