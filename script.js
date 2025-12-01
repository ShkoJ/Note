/* =========================================
   1. FIREBASE CONFIG
   ========================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBvHyi_7JdGenOU96jMV51pRoH_TW6897A",
    authDomain: "note-taking-app-c133e.firebaseapp.com",
    projectId: "note-taking-app-c133e",
    storageBucket: "note-taking-app-c133e.firebasestorage.app",
    messagingSenderId: "781167811136",
    appId: "1:781167811136:web:823223e2428ea7a0381da5",
    measurementId: "G-8BPTPK0DYG"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const docRef = doc(db, "userData", "my-tracker-v2"); // New doc for fresh start

/* =========================================
   2. DATA LAYER
   ========================================= */

// Empty State (No Dummy Data)
const defaultState = {
    tasks: [],
    journal: [],
    milestones: [],
    categories: ['General', 'DMS', 'CRM'], // Default categories
    theme: 'light'
};

let appState = { ...defaultState };

window.saveData = async function() {
    localStorage.setItem('analystOS_Data', JSON.stringify(appState));
    try {
        await setDoc(docRef, appState);
        console.log("Cloud synced.");
    } catch (e) {
        console.error("Sync error:", e);
    }
};

window.loadData = async function() {
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            appState = docSnap.data();
            // Ensure schema integrity
            if(!appState.categories) appState.categories = ['General'];
            if(!appState.milestones) appState.milestones = [];
        } else {
            // Check local if cloud empty
            const local = localStorage.getItem('analystOS_Data');
            if(local) appState = JSON.parse(local);
            else window.saveData(); // Init fresh
        }
    } catch (e) {
        const local = localStorage.getItem('analystOS_Data');
        if(local) appState = JSON.parse(local);
    }
    
    applyTheme(appState.theme);
    renderAll();
};

function renderAll() {
    renderTasks();
    renderJournal();
    renderMilestones(); // Will render current active view
    updateDateDisplay();
}

function generateUUID() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/* =========================================
   3. TASK LOGIC (Dual View + Categories)
   ========================================= */

function renderTasks() {
    // Clear Boards
    const ids = ['daily-todo', 'daily-progress', 'daily-done', 'weekly-todo', 'weekly-progress', 'weekly-done'];
    ids.forEach(id => document.getElementById(id).innerHTML = '');

    const today = new Date().toISOString().split('T')[0];
    
    // Helper: Get Week Range
    const curr = new Date();
    const first = curr.getDate() - curr.getDay(); // First day is the day of the month - the day of the week
    const last = first + 6; // last day is the first day + 6
    const firstday = new Date(curr.setDate(first)).toISOString().split('T')[0];
    const lastday = new Date(curr.setDate(last)).toISOString().split('T')[0];

    appState.tasks.forEach(task => {
        const card = createTaskCard(task);
        
        // LOGIC 1: DAILY BOARD
        // Show if Due Date is Today OR (Status is In Progress/To Do AND Due Date <= Today)
        if (task.dueDate === today || (task.status !== 'Done' && task.dueDate <= today)) {
            const colId = `daily-${task.status.toLowerCase().replace(' ', '')}`;
            const col = document.getElementById(colId);
            if(col) col.appendChild(card.cloneNode(true));
        }

        // LOGIC 2: WEEKLY BOARD
        // Show if Due Date is within this week
        if (task.dueDate >= firstday && task.dueDate <= lastday) {
            const colId = `weekly-${task.status.toLowerCase().replace(' ', '')}`;
            const col = document.getElementById(colId);
            if(col) {
                // Add event listener again because cloneNode loses it
                const weeklyCard = card.cloneNode(true);
                weeklyCard.onclick = () => window.openTaskModal(task.id);
                col.appendChild(weeklyCard);
            }
        }
    });

    // Re-attach click events to Daily board clones
    ids.forEach(id => {
        if(id.includes('daily')) {
            document.getElementById(id).childNodes.forEach(node => {
                const taskId = node.dataset.id;
                node.onclick = () => window.openTaskModal(taskId);
            });
        }
    });
}

function createTaskCard(task) {
    const div = document.createElement('div');
    div.className = 'kanban-card';
    div.draggable = true;
    div.dataset.id = task.id;
    div.innerHTML = `
        <span class="priority-tag p-${task.priority}"></span>
        ${task.category ? `<span class="k-cat">${task.category}</span>` : ''}
        <div class="k-title">${task.title}</div>
        <div class="k-date"><i class="fa-regular fa-calendar"></i> ${task.dueDate}</div>
    `;
    div.onclick = () => window.openTaskModal(task.id);
    return div;
}

// Category Management
window.toggleCatManager = function() {
    const el = document.getElementById('cat-manager');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    renderCatList();
}

window.addCategory = function() {
    const input = document.getElementById('new-cat-input');
    const val = input.value.trim();
    if(val && !appState.categories.includes(val)) {
        appState.categories.push(val);
        input.value = '';
        window.saveData();
        renderCatList();
        populateCatDropdown();
    }
}

window.removeCategory = function(cat) {
    appState.categories = appState.categories.filter(c => c !== cat);
    window.saveData();
    renderCatList();
    populateCatDropdown();
}

function renderCatList() {
    const container = document.getElementById('cat-list-display');
    container.innerHTML = appState.categories.map(c => 
        `<span class="cat-tag-manage">${c} <span class="cat-remove" onclick="window.removeCategory('${c}')">&times;</span></span>`
    ).join('');
}

function populateCatDropdown(selected = '') {
    const select = document.getElementById('t-category');
    select.innerHTML = '<option value="">No Category</option>' + 
        appState.categories.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
}

/* =========================================
   4. JOURNAL LOGIC (Editable)
   ========================================= */

function renderJournal() {
    const container = document.getElementById('journal-feed');
    container.innerHTML = '';
    
    // Sort desc
    const sorted = [...appState.journal].sort((a,b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(entry => {
        const div = document.createElement('div');
        div.className = 'journal-entry';
        div.innerHTML = `
            <div class="j-meta">
                ${entry.date} [${entry.time}]
                <button class="j-edit-btn" onclick="window.openJournalModal('${entry.id}')">Edit</button>
            </div>
            <div class="j-block">
                <h4>Recap</h4>
                <div class="j-text">${entry.recap}</div>
            </div>
            <div class="j-block">
                <h4>Plan</h4>
                <div class="j-text">${entry.plan}</div>
            </div>
            ${entry.notes ? `<div class="j-block"><h4>Notes</h4><div class="j-text" style="font-style:italic">${entry.notes}</div></div>` : ''}
        `;
        container.appendChild(div);
    });
}

/* =========================================
   5. MILESTONE LOGIC (3 Views)
   ========================================= */

let currentMilestoneView = 'kanban';

window.switchMilestoneView = function(viewName) {
    currentMilestoneView = viewName;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-btn')[viewName === 'kanban' ? 0 : viewName === 'list' ? 1 : 2].classList.add('active');
    
    document.querySelectorAll('.ms-view-container').forEach(c => c.classList.remove('active'));
    document.getElementById(`ms-${viewName}`).classList.add('active');
    
    renderMilestones();
}

function renderMilestones() {
    if (currentMilestoneView === 'kanban') renderMSKanban();
    else if (currentMilestoneView === 'list') renderMSList();
    else renderMSCalendar();
}

function renderMSKanban() {
    const cols = { 'Planned': [], 'In Progress': [], 'Mastered': [] };
    appState.milestones.forEach(m => {
        if(cols[m.status]) cols[m.status].push(m);
    });

    ['Planned', 'In Progress', 'Mastered'].forEach(status => {
        const colId = `ms-col-${status === 'Planned' ? 'todo' : status === 'In Progress' ? 'progress' : 'done'}`;
        const container = document.getElementById(colId);
        // Keep header, clear content
        const header = container.querySelector('h4');
        container.innerHTML = '';
        container.appendChild(header);

        cols[status].forEach(m => {
            const card = document.createElement('div');
            card.className = 'kanban-card';
            card.innerHTML = `
                <div class="k-title">${m.title}</div>
                <div class="k-date">${m.targetDate}</div>
                <div style="font-size:0.7rem; margin-top:5px;">Progress: ${m.progress}%</div>
                <div style="height:4px; background:#eee; margin-top:2px;"><div style="width:${m.progress}%; height:100%; background:var(--accent);"></div></div>
            `;
            card.onclick = () => window.openMilestoneModal(m.id);
            container.appendChild(card);
        });
    });
}

function renderMSList() {
    const tbody = document.getElementById('ms-table-body');
    tbody.innerHTML = appState.milestones.map(m => `
        <tr onclick="window.openMilestoneModal('${m.id}')" style="cursor:pointer">
            <td>${m.title}</td>
            <td>${m.targetDate}</td>
            <td>${m.progress}%</td>
            <td>${m.status}</td>
        </tr>
    `).join('');
}

function renderMSCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    
    document.getElementById('cal-month-name').innerText = now.toLocaleString('default', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Padding
    for(let i=0; i<firstDay; i++) {
        const div = document.createElement('div');
        grid.appendChild(div);
    }

    // Days
    for(let i=1; i<=daysInMonth; i++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const div = document.createElement('div');
        div.className = 'cal-day';
        if(i === now.getDate()) div.classList.add('today');
        div.innerHTML = `<span>${i}</span>`;

        // Find milestones for this day
        const dayMS = appState.milestones.filter(m => m.targetDate === dateStr);
        dayMS.forEach(m => {
            const item = document.createElement('div');
            item.className = 'cal-item';
            item.innerText = m.title;
            item.onclick = (e) => { e.stopPropagation(); window.openMilestoneModal(m.id); };
            div.appendChild(item);
        });

        grid.appendChild(div);
    }
}

/* =========================================
   6. MODALS & INTERACTIONS
   ========================================= */

window.openTaskModal = function(id = null) {
    const modal = document.getElementById('task-modal');
    const form = document.getElementById('task-form');
    document.getElementById('cat-manager').style.display = 'none';
    form.reset();
    
    populateCatDropdown();

    if(id) {
        const t = appState.tasks.find(x => x.id === id);
        document.getElementById('task-id').value = t.id;
        document.getElementById('t-title').value = t.title;
        document.getElementById('t-date').value = t.dueDate;
        document.getElementById('t-priority').value = t.priority;
        document.getElementById('t-status').value = t.status;
        populateCatDropdown(t.category);
        document.getElementById('btn-delete-task').classList.remove('delete-btn-hidden');
    } else {
        document.getElementById('task-id').value = '';
        document.getElementById('t-date').valueAsDate = new Date();
        document.getElementById('btn-delete-task').classList.add('delete-btn-hidden');
    }
    modal.style.display = 'flex';
}

window.openJournalModal = function(id = null) {
    const modal = document.getElementById('journal-modal');
    const form = document.getElementById('journal-form');
    form.reset();

    if(id) {
        const j = appState.journal.find(x => x.id === id);
        document.getElementById('j-id').value = j.id;
        document.getElementById('j-date').value = j.date;
        document.getElementById('j-time').value = j.time;
        document.getElementById('j-recap').value = j.recap;
        document.getElementById('j-plan').value = j.plan;
        document.getElementById('j-notes').value = j.notes || '';
    } else {
        document.getElementById('j-id').value = '';
        document.getElementById('j-date').valueAsDate = new Date();
    }
    modal.style.display = 'flex';
}

window.openMilestoneModal = function(id = null) {
    const modal = document.getElementById('milestone-modal');
    const form = document.getElementById('milestone-form');
    form.reset();

    if(id) {
        const m = appState.milestones.find(x => x.id === id);
        document.getElementById('m-id').value = m.id;
        document.getElementById('m-title').value = m.title;
        document.getElementById('m-date').value = m.targetDate;
        document.getElementById('m-status').value = m.status;
        document.getElementById('m-details').value = m.details;
        document.getElementById('m-progress').value = m.progress;
        document.getElementById('m-prog-val').innerText = m.progress + '%';
        document.getElementById('btn-delete-ms').classList.remove('delete-btn-hidden');
    } else {
        document.getElementById('m-id').value = '';
        document.getElementById('btn-delete-ms').classList.add('delete-btn-hidden');
    }
    modal.style.display = 'flex';
}

window.closeModal = function(id) { document.getElementById(id).style.display = 'none'; }

// FORM SUBMITS

document.getElementById('task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const task = {
        id: id || generateUUID(),
        title: document.getElementById('t-title').value,
        dueDate: document.getElementById('t-date').value,
        priority: document.getElementById('t-priority').value,
        category: document.getElementById('t-category').value,
        status: document.getElementById('t-status').value
    };
    
    if(id) {
        const idx = appState.tasks.findIndex(t => t.id === id);
        appState.tasks[idx] = task;
    } else appState.tasks.push(task);

    window.saveData();
    renderTasks();
    window.closeModal('task-modal');
});

document.getElementById('journal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('j-id').value;
    const entry = {
        id: id || generateUUID(),
        date: document.getElementById('j-date').value,
        time: document.getElementById('j-time').value,
        recap: document.getElementById('j-recap').value,
        plan: document.getElementById('j-plan').value,
        notes: document.getElementById('j-notes').value
    };

    if(id) {
        const idx = appState.journal.findIndex(j => j.id === id);
        appState.journal[idx] = entry;
    } else appState.journal.push(entry);

    window.saveData();
    renderJournal();
    window.closeModal('journal-modal');
});

document.getElementById('milestone-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('m-id').value;
    const ms = {
        id: id || generateUUID(),
        title: document.getElementById('m-title').value,
        targetDate: document.getElementById('m-date').value,
        status: document.getElementById('m-status').value,
        details: document.getElementById('m-details').value,
        progress: document.getElementById('m-progress').value
    };

    if(id) {
        const idx = appState.milestones.findIndex(m => m.id === id);
        appState.milestones[idx] = ms;
    } else appState.milestones.push(ms);

    window.saveData();
    renderMilestones();
    window.closeModal('milestone-modal');
});

// Deletion Logic
window.deleteCurrentTask = function() {
    if(confirm('Delete?')) {
        appState.tasks = appState.tasks.filter(t => t.id !== document.getElementById('task-id').value);
        window.saveData(); renderTasks(); window.closeModal('task-modal');
    }
}
window.deleteCurrentMS = function() {
    if(confirm('Delete?')) {
        appState.milestones = appState.milestones.filter(m => m.id !== document.getElementById('m-id').value);
        window.saveData(); renderMilestones(); window.closeModal('milestone-modal');
    }
}

// Utils
function updateDateDisplay() {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    document.getElementById('current-date-display').innerText = new Date().toLocaleDateString('en-US', options);
}

function applyTheme(theme) {
    if (theme === 'dark') document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
}

document.getElementById('theme-toggle').addEventListener('click', () => {
    appState.theme = appState.theme === 'light' ? 'dark' : 'light';
    applyTheme(appState.theme);
    window.saveData();
});

// Init
window.addEventListener('DOMContentLoaded', () => {
    // Navigation Logic
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.addEventListener('click', () => {
            document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
            li.classList.add('active');
            document.getElementById(li.dataset.tab).classList.add('active-view');
        });
    });
    
    window.loadData();
});