document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const categoryNameInput = document.getElementById('categoryName');
    const categoryDomainsInput = document.getElementById('categoryDomains');
    const categoryLimitInput = document.getElementById('categoryLimit');
    const addCategoryButton = document.getElementById('addCategory');
    const removeCategoryButton = document.getElementById('removeCategory');
    const usageListUI = document.getElementById('usageList');

    const TRACKING_INTERVAL = 5000; // Track every 5 seconds
    const USAGE_WARN_THRESHOLD = 0.8; // 80% of cap

    let categories = {}; // { categoryName: { domains: [], limit: minutes } }
    let usageData = {}; // { 'YYYY-MM-DD': { categoryName: secondsSpent } }
    let activeTabDomain = null;
    let lastTrackedTime = Date.now();

    // --- Initialization ---
    loadCategories();
    loadUsageData();
    displayUsage();
    requestNotificationPermission();
    setInterval(trackUsage, TRACKING_INTERVAL);
    setInterval(checkAndResetDailyUsage, 60 * 1000); // Check every minute for date change

    // --- Event Listeners ---
    addCategoryButton.addEventListener('click', handleAddCategory);
    removeCategoryButton.addEventListener('click', handleRemoveCategory);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            activeTabDomain = getDomainFromUrl(window.location.hostname);
            lastTrackedTime = Date.now(); // Reset time when tab becomes visible
        } else {
            updateCurrentlyTrackedCategory(); // Log time before tab becomes hidden
            activeTabDomain = null;
        }
    });

    window.addEventListener('beforeunload', () => {
        updateCurrentlyTrackedCategory(); // Ensure last bit of time is logged
    });
    
    // Initial active tab domain
    if (document.visibilityState === 'visible') {
        activeTabDomain = getDomainFromUrl(window.location.hostname);
    }

    // --- Category Management ---
    function handleAddCategory() {
        const name = categoryNameInput.value.trim();
        const domainsText = categoryDomainsInput.value.trim();
        const limit = parseInt(categoryLimitInput.value, 10);

        if (!name) {
            alert("Category name cannot be empty.");
            return;
        }
        if (!domainsText) {
            alert("Domains cannot be empty.");
            return;
        }
        if (isNaN(limit) || limit <= 0) {
            alert("Time limit must be a positive number.");
            return;
        }

        const domains = domainsText.split(',').map(d => d.trim().toLowerCase()).filter(d => d);
        if (domains.length === 0) {
            alert("Please enter valid domains.");
            return;
        }

        categories[name] = { domains, limit };
        saveCategories();
        displayUsage(); // Refresh display
        categoryNameInput.value = '';
        categoryDomainsInput.value = '';
        categoryLimitInput.value = '';
        alert(`Category "${name}" added/updated successfully.`);
    }

    function handleRemoveCategory() {
        const name = categoryNameInput.value.trim(); // Assuming user types name to remove, or selects it
        if (!name) {
            alert("Please enter the name of the category to remove.");
            return;
        }
        if (categories[name]) {
            if (confirm(`Are you sure you want to remove the category "${name}"?`)) {
                delete categories[name];
                // Also remove its usage data for today to avoid clutter, or archive if needed
                const today = getTodayDateString();
                if (usageData[today] && usageData[today][name]) {
                    delete usageData[today][name];
                }
                saveCategories();
                saveUsageData();
                displayUsage();
                alert(`Category "${name}" removed.`);
            }
        } else {
            alert(`Category "${name}" not found.`);
        }
    }

    function loadCategories() {
        const storedCategories = localStorage.getItem('usageCapCategories');
        if (storedCategories) {
            categories = JSON.parse(storedCategories);
        }
    }

    function saveCategories() {
        localStorage.setItem('usageCapCategories', JSON.stringify(categories));
    }

    // --- Usage Tracking ---
    function getTodayDateString() {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    function loadUsageData() {
        const storedUsage = localStorage.getItem('usageCapData');
        if (storedUsage) {
            usageData = JSON.parse(storedUsage);
        }
        // Ensure today's usage object exists
        const today = getTodayDateString();
        if (!usageData[today]) {
            usageData[today] = {};
        }
    }

    function saveUsageData() {
        localStorage.setItem('usageCapData', JSON.stringify(usageData));
    }
    
    function getDomainFromUrl(url) {
        try {
            // For full URLs like https://www.example.com/path
            if (url.startsWith('http://') || url.startsWith('https://')) {
                 return new URL(url).hostname.toLowerCase();
            }
            // For hostnames passed directly (e.g. from window.location.hostname)
            return url.toLowerCase();
        } catch (e) {
            console.error("Error parsing URL for domain:", url, e);
            return null;
        }
    }

    function getCategoryForDomain(domain) {
        if (!domain) return null;
        for (const categoryName in categories) {
            if (categories[categoryName].domains.some(d => domain.includes(d))) {
                return categoryName;
            }
        }
        return null;
    }
    
    function updateCurrentlyTrackedCategory() {
        if (activeTabDomain && document.visibilityState === 'visible') {
            const now = Date.now();
            const timeSpentMillis = now - lastTrackedTime;
            lastTrackedTime = now; // Reset for next interval

            const category = getCategoryForDomain(activeTabDomain);
            if (category) {
                const today = getTodayDateString();
                if (!usageData[today]) usageData[today] = {};
                usageData[today][category] = (usageData[today][category] || 0) + (timeSpentMillis / 1000);
                // console.log(`Tracked ${timeSpentMillis/1000}s for ${category} on ${activeTabDomain}`);
            }
        }
    }


    function trackUsage() {
        if (document.visibilityState !== 'visible') {
            activeTabDomain = null; // Ensure no tracking if tab not visible
            return;
        }
        
        // Update current domain if it changed (e.g. navigation within the same tab)
        const currentDomain = getDomainFromUrl(window.location.hostname);
        if (currentDomain !== activeTabDomain) {
            updateCurrentlyTrackedCategory(); // Log time for the old domain
            activeTabDomain = currentDomain; // Switch to the new domain
            lastTrackedTime = Date.now(); // Reset timer for the new domain
        }
        
        updateCurrentlyTrackedCategory(); // Log time for the current (possibly new) domain

        saveUsageData();
        displayUsage(); // Update UI
        checkNotifications();
    }


    function checkAndResetDailyUsage() {
        const today = getTodayDateString();
        // Basic check: if today's date key isn't the first key, means a new day started
        // More robust: check if any keys exist that are not 'today'
        let newDayHasBegun = false;
        for (const dateKey in usageData) {
            if (dateKey !== today) {
                newDayHasBegun = true;
                // Optionally, clean up old data here, e.g., delete keys older than X days
                // delete usageData[dateKey]; 
            }
        }

        if (newDayHasBegun && !usageData[today]) {
             usageData[today] = {}; // Initialize today's usage
             // Reset notification states for the new day
             for (const categoryName in categories) {
                notifiedNearCap[categoryName] = false;
                notifiedOverCap[categoryName] = false;
             }
             saveUsageData();
             displayUsage(); // Refresh display for the new day
             console.log("New day started. Usage data reset for today.");
        } else if (!usageData[today]) { // Ensure today's object exists even if no old data
            usageData[today] = {};
            saveUsageData();
        }
    }

    // --- Display ---
    function displayUsage() {
        usageListUI.innerHTML = ''; // Clear current list
        const today = getTodayDateString();
        const dailyUsage = usageData[today] || {};

        if (Object.keys(categories).length === 0) {
            const li = document.createElement('li');
            li.textContent = "No categories defined yet.";
            usageListUI.appendChild(li);
            return;
        }

        for (const categoryName in categories) {
            const category = categories[categoryName];
            const timeSpentSeconds = dailyUsage[categoryName] || 0;
            const timeSpentMinutes = Math.floor(timeSpentSeconds / 60);
            const capMinutes = category.limit;
            const percentage = capMinutes > 0 ? Math.min((timeSpentSeconds / (capMinutes * 60)) * 100, 100) : 0;

            const li = document.createElement('li');

            const nameSpan = document.createElement('span');
            nameSpan.className = 'category-name';
            nameSpan.textContent = `${categoryName} (${category.domains.join(', ')})`;
            
            const usageText = document.createElement('span');
            usageText.textContent = `Used: ${timeSpentMinutes}m / ${capMinutes}m`;

            const barContainer = document.createElement('div');
            barContainer.className = 'usage-bar-container';
            const bar = document.createElement('div');
            bar.className = 'usage-bar';
            bar.style.width = `${percentage}%`;
            // bar.textContent = `${Math.round(percentage)}%`;

            if (percentage >= 100) {
                bar.classList.add('over-cap');
            } else if (percentage >= USAGE_WARN_THRESHOLD * 100) {
                bar.classList.add('near-cap');
            }
            
            barContainer.appendChild(bar);
            li.appendChild(nameSpan);
            li.appendChild(usageText)
            li.appendChild(barContainer);
            usageListUI.appendChild(li);
        }
    }

    // --- Notifications ---
    let notifiedNearCap = {}; // { categoryName: true }
    let notifiedOverCap = {}; // { categoryName: true }

    function requestNotificationPermission() {
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log("Notification permission granted for Usage Cap.");
                } else {
                    console.log("Notification permission denied for Usage Cap.");
                }
            });
        }
    }

    function checkNotifications() {
        if (Notification.permission !== 'granted') return;

        const today = getTodayDateString();
        const dailyUsage = usageData[today] || {};

        for (const categoryName in categories) {
            const timeSpentSeconds = dailyUsage[categoryName] || 0;
            const capSeconds = categories[categoryName].limit * 60;

            if (capSeconds <= 0) continue; // No cap, no notification

            // Nearing cap notification
            if (timeSpentSeconds >= capSeconds * USAGE_WARN_THRESHOLD && timeSpentSeconds < capSeconds && !notifiedNearCap[categoryName]) {
                new Notification("Usage Warning", {
                    body: `You are nearing your daily limit for ${categoryName} (${Math.round(timeSpentSeconds/capSeconds * 100)}% used).`,
                    tag: `usageCapNear-${categoryName}` // Tag to prevent multiple similar notifications
                });
                notifiedNearCap[categoryName] = true;
            }

            // Cap reached notification
            if (timeSpentSeconds >= capSeconds && !notifiedOverCap[categoryName]) {
                new Notification("Usage Limit Reached", {
                    body: `You have reached your daily limit for ${categoryName}.`,
                    tag: `usageCapOver-${categoryName}`
                });
                notifiedOverCap[categoryName] = true;
                // Potentially block sites here in a more advanced version
            }
        }
    }
});
console.log("Usage Cap script loaded and executing.");
