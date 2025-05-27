document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const prevDayButton = document.getElementById('prevDayButton');
    const nextDayButton = document.getElementById('nextDayButton');
    const todayButton = document.getElementById('todayButton');
    const datePicker = document.getElementById('datePicker');
    const currentDateDisplay = document.getElementById('currentDateDisplay');
    const timeSlotsListUI = document.getElementById('timeSlotsList');

    // Planner Configuration
    const START_HOUR = 7; // 7 AM
    const END_HOUR = 21; // 9 PM (events can end at 10 PM)
    const TIME_SLOT_INTERVAL = 60; // Minutes (e.g., 60 for hourly slots)

    // Data
    let plannerData = {}; // { 'YYYY-MM-DD': { 'HH:MM': 'Event description' }, ... }
    let selectedDate = getFormattedDate(new Date()); // YYYY-MM-DD

    // --- Initialization ---
    function init() {
        loadData();
        updateCurrentDate(selectedDate); // Set initial date
        renderTimeSlots();
        attachEventListeners();
    }

    // --- Event Listeners ---
    function attachEventListeners() {
        prevDayButton.addEventListener('click', handlePrevDay);
        nextDayButton.addEventListener('click', handleNextDay);
        todayButton.addEventListener('click', handleToday);
        datePicker.addEventListener('change', handleDatePick);
        timeSlotsListUI.addEventListener('click', handleTimeSlotClick);
    }

    // --- Data Management (localStorage) ---
    function loadData() {
        const storedData = localStorage.getItem('dayPlannerData');
        if (storedData) {
            plannerData = JSON.parse(storedData);
        }
    }

    function saveData() {
        localStorage.setItem('dayPlannerData', JSON.stringify(plannerData));
    }

    // --- Date Handling & Navigation ---
    function getFormattedDate(dateObj) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function updateCurrentDate(dateStr) {
        selectedDate = dateStr;
        datePicker.value = selectedDate; // Sync date picker input
        const dateObj = new Date(selectedDate + 'T00:00:00'); // Ensure correct date for formatting
        currentDateDisplay.textContent = dateObj.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        renderTimeSlots(); // Re-render slots for the new date
    }

    function handlePrevDay() {
        const currentDateObj = new Date(selectedDate + 'T00:00:00');
        currentDateObj.setDate(currentDateObj.getDate() - 1);
        updateCurrentDate(getFormattedDate(currentDateObj));
    }

    function handleNextDay() {
        const currentDateObj = new Date(selectedDate + 'T00:00:00');
        currentDateObj.setDate(currentDateObj.getDate() + 1);
        updateCurrentDate(getFormattedDate(currentDateObj));
    }
    
    function handleToday() {
        updateCurrentDate(getFormattedDate(new Date()));
    }

    function handleDatePick(e) {
        updateCurrentDate(e.target.value);
    }

    // --- Time Slot & Event Management ---
    function formatTime(hour, minute = 0) {
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    function renderTimeSlots() {
        timeSlotsListUI.innerHTML = ''; // Clear existing slots
        const dayEvents = plannerData[selectedDate] || {};

        for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
            // Assuming hourly slots for now, can be adapted for TIME_SLOT_INTERVAL
            const timeStr = formatTime(hour);
            const nextHourTimeStr = formatTime(hour + 1); // For display like "7:00 AM - 8:00 AM"
            
            const li = document.createElement('li');
            li.dataset.timeSlot = timeStr;

            const timeLabel = document.createElement('span');
            timeLabel.className = 'time-label';
            // Display time in a more readable format e.g. 7:00 AM
            const displayHour = hour % 12 === 0 ? 12 : hour % 12;
            const ampm = hour < 12 || hour === 24 ? 'AM' : 'PM'; // hour === 24 for midnight end slot
            const displayNextHour = (hour+1) % 12 === 0 ? 12 : (hour+1) % 12;
            const nextAmpm = (hour+1) < 12 || (hour+1) === 24 ? 'AM' : 'PM';
            
            timeLabel.textContent = `${displayHour}:00 ${ampm}`; //  - ${displayNextHour}:00 ${nextAmpm}

            const eventDetails = document.createElement('span');
            eventDetails.className = 'event-details';
            if (dayEvents[timeStr]) {
                eventDetails.textContent = dayEvents[timeStr];
            } else {
                eventDetails.textContent = 'Click to add event';
                eventDetails.classList.add('empty');
            }

            li.appendChild(timeLabel);
            li.appendChild(eventDetails);
            timeSlotsListUI.appendChild(li);
        }
    }

    function handleTimeSlotClick(e) {
        const targetLi = e.target.closest('li');
        if (!targetLi) return;

        const timeSlot = targetLi.dataset.timeSlot;
        if (!timeSlot) return;

        if (!plannerData[selectedDate]) {
            plannerData[selectedDate] = {};
        }
        const dayEvents = plannerData[selectedDate];
        const existingEvent = dayEvents[timeSlot];

        if (existingEvent) {
            // Edit or Delete
            const action = prompt(`Event: ${existingEvent}\n\nType 'delete' to remove, or enter new text to edit:`, existingEvent);
            if (action === null) { // User cancelled
                return;
            } else if (action.toLowerCase() === 'delete') {
                delete dayEvents[timeSlot];
            } else if (action.trim() === "") {
                alert("Event description cannot be empty. To delete, type 'delete'.");
                return;
            }
             else {
                dayEvents[timeSlot] = action.trim();
            }
        } else {
            // Add new event
            const newEvent = prompt(`Add event for ${timeSlot} on ${currentDateDisplay.textContent.split(',')[1].trim()}:`);
            if (newEvent && newEvent.trim() !== "") {
                dayEvents[timeSlot] = newEvent.trim();
            } else if (newEvent !== null && newEvent.trim() === "") {
                alert("Event description cannot be empty.");
                return;
            }
        }
        saveData();
        renderTimeSlots(); // Re-render to show changes
    }

    // --- Start the app ---
    init();
});
