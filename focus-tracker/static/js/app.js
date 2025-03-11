// DOM elements - single source of truth for DOM references
let welcomeScreen;
let sessionScreen;
let startButton;
let pauseButton;
let stopButton;
let timerDisplay;
let currentGoalDisplay;
let goalInput;
let durationInput;
let intervalInput;
let intervalValue;
let quoteElement;
let quoteAuthorElement;
let privacyToggle;
let userApiKeyInput;
let apiKeyContainer;

// Session state variables
let timer;
let alertCheckInterval;
let remainingTime = 0;
let endTime = 0;
let isPaused = false;
let sessionGoal;

// Quotes array
const focusQuotes = [
    { quote: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
    { quote: "Where focus goes, energy flows.", author: "Tony Robbins" },
    { quote: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
    { quote: "It's not that I'm so smart, it's just that I stay with problems longer.", author: "Albert Einstein" },
    { quote: "Lack of direction, not lack of time, is the problem. We all have 24-hour days.", author: "Zig Ziglar" },
    { quote: "Focus is a matter of deciding what things you're not going to do.", author: "John Carmack" }
];

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app');
    
    // Initialize all DOM element references
    welcomeScreen = document.getElementById('welcome-screen');
    sessionScreen = document.getElementById('session-screen');
    startButton = document.getElementById('start-btn');
    pauseButton = document.getElementById('pause-btn');
    stopButton = document.getElementById('stop-btn');
    timerDisplay = document.getElementById('timer');
    currentGoalDisplay = document.getElementById('current-goal');
    goalInput = document.getElementById('goal-input');
    durationInput = document.getElementById('duration-input');
    intervalInput = document.getElementById('interval-input');
    intervalValue = document.getElementById('interval-value');
    quoteElement = document.getElementById('motivational-quote');
    quoteAuthorElement = document.getElementById('quote-author');
    privacyToggle = document.getElementById('privacy-toggle');
    userApiKeyInput = document.getElementById('user-api-key');
    apiKeyContainer = document.getElementById('api-key-container');
    
    // Set a random quote
    if (quoteElement && quoteAuthorElement) {
        const randomQuote = focusQuotes[Math.floor(Math.random() * focusQuotes.length)];
        quoteElement.textContent = `"${randomQuote.quote}"`;
        quoteAuthorElement.textContent = `- ${randomQuote.author}`;
    }
    
    // Attach event listeners
    if (startButton) {
        startButton.addEventListener('click', startSession);
    }
    
    if (pauseButton) {
        pauseButton.addEventListener('click', pauseSession);
    }
    
    if (stopButton) {
        stopButton.addEventListener('click', stopSession);
    }
    
    // Update interval value display
    if (intervalInput && intervalValue) {
        intervalInput.addEventListener('input', function() {
            intervalValue.textContent = this.value + 's';
        });
    }
    
    // Privacy toggle functionality
    if (privacyToggle) {
        const useOwnApiKey = localStorage.getItem('useOwnApiKey') === 'true';
        const savedApiKey = localStorage.getItem('userApiKey') || '';
        
        if (useOwnApiKey) {
            privacyToggle.checked = true;
            if (userApiKeyInput) userApiKeyInput.value = savedApiKey;
            if (apiKeyContainer) apiKeyContainer.classList.add('visible');
        }
        
        privacyToggle.addEventListener('change', function() {
            if (this.checked) {
                if (apiKeyContainer) apiKeyContainer.classList.add('visible');
                setTimeout(() => {
                    if (userApiKeyInput) userApiKeyInput.focus();
                }, 300);
                localStorage.setItem('useOwnApiKey', 'true');
            } else {
                if (apiKeyContainer) apiKeyContainer.classList.remove('visible');
                localStorage.setItem('useOwnApiKey', 'false');
            }
        });
    }
    
    if (userApiKeyInput) {
        userApiKeyInput.addEventListener('input', function() {
            localStorage.setItem('userApiKey', this.value);
        });
    }
});

// Loading overlay management
function showLoadingOverlay(message) {
    hideLoadingOverlay();
    
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'app-loading-overlay';
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.style.position = 'fixed';
    loadingOverlay.style.top = '0';
    loadingOverlay.style.left = '0';
    loadingOverlay.style.width = '100%';
    loadingOverlay.style.height = '100%';
    loadingOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.flexDirection = 'column';
    loadingOverlay.style.alignItems = 'center';
    loadingOverlay.style.justifyContent = 'center';
    loadingOverlay.style.zIndex = '9999';
    loadingOverlay.style.color = 'white';
    
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.style.width = '50px';
    spinner.style.height = '50px';
    spinner.style.border = '5px solid rgba(255, 255, 255, 0.3)';
    spinner.style.borderRadius = '50%';
    spinner.style.borderTopColor = 'white';
    spinner.style.animation = 'spin 1s ease-in-out infinite';
    spinner.style.marginBottom = '20px';
    
    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    messageEl.style.fontSize = '18px';
    
    loadingOverlay.appendChild(spinner);
    loadingOverlay.appendChild(messageEl);
    document.body.appendChild(loadingOverlay);
    
    if (!document.getElementById('spinner-animation')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'spinner-animation';
        styleSheet.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
        document.head.appendChild(styleSheet);
    }
    
    return loadingOverlay;
}

function hideLoadingOverlay() {
    const existingOverlay = document.getElementById('app-loading-overlay');
    if (existingOverlay && document.body.contains(existingOverlay)) {
        document.body.removeChild(existingOverlay);
    }
}

// API key validation
async function validateApiKey(apiKey) {
    showLoadingOverlay('Validating API key...');
    
    try {
        const response = await fetch('/api/settings/validate-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: apiKey })
        });
        if (!response.ok) {
            return false;
        }
        const result = await response.json();
        return result.valid;
    } catch (error) {
        console.error('Error validating API key:', error);
        return false;
    } finally {
        hideLoadingOverlay();
    }
}

// Session management functions
async function startSession() {
    const goal = goalInput ? goalInput.value.trim() : '';
    if (!goal) {
        alert('Please enter a goal first');
        return;
    }
    
    const duration = durationInput ? parseInt(durationInput.value, 10) : 25;
    if (isNaN(duration) || duration < 1) {
        alert('Please enter a valid duration');
        return;
    }
    
    const interval = intervalInput ? parseInt(intervalInput.value, 10) : 30;
    if (isNaN(interval) || interval < 5) {
        alert('Please enter a valid interval (minimum 5 seconds)');
        return;
    }
    
    let apiKey = null;
    if (privacyToggle && privacyToggle.checked && userApiKeyInput) {
        apiKey = userApiKeyInput.value.trim();
        if (!apiKey) {
            alert('Please enter your API key or disable the privacy toggle');
            return;
        }
        
        try {
            const valid = await validateApiKey(apiKey);
            if (!valid) {
                alert('Invalid API key. Please check and try again.');
                return;
            }
        } catch (error) {
            alert('Failed to validate API key. Please try again later.');
            return;
        }
    }
    
    showLoadingOverlay('Starting session...');
    
    try {
        const sessionConfig = {
            text: goal,
            session_duration: duration,
            screenshot_interval: interval,
            api_key: apiKey
        };
        
        const response = await fetch('/api/goals/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionConfig)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Server error: ${response.status}`);
        }
        
        sessionGoal = goal;
        
        // Switch to session view
        if (welcomeScreen) welcomeScreen.classList.remove('active');
        if (sessionScreen) {
            sessionScreen.classList.add('active');
            sessionScreen.classList.add('status-normal');
        }
        
        // Update goal display
        if (currentGoalDisplay) currentGoalDisplay.textContent = goal;
        
        const setupGoalDisplay = document.getElementById('setup-goal-display');
        if (setupGoalDisplay) setupGoalDisplay.textContent = goal;
        
        // Start timer
        startTimer(duration * 60);
        
        // Start checking for alerts
        updateAlertStatus();
        alertCheckInterval = setInterval(updateAlertStatus, 5000);
        
    } catch (error) {
        console.error('Error starting session:', error);
        alert('Failed to start session: ' + error.message);
    } finally {
        hideLoadingOverlay();
    }
}

async function pauseSession() {
    if (!pauseButton) {
        return;
    }
    
    if (isPaused) {
        try {
            const response = await fetch('/api/session/resume', { method: 'POST' });
            if (!response.ok) {
                throw new Error('Failed to resume on server');
            }
            
            isPaused = false;
            pauseButton.textContent = 'Pause';
            pauseButton.classList.remove('resume');
            
            endTime = Date.now() + remainingTime;
            timer = setInterval(updateTimer, 1000);
        } catch (error) {
            alert('Failed to resume session. Please try again.');
        }
    } else {
        try {
            const response = await fetch('/api/session/pause', { method: 'POST' });
            if (!response.ok) {
                throw new Error('Failed to pause on server');
            }
            
            isPaused = true;
            pauseButton.textContent = 'Resume';
            pauseButton.classList.add('resume');
            
            remainingTime = endTime - Date.now();
            clearInterval(timer);
        } catch (error) {
            alert('Failed to pause session. Please try again.');
        }
    }
}

async function stopSession() {
    if (!confirm('Are you sure you want to stop the current focus session?')) {
        return;
    }
    clearInterval(timer);
    clearInterval(alertCheckInterval);
    showLoadingOverlay('Generating session summary...');
    try {
        await fetch(`/api/session/stop`, { method: 'POST' });
        // Wait a moment to ensure server has time to process
        await new Promise(resolve => setTimeout(resolve, 2000)); // Increased delay
        // Loading overlay will remain until summary is fully loaded
        await showSessionSummary(true); // Pass true to indicate it should hide overlay when done
    } catch (error) {
        console.error('Error stopping session:', error);
        alert('Error stopping session. Returning to home screen.');
        hideLoadingOverlay();
        resetUI();
    }
}

async function sessionComplete() {
    clearInterval(timer);
    clearInterval(alertCheckInterval);
    showLoadingOverlay('Completing session...');
    try {
        await fetch('/api/session/stop', { method: 'POST' });
        // Wait a moment to ensure server has time to process
        await new Promise(resolve => setTimeout(resolve, 2000)); // Increased delay
        // Loading overlay will remain until summary is fully loaded
        await showSessionSummary(true); // Pass true to indicate it should hide overlay when done
    } catch (error) {
        console.error('Could not communicate with server:', error);
        hideLoadingOverlay();
        resetUI();
    }
}

// Timer functions
function startTimer(durationSeconds) {
    if (!timerDisplay) {
        timerDisplay = document.getElementById('timer');
        if (!timerDisplay) return;
    }
    
    remainingTime = durationSeconds * 1000; // Convert to milliseconds
    endTime = Date.now() + remainingTime;
    isPaused = false;
    
    // Update timer display immediately
    updateTimer();
    
    // Clear any existing timer
    if (timer) clearInterval(timer);
    
    // Start the interval
    timer = setInterval(updateTimer, 1000);
}

function updateTimer() {
    if (!timerDisplay) {
        timerDisplay = document.getElementById('timer');
        if (!timerDisplay) return;
    }
    
    if (isPaused) return;
    
    const currentTime = Date.now();
    remainingTime = Math.max(0, endTime - currentTime);
    
    // Convert to minutes and seconds
    const minutes = Math.floor(remainingTime / 60000);
    const seconds = Math.floor((remainingTime % 60000) / 1000);
    
    // Update display with leading zeros
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Check if timer has ended
    if (remainingTime <= 0) {
        clearInterval(timer);
        sessionComplete();
    }
}

// Alert status update function
async function updateAlertStatus() {
    try {
        const response = await fetch('/api/alerts/');
        if (!response.ok) {
            throw new Error('Failed to fetch alerts');
        }

        const alerts = await response.json();
        const sessionScreen = document.getElementById('session-screen');
        const alertStatus = document.getElementById('alert-status');
        const alertMessage = document.getElementById('alert-message');
        
        if (!alerts || alerts.length === 0) {
            // No alerts yet, default to normal state
            if (sessionScreen) sessionScreen.className = 'screen active status-normal';
            if (alertStatus) alertStatus.textContent = '✓ Status: Normal';
            if (alertMessage) alertMessage.textContent = 'Your focus session is on track.';
            return;
        }

        // Get the most recent alert
        const latestAlert = alerts[alerts.length - 1];
        
        // Set background color and status text based on alert level
        if (sessionScreen && alertStatus) {
            // Remove all status classes first
            sessionScreen.classList.remove('status-normal', 'status-caution', 'status-alert');
            
            // Add appropriate status class based on alert level
            switch (latestAlert.alert_level) {
                case 'CAUTION':
                    sessionScreen.classList.add('status-caution');
                    alertStatus.textContent = '⚠️ Status: Caution';
                    break;
                case 'ALERT':
                    sessionScreen.classList.add('status-alert');
                    alertStatus.textContent = '🚨 Status: Alert';
                    break;
                default:
                    sessionScreen.classList.add('status-normal');
                    alertStatus.textContent = '✓ Status: Normal';
            }
            
            // Update the explanation message if available
            if (alertMessage && latestAlert.message) {
                alertMessage.textContent = latestAlert.message;
            }
        }
    } catch (error) {
        console.error('Error updating alert status:', error);
    }
}

// Session summary display
async function showSessionSummary(hideOverlayWhenDone = false) {
    try {
        const response = await fetch(`/api/session/summary`);
        
        if (!response.ok) {
            throw new Error(`Failed to get session summary: ${response.status}`);
        }
        
        const summary = await response.json();
        
        // Format duration for display
        const durationMinutes = Math.floor(summary.duration / 60);
        const durationSeconds = Math.floor(summary.duration % 60);
        const durationStr = `${durationMinutes}m ${durationSeconds}s`;
        
        // Create summary HTML
        let summaryHTML = `
            <div class="summary-content">
                <h2 class="summary-title">Session Summary</h2>
                
                <div class="summary-goal">
                    <span class="goal-label">Goal:</span>
                    <span class="goal-value">${summary.goal}</span>
                </div>
                
                <div class="summary-stats">
                    <div class="stat-item">
                        <div class="stat-icon">⏱️</div>
                        <div class="stat-value">${durationStr}</div>
                        <div class="stat-label">Duration</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-icon">📸</div>
                        <div class="stat-value">${summary.screenshot_count}</div>
                        <div class="stat-label">Screenshots</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-icon">🎯</div>
                        <div class="stat-value">${summary.focus_percentage.toFixed(1)}%</div>
                        <div class="stat-label">Focus</div>
                    </div>
                </div>
                
                <div class="summary-text">
                    <h3>Session Evaluation</h3>
                    <p>${summary.summary}</p>
                </div>
                
                <div class="summary-tips">
                    <h3>Tips for Next Time</h3>
                    <ul>
                        ${summary.tips.map(tip => `<li>${tip}</li>`).join('')}
                    </ul>
                </div>
                
                <button id="summary-close" class="btn primary-btn">Start New Session</button>
            </div>
        `;
        
        // Create modal dialog
        const summaryModal = document.createElement('div');
        summaryModal.className = 'summary-modal';
        summaryModal.innerHTML = summaryHTML;
        
        document.body.appendChild(summaryModal);
        
        // Add event listener to close button
        document.getElementById('summary-close').addEventListener('click', () => {
            document.body.removeChild(summaryModal);
            resetUI();
        });
        
        // When everything is ready and displayed, hide the overlay if requested
        if (hideOverlayWhenDone) {
            hideLoadingOverlay();
        }
    } catch (error) {
        console.error('Error showing session summary:', error);
        hideLoadingOverlay();
        // Handle the error appropriately
        alert("Couldn't load session summary. Starting new session.");
        resetUI();
    }
}

// Helper function to reset UI back to welcome screen
function resetUI() {
    // Clear any running timers
    if (timer) clearInterval(timer);
    if (alertCheckInterval) clearInterval(alertCheckInterval);
    
    // Reset state variables
    isPaused = false;
    remainingTime = 0;
    endTime = 0;
    
    // Switch screens
    if (welcomeScreen) welcomeScreen.classList.add('active');
    if (sessionScreen) sessionScreen.classList.remove('active');
    
    // Reset pause button if it exists
    if (pauseButton) {
        pauseButton.textContent = 'Pause';
        pauseButton.classList.remove('resume');
    }
}