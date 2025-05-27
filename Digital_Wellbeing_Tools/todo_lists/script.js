document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const newListNameInput = document.getElementById('newListNameInput');
    const addListButton = document.getElementById('addListButton');
    const deleteListButton = document.getElementById('deleteListButton');
    const listsContainer = document.getElementById('listsContainer');
    const currentListNameDisplay = document.getElementById('currentListNameDisplay');
    const newTaskInput = document.getElementById('newTaskInput');
    const newTaskDueDateInput = document.getElementById('newTaskDueDateInput');
    const addTaskButton = document.getElementById('addTaskButton');
    const taskListUI = document.getElementById('taskList');

    // Data
    let todoData = {}; // { 'listName': [{id, text, completed, dueDate}, ...], ... }
    let currentListName = null;
    let draggedTaskElement = null;

    // --- Initialization ---
    function init() {
        loadData();
        renderLists();
        if (Object.keys(todoData).length > 0) {
            // Select the first list by default, or the last active one
            const lastActiveList = localStorage.getItem('todoAppLastActiveList');
            if (lastActiveList && todoData[lastActiveList]) {
                 selectList(lastActiveList);
            } else {
                selectList(Object.keys(todoData)[0]);
            }
        } else {
            currentListNameDisplay.textContent = "Create a new list to get started!";
        }
        attachEventListeners();
    }

    // --- Event Listeners ---
    function attachEventListeners() {
        addListButton.addEventListener('click', handleAddList);
        deleteListButton.addEventListener('click', handleDeleteList);
        addTaskButton.addEventListener('click', handleAddTask);

        // Event delegation for dynamically created task items
        taskListUI.addEventListener('click', handleTaskActions);
        taskListUI.addEventListener('change', handleTaskToggleComplete);
        taskListUI.addEventListener('dragstart', handleDragStart);
        taskListUI.addEventListener('dragover', handleDragOver);
        taskListUI.addEventListener('drop', handleDrop);
        taskListUI.addEventListener('dragend', handleDragEnd);
    }

    // --- Data Management (localStorage) ---
    function loadData() {
        const storedData = localStorage.getItem('todoAppData');
        if (storedData) {
            todoData = JSON.parse(storedData);
        }
    }

    function saveData() {
        localStorage.setItem('todoAppData', JSON.stringify(todoData));
        if (currentListName) {
            localStorage.setItem('todoAppLastActiveList', currentListName);
        }
    }

    // --- List Management ---
    function handleAddList() {
        const listName = newListNameInput.value.trim();
        if (!listName) {
            alert("List name cannot be empty.");
            return;
        }
        if (todoData[listName]) {
            alert(`List "${listName}" already exists.`);
            return;
        }
        todoData[listName] = [];
        newListNameInput.value = '';
        saveData();
        renderLists();
        selectList(listName);
    }

    function handleDeleteList() {
        if (!currentListName) {
            alert("No list selected to delete.");
            return;
        }
        if (confirm(`Are you sure you want to delete the list "${currentListName}" and all its tasks?`)) {
            delete todoData[currentListName];
            const oldListName = currentListName;
            currentListName = null;
            saveData();
            renderLists();
            // Try to select another list, or show default message
            if (Object.keys(todoData).length > 0) {
                selectList(Object.keys(todoData)[0]);
            } else {
                currentListNameDisplay.textContent = "Create a new list to get started!";
                taskListUI.innerHTML = ''; // Clear tasks
            }
             // Remove from last active if it was the deleted one
            if (localStorage.getItem('todoAppLastActiveList') === oldListName) {
                localStorage.removeItem('todoAppLastActiveList');
            }
        }
    }

    function selectList(listName) {
        if (!todoData[listName]) return; // Should not happen if UI is correct
        currentListName = listName;
        currentListNameDisplay.textContent = `Tasks for: ${listName}`;
        renderLists(); // To update active tab style
        renderTasks();
        saveData(); // To save last active list
    }

    // --- Task Management ---
    function handleAddTask() {
        if (!currentListName) {
            alert("Please select a list first.");
            return;
        }
        const taskText = newTaskInput.value.trim();
        const taskDueDate = newTaskDueDateInput.value;

        if (!taskText) {
            alert("Task description cannot be empty.");
            return;
        }

        const newTask = {
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // More robust ID
            text: taskText,
            completed: false,
            dueDate: taskDueDate || null
        };
        todoData[currentListName].push(newTask);
        newTaskInput.value = '';
        newTaskDueDateInput.value = ''; // Clear due date
        saveData();
        renderTasks();
    }

    function handleTaskActions(e) {
        const target = e.target;
        const taskItem = target.closest('li');
        if (!taskItem || !currentListName) return;
        
        const taskId = taskItem.dataset.taskId;

        if (target.classList.contains('delete-task-button')) {
            todoData[currentListName] = todoData[currentListName].filter(task => task.id !== taskId);
            saveData();
            renderTasks();
        } else if (target.classList.contains('task-text')) {
            // Edit task text
            const task = todoData[currentListName].find(t => t.id === taskId);
            if (task) {
                const newText = prompt("Edit task:", task.text);
                if (newText !== null && newText.trim() !== "") {
                    task.text = newText.trim();
                    saveData();
                    renderTasks();
                } else if (newText !== null && newText.trim() === "") {
                    alert("Task text cannot be empty.");
                }
            }
        }
    }

    function handleTaskToggleComplete(e) {
        const target = e.target;
        if (target.type === 'checkbox') {
            const taskItem = target.closest('li');
            if (!taskItem || !currentListName) return;

            const taskId = taskItem.dataset.taskId;
            const task = todoData[currentListName].find(t => t.id === taskId);
            if (task) {
                task.completed = target.checked;
                saveData();
                renderTasks(); // Re-render to apply styles
            }
        }
    }

    // --- Rendering ---
    function renderLists() {
        listsContainer.innerHTML = ''; // Clear existing list tabs
        Object.keys(todoData).forEach(listName => {
            const listTab = document.createElement('div');
            listTab.className = 'list-tab';
            listTab.textContent = listName;
            if (listName === currentListName) {
                listTab.classList.add('active');
            }
            listTab.addEventListener('click', () => selectList(listName));
            listsContainer.appendChild(listTab);
        });
    }

    function renderTasks() {
        taskListUI.innerHTML = ''; // Clear existing tasks
        if (!currentListName || !todoData[currentListName]) {
            // Optionally display a message like "No tasks in this list" or "Select a list"
            return;
        }

        const tasks = todoData[currentListName];
        tasks.forEach(task => {
            const li = document.createElement('li');
            li.dataset.taskId = task.id;
            li.draggable = true; // For drag and drop
            if (task.completed) {
                li.classList.add('completed');
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;

            const textSpan = document.createElement('span');
            textSpan.className = 'task-text';
            textSpan.textContent = task.text;

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-task-button';
            deleteButton.textContent = 'Delete';

            li.appendChild(checkbox);
            li.appendChild(textSpan);

            if (task.dueDate) {
                const dueDateSpan = document.createElement('span');
                dueDateSpan.className = 'task-due-date';
                dueDateSpan.textContent = formatDate(task.dueDate);
                li.appendChild(dueDateSpan);
            }
            
            li.appendChild(deleteButton);
            taskListUI.appendChild(li);
        });
    }
    
    function formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString + 'T00:00:00'); // Ensure local time interpretation
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // --- Drag and Drop Task Reordering ---
    function handleDragStart(e) {
        if (e.target.tagName === 'LI') {
            draggedTaskElement = e.target;
            e.dataTransfer.effectAllowed = 'move';
            // e.dataTransfer.setData('text/plain', e.target.dataset.taskId); // Not strictly needed if using draggedTaskElement
            setTimeout(() => { // Make the dragged element semi-transparent
                e.target.classList.add('task-dragging');
            }, 0);
        }
    }

    function handleDragOver(e) {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
        const targetLi = e.target.closest('li');
        if (targetLi && targetLi !== draggedTaskElement) {
            const rect = targetLi.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            // Determine if dragging above or below the target list item
            if (e.clientY < midpoint) {
                taskListUI.insertBefore(draggedTaskElement, targetLi);
            } else {
                taskListUI.insertBefore(draggedTaskElement, targetLi.nextSibling);
            }
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        if (draggedTaskElement) {
            draggedTaskElement.classList.remove('task-dragging');
            
            // Update the actual data array based on new DOM order
            const newOrderedTaskIds = Array.from(taskListUI.querySelectorAll('li')).map(li => li.dataset.taskId);
            const currentTasks = todoData[currentListName];
            const newOrderedTasks = [];
            newOrderedTaskIds.forEach(id => {
                const task = currentTasks.find(t => t.id === id);
                if (task) newOrderedTasks.push(task);
            });
            todoData[currentListName] = newOrderedTasks;
            saveData();
            // No need to call renderTasks() here as DOM is already updated visually by drag/drop
        }
    }

    function handleDragEnd(e) {
        if (draggedTaskElement) {
             // Ensure class is removed if drop didn't happen or happened outside a valid target
            draggedTaskElement.classList.remove('task-dragging');
        }
        draggedTaskElement = null;
    }


    // --- Start the app ---
    init();
});
