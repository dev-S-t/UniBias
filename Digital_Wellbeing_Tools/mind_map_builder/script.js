document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('mindMapCanvas');
    const ctx = canvas.getContext('2d');

    const addNodeButton = document.getElementById('addNodeButton');
    const connectNodesButton = document.getElementById('connectNodesButton');
    const deleteElementButton = document.getElementById('deleteElementButton');
    const saveMapButton = document.getElementById('saveMapButton');
    const loadMapButton = document.getElementById('loadMapButton');
    const clearMapButton = document.getElementById('clearMapButton');
    const nodeTextInput = document.getElementById('nodeTextInput');
    const modeIndicator = document.getElementById('modeIndicator');

    let nodes = [];
    let connections = [];
    let selectedNode = null;
    let selectedForConnection = []; // Stores up to two nodes for creating a connection
    let isDragging = false;
    let dragOffsetX, dragOffsetY;
    let mode = 'none'; // 'none', 'addNode', 'connectNodes'

    const NODE_RADIUS = 30;
    const NODE_TEXT_COLOR = '#000000';
    const NODE_STROKE_COLOR = '#007bff';
    const NODE_FILL_COLOR = '#ffffff';
    const NODE_SELECTED_COLOR = '#ffc107';
    const LINE_COLOR = '#333333';

    // --- Canvas Setup ---
    function resizeCanvas() {
        canvas.width = window.innerWidth - 20; // Adjust as needed
        canvas.height = window.innerHeight - document.querySelector('.toolbar').offsetHeight - 40; // Adjust
        draw();
    }
    window.addEventListener('resize', resizeCanvas);

    // --- Initialization ---
    function init() {
        resizeCanvas();
        loadMap(); // Load map from localStorage
        attachEventListeners();
        draw();
    }

    function setMode(newMode) {
        mode = newMode;
        modeIndicator.textContent = `Mode: ${mode}`;
        // Reset button styles
        addNodeButton.classList.remove('active');
        connectNodesButton.classList.remove('active');

        if (mode === 'addNode') addNodeButton.classList.add('active');
        if (mode === 'connectNodes') connectNodesButton.classList.add('active');
        
        selectedForConnection = []; // Clear selection when mode changes
        selectedNode = null; // Clear single node selection
        draw();
    }

    // --- Event Listeners ---
    function attachEventListeners() {
        addNodeButton.addEventListener('click', () => setMode(mode === 'addNode' ? 'none' : 'addNode'));
        connectNodesButton.addEventListener('click', () => setMode(mode === 'connectNodes' ? 'none' : 'connectNodes'));
        deleteElementButton.addEventListener('click', deleteSelectedElement);
        saveMapButton.addEventListener('click', saveMap);
        loadMapButton.addEventListener('click', () => {
            if(confirm("Loading will overwrite current changes. Are you sure?")) {
                loadMap();
            }
        });
        clearMapButton.addEventListener('click', () => {
            if(confirm("Are you sure you want to clear the entire map?")) {
                clearMap();
            }
        });

        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('dblclick', handleDoubleClick); // For editing text

        nodeTextInput.addEventListener('blur', handleTextInputBlur);
        nodeTextInput.addEventListener('keydown', handleTextInputKeyDown);
    }

    // --- Core Logic ---
    function handleMouseDown(e) {
        const pos = getMousePos(e);
        let clickedOnNode = false;

        if (mode === 'addNode') {
            addNode(pos.x, pos.y, "New Node");
            setMode('none'); // Switch back to selection mode after adding a node
            return;
        }

        for (let i = nodes.length - 1; i >= 0; i--) { // Iterate backwards for better selection of overlapping nodes
            const node = nodes[i];
            const distance = Math.sqrt((pos.x - node.x) ** 2 + (pos.y - node.y) ** 2);
            if (distance < NODE_RADIUS) {
                clickedOnNode = true;
                if (mode === 'connectNodes') {
                    toggleNodeForConnection(node);
                } else { // Default 'none' mode (selection/dragging)
                    selectedNode = node;
                    selectedForConnection = []; // Clear connection selection
                    isDragging = true;
                    dragOffsetX = pos.x - node.x;
                    dragOffsetY = pos.y - node.y;
                }
                break;
            }
        }

        if (!clickedOnNode && mode !== 'connectNodes') {
            selectedNode = null; // Clicked on empty space
            selectedForConnection = [];
        }
        draw();
    }

    function handleMouseMove(e) {
        if (isDragging && selectedNode) {
            const pos = getMousePos(e);
            selectedNode.x = pos.x - dragOffsetX;
            selectedNode.y = pos.y - dragOffsetY;
            draw();
        }
    }

    function handleMouseUp() {
        if (isDragging) {
            isDragging = false;
            // Potentially save map here if auto-save on change is desired
        }
    }

    function handleDoubleClick(e) {
        const pos = getMousePos(e);
        for (const node of nodes) {
            const distance = Math.sqrt((pos.x - node.x) ** 2 + (pos.y - node.y) ** 2);
            if (distance < NODE_RADIUS) {
                selectedNode = node; // Select the node for text input
                showTextInput(node);
                break;
            }
        }
    }
    
    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    // --- Node Management ---
    function addNode(x, y, text = "Node") {
        const newNode = {
            id: Date.now().toString(), // Simple unique ID
            x,
            y,
            text,
            radius: NODE_RADIUS,
            fillColor: NODE_FILL_COLOR,
            strokeColor: NODE_STROKE_COLOR
        };
        nodes.push(newNode);
        selectedNode = newNode; // Select the new node
        showTextInput(newNode); // Immediately allow text editing
        draw();
    }

    function showTextInput(node) {
        nodeTextInput.style.display = 'block';
        nodeTextInput.style.left = (canvas.offsetLeft + node.x - node.radius) + 'px';
        nodeTextInput.style.top = (canvas.offsetTop + node.y - node.radius / 2) + 'px';
        nodeTextInput.style.width = (node.radius * 2 - 10) + 'px';
        nodeTextInput.value = node.text;
        nodeTextInput.focus();
        nodeTextInput.select();
    }

    function handleTextInputBlur() {
        if (selectedNode && nodeTextInput.style.display === 'block') {
            selectedNode.text = nodeTextInput.value;
            nodeTextInput.style.display = 'none';
            selectedNode = null; // Deselect after editing
            draw();
        }
    }
    
    function handleTextInputKeyDown(e) {
        if (e.key === 'Enter') {
            nodeTextInput.blur(); // Apply text and hide
        } else if (e.key === 'Escape') {
            nodeTextInput.style.display = 'none'; // Cancel editing
            selectedNode = null; 
            draw();
        }
    }


    // --- Connection Management ---
    function toggleNodeForConnection(node) {
        const index = selectedForConnection.findIndex(n => n.id === node.id);
        if (index > -1) {
            selectedForConnection.splice(index, 1); // Deselect if already selected
        } else {
            if (selectedForConnection.length < 2) {
                selectedForConnection.push(node);
            }
        }

        if (selectedForConnection.length === 2) {
            addConnection(selectedForConnection[0].id, selectedForConnection[1].id);
            selectedForConnection = []; // Reset for next connection
            setMode('none'); // Optionally switch back to selection mode
        }
        draw();
    }

    function addConnection(fromNodeId, toNodeId) {
        // Avoid duplicate connections
        const exists = connections.some(conn =>
            (conn.fromNodeId === fromNodeId && conn.toNodeId === toNodeId) ||
            (conn.fromNodeId === toNodeId && conn.toNodeId === fromNodeId)
        );
        if (!exists && fromNodeId !== toNodeId) {
            connections.push({ fromNodeId, toNodeId });
        }
        draw();
    }
    
    // --- Deletion ---
    function deleteSelectedElement() {
        if (selectedNode && mode !== 'connectNodes') { // Prioritize deleting a single selected node
            // Remove node
            nodes = nodes.filter(n => n.id !== selectedNode.id);
            // Remove connections associated with this node
            connections = connections.filter(c => c.fromNodeId !== selectedNode.id && c.toNodeId !== selectedNode.id);
            selectedNode = null;
        } else if (selectedForConnection.length > 0 && mode === 'connectNodes') {
            // If in connect mode and a node is selected for connection, allow deleting it
            // This is a bit ambiguous, usually delete is for a fully selected element
            // For simplicity, let's assume delete works on 'selectedNode' primarily.
            // Or, one could implement deleting the *last* connection made.
            // For now, this button will primarily target 'selectedNode'.
            alert("To delete a node, select it directly (not in 'Connect Nodes' mode). Connection deletion is not yet implemented via this button.");

        } else {
            alert("Select a node to delete.");
        }
        draw();
    }


    // --- Drawing ---
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw connections
        connections.forEach(conn => {
            const fromNode = nodes.find(n => n.id === conn.fromNodeId);
            const toNode = nodes.find(n => n.id === conn.toNodeId);
            if (fromNode && toNode) {
                ctx.beginPath();
                ctx.moveTo(fromNode.x, fromNode.y);
                ctx.lineTo(toNode.x, toNode.y);
                ctx.strokeStyle = LINE_COLOR;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });

        // Draw nodes
        nodes.forEach(node => {
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            
            // Highlight if selected or part of connection process
            if (selectedNode && selectedNode.id === node.id && mode !== 'connectNodes') {
                ctx.fillStyle = NODE_SELECTED_COLOR;
            } else if (selectedForConnection.some(n => n.id === node.id)) {
                ctx.fillStyle = NODE_SELECTED_COLOR; // Highlight nodes selected for connection
            }
            else {
                ctx.fillStyle = node.fillColor;
            }
            
            ctx.fill();
            ctx.strokeStyle = node.strokeColor;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw text
            ctx.fillStyle = NODE_TEXT_COLOR;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '14px Arial';
            // Simple text wrapping (split by space)
            const words = node.text.split(' ');
            let line = '';
            let y = node.y - (words.length > 1 ? (words.length/2 * 7) : 0) ; // Adjust start Y for multi-line
            const lineHeight = 15;

            for(let n = 0; n < words.length; n++) {
                let testLine = line + words[n] + ' ';
                // Max width rough estimate, can be improved
                if (ctx.measureText(testLine).width > node.radius * 2 - 10 && n > 0) {
                    ctx.fillText(line, node.x, y);
                    line = words[n] + ' ';
                    y += lineHeight;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line.trim(), node.x, y);

        });
    }

    // --- Storage ---
    function saveMap() {
        const mapData = {
            nodes: nodes,
            connections: connections
        };
        localStorage.setItem('mindMapData', JSON.stringify(mapData));
        alert("Map saved!");
    }

    function loadMap() {
        const mapDataString = localStorage.getItem('mindMapData');
        if (mapDataString) {
            const mapData = JSON.parse(mapDataString);
            nodes = mapData.nodes || [];
            connections = mapData.connections || [];
            // Ensure IDs are strings if they were stringified from numbers
            nodes.forEach(n => n.id = String(n.id));
            connections.forEach(c => {
                c.fromNodeId = String(c.fromNodeId);
                c.toNodeId = String(c.toNodeId);
            });
        } else {
            // Initialize with a central node if no map is saved
            nodes = [{
                id: Date.now().toString(), 
                x: canvas.width / 2, 
                y: canvas.height / 2, 
                text: "Central Idea", 
                radius: NODE_RADIUS, 
                fillColor: NODE_FILL_COLOR, 
                strokeColor: NODE_STROKE_COLOR 
            }];
            connections = [];
        }
        selectedNode = null;
        selectedForConnection = [];
        isDragging = false;
        setMode('none');
        draw();
    }

    function clearMap() {
        nodes = [];
        connections = [];
        localStorage.removeItem('mindMapData'); // Also clear from storage
        selectedNode = null;
        selectedForConnection = [];
        isDragging = false;
        setMode('none');
        // Add a default starting node
        addNode(canvas.width / 2, canvas.height / 2, "New Map");
        draw();
    }

    // --- Start ---
    init();
});
