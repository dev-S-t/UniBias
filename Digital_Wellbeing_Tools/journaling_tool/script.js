document.addEventListener('DOMContentLoaded', () => {
    const journalEditor = document.getElementById('journalEditor');
    const saveEntryButton = document.getElementById('saveEntry');
    const newEntryButton = document.getElementById('newEntry');
    const pastEntriesList = document.getElementById('pastEntriesList');
    const currentDateDisplay = document.getElementById('currentDateDisplay');
    const entryDateSelector = document.getElementById('entryDateSelector');

    let journalEntries = [];
    let selectedDate = getFormattedDate(new Date()); // YYYY-MM-DD

    // --- Initialization ---
    function initialize() {
        loadEntries();
        setSelectedDate(getFormattedDate(new Date())); // Default to today
        displayPastEntries();
        updateCurrentDateDisplay();
    }

    // --- Date Handling ---
    function getFormattedDate(dateObj) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function updateCurrentDateDisplay() {
        const dateObj = new Date(selectedDate + 'T00:00:00'); // Ensure correct date parsing
        currentDateDisplay.textContent = dateObj.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        entryDateSelector.value = selectedDate; // Sync date picker
    }

    function setSelectedDate(dateStr) {
        selectedDate = dateStr;
        loadEntryForDate(selectedDate);
        updateCurrentDateDisplay();
    }
    
    entryDateSelector.addEventListener('change', (event) => {
        setSelectedDate(event.target.value);
    });


    // --- Entry Management ---
    function loadEntries() {
        const storedEntries = localStorage.getItem('journalEntries');
        if (storedEntries) {
            journalEntries = JSON.parse(storedEntries);
        }
    }

    function saveEntries() {
        localStorage.setItem('journalEntries', JSON.stringify(journalEntries));
    }

    function loadEntryForDate(dateStr) {
        const entry = journalEntries.find(e => e.date === dateStr);
        if (entry) {
            journalEditor.value = entry.content;
        } else {
            journalEditor.value = ''; // Clear editor if no entry for this date
        }
    }

    saveEntryButton.addEventListener('click', () => {
        const content = journalEditor.value.trim();
        if (!selectedDate) {
            alert("Please select a date for your entry.");
            return;
        }

        if (!content) {
            // Optional: Ask if user wants to save an empty entry or delete an existing one
            if (journalEntries.some(e => e.date === selectedDate)) {
                if (!confirm("Entry is empty. Do you want to remove the existing entry for this date?")) {
                    return;
                }
            } else {
                alert("Cannot save an empty entry.");
                return;
            }
        }

        const existingEntryIndex = journalEntries.findIndex(e => e.date === selectedDate);
        if (existingEntryIndex > -1) {
            if (content) {
                journalEntries[existingEntryIndex].content = content;
            } else { // Empty content, so remove the entry
                journalEntries.splice(existingEntryIndex, 1);
            }
        } else if (content) { // Only add if there's content
            journalEntries.push({ date: selectedDate, content: content });
        }

        saveEntries();
        displayPastEntries(); // Refresh list
        alert(content ? "Entry saved!" : "Entry removed.");
    });

    newEntryButton.addEventListener('click', () => {
        setSelectedDate(getFormattedDate(new Date())); // Set to today
        journalEditor.value = '';
        journalEditor.focus();
    });

    // --- Displaying Past Entries ---
    function displayPastEntries() {
        pastEntriesList.innerHTML = ''; // Clear existing list

        // Sort entries by date, most recent first
        const sortedEntries = [...journalEntries].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (sortedEntries.length === 0) {
            pastEntriesList.innerHTML = '<p>No past entries yet.</p>';
            return;
        }

        sortedEntries.forEach(entry => {
            const item = document.createElement('div');
            item.className = 'past-entry-item';
            item.setAttribute('data-date', entry.date);

            const dateDisplay = document.createElement('div');
            dateDisplay.className = 'date';
            const entryDateObj = new Date(entry.date + 'T00:00:00');
            dateDisplay.textContent = entryDateObj.toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });

            const snippet = document.createElement('div');
            snippet.className = 'snippet';
            snippet.textContent = entry.content.substring(0, 100) + (entry.content.length > 100 ? '...' : '');

            item.appendChild(dateDisplay);
            item.appendChild(snippet);

            item.addEventListener('click', () => {
                setSelectedDate(entry.date);
            });

            pastEntriesList.appendChild(item);
        });
    }

    // Initialize the tool
    initialize();
});
