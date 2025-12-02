/* =========================================
   1. FIREBASE CONFIG
   ========================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const docRef = doc(db, "userData", "my-tracker-v3");

/* =========================================
   2. DATA LAYER
   ========================================= */

const defaultState = {
    tasks: [],
    journal: [],
    notes: [], // New Notes Array
    milestones: [],
    categories: ['General', 'DMS', 'CRM', 'Ticketing'], 
    theme: 'light'
};

let appState = { ...defaultState };

function getLocalISODate() {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
}

window.saveData = async function() {
    localStorage.setItem('analystOS_Data_v3', JSON.stringify(appState));
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
            if(!appState.tasks) appState.tasks = [];
            if(!appState.journal) appState.journal = [];
            if(!appState.notes) appState.notes = [];
            if(!appState.milestones) appState.milestones = [];
            if(!appState.categories) appState.categories = ['General'];
        } else {
            const local = localStorage.getItem('analystOS_Data_v3');
            if(local) appState = JSON.parse(local);
            else window.saveData(); 
        }
    } catch (e) {
        const local = localStorage.getItem('analystOS_Data_v3');
        if(local) appState = JSON.parse(local);
    }
    
    applyTheme(appState.theme);
    checkEndOfMonth();
    renderAll();
};

function renderAll() {
    renderTasks();
    renderJournal();
    renderNotes(); // New
    renderMilestones();
    renderHistory();
    updateDateDisplay();
}

function generateUUID() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function checkEndOfMonth() {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    if(today.getDate() === lastDay) {
        const banner = document.getElementById('backup-warning');
        if(banner) banner.style.display = 'flex';
    }
}

window.exportData = function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
    const anchor = document.createElement('a');
    anchor.setAttribute("href", dataStr);
    anchor.setAttribute("download", `Backup_${getLocalISODate()}.json`);
    anchor.click();
};

/* =========================================
   3. TASK LOGIC
   ========================================= */

function renderTasks() {
    const ids = ['daily-todo', 'daily-progress', 'daily-done', 'weekly-todo', 'weekly-progress', 'weekly-done'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = '';
    });

    const today = getLocalISODate();

    appState.tasks.forEach(task => {
        const card = createTaskCard(task);
        
        // --- LOGIC GATES --- //
        if (task.status === 'In Progress') {
            const col = document.getElementById('daily-progress');
            if(col) col.appendChild(card.cloneNode(true));
            return;
        }

        if (task.status === 'Done') {
            if (task.completedDate === today) {
                const col = document.getElementById('daily-done');
                if(col) col.appendChild(card.cloneNode(true));
            }
            return;
        }

        if (task.status === 'To Do') {
            if (task.dueDate <= today) {
                const col = document.getElementById('daily-todo');
                if(col) col.appendChild(card.cloneNode(true));
            } else {
                const col = document.getElementById('weekly-todo');
                if(col) {
                    const clone = card.cloneNode(true);
                    clone.onclick = () => window.openTaskModal(task.id);
                    col.appendChild(clone);
                }
            }
        }
    });

    ids.forEach(id => {
        const col = document.getElementById(id);
        if(col) {
            col.childNodes.forEach(node => {
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
    const today = getLocalISODate();
    const isOverdue = task.status !== 'Done' && task.dueDate < today;
    const dateColor = isOverdue ? '#D44C47' : 'var(--text-muted)';
    div.innerHTML = `
        <span class="priority-tag p-${task.priority}"></span>
        ${task.category ? `<span class="k-cat">${task.category}</span>` : ''}
        <div class="k-title">${task.title}</div>
        <div class="k-date" style="color:${dateColor}"><i class="fa-regular fa-calendar"></i> ${task.dueDate} ${isOverdue ? '(Overdue)' : ''}</div>
    `;
    div.onclick = () => window.openTaskModal(task.id);
    return div;
}

// Category Management
window.toggleCatManager = function() {
    const el = document.getElementById('cat-manager');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    renderCatList();
};

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
};

window.removeCategory = function(cat) {
    appState.categories = appState.categories.filter(c => c !== cat);
    window.saveData();
    renderCatList();
    populateCatDropdown();
};

function renderCatList() {
    const container = document.getElementById('cat-list-display');
    container.innerHTML = appState.categories.map(c => `<span class="cat-tag-manage">${c} <span class="cat-remove" onclick="window.removeCategory('${c}')">&times;</span></span>`).join('');
}

function populateCatDropdown(selected = '') {
    const select = document.getElementById('t-category');
    select.innerHTML = '<option value="">No Category</option>' + appState.categories.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
}

/* =========================================
   4. NOTES LOGIC (NEW)
   ========================================= */

window.renderNotes = function() {
    const pinnedContainer = document.getElementById('pinned-notes-container');
    const listContainer = document.getElementById('all-notes-container');
    pinnedContainer.innerHTML = '';
    listContainer.innerHTML = '';

    const filterDate = document.getElementById('notes-date-filter').value;

    let notesToRender = appState.notes;
    if(filterDate) {
        notesToRender = notesToRender.filter(n => n.date === filterDate);
    }

    // Sort: Newest first
    notesToRender.sort((a,b) => new Date(b.date) - new Date(a.date));

    notesToRender.forEach(note => {
        const div = document.createElement('div');
        div.className = `note-card ${note.isPinned ? 'pinned' : ''}`;
        
        // Pinned Icon
        if(note.isPinned) {
            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-thumbtack pinned-icon';
            div.appendChild(icon);
        }

        div.innerHTML += `
            <div class="n-meta">
                <span><i class="fa-regular fa-calendar"></i> ${note.date}</span>
            </div>
            <div class="n-text">${note.content}</div>
        `;
        div.onclick = () => window.openNoteModal(note.id);

        if(note.isPinned && !filterDate) {
            pinnedContainer.appendChild(div);
        } else {
            listContainer.appendChild(div);
        }
    });

    if(pinnedContainer.innerHTML === '') pinnedContainer.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem; grid-column:1/-1;">No pinned notes. Use "Pin to Dashboard" for important rules.</div>';
    if(listContainer.innerHTML === '') listContainer.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem; text-align:center;">No timeline notes found.</div>';
};

/* =========================================
   5. JOURNAL & HISTORY & MILESTONES
   ========================================= */

function renderJournal() {
    const container = document.getElementById('journal-feed');
    container.innerHTML = '';
    const sorted = [...appState.journal].sort((a,b) => new Date(b.date) - new Date(a.date));
    sorted.forEach(entry => {
        const div = document.createElement('div');
        div.className = 'journal-entry';
        const dateParts = entry.date.split('-'); 
        const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0].slice(-2)}` : entry.date;
        const copyText = `Todays Recap: (${formattedDate}) [${entry.time}]\n${entry.recap}\n\nTomorrows plans:\n${entry.plan}`;
        const encodedText = encodeURIComponent(copyText);
        div.innerHTML = `
            <div class="j-meta"><span>${formattedDate} [${entry.time}]</span><div><button class="btn-black-small" style="margin-right:10px" onclick="window.copyToClipboard(this, '${encodedText}')"><i class="fa-solid fa-copy"></i> Copy</button><button class="j-edit-btn" onclick="window.openJournalModal('${entry.id}')">Edit</button></div></div>
            <div class="j-block"><h4>Recap</h4><div class="j-text">${entry.recap}</div></div>
            <div class="j-block"><h4>Tomorrow's Plan</h4><div class="j-text">${entry.plan}</div></div>
            ${entry.notes ? `<div class="j-block"><h4>Notes</h4><div class="j-text" style="font-style:italic">${entry.notes}</div></div>` : ''}
        `;
        container.appendChild(div);
    });
}

window.copyToClipboard = function(btn, textEncoded) {
    const text = decodeURIComponent(textEncoded);
    navigator.clipboard.writeText(text).then(() => {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => btn.innerHTML = originalHtml, 2000);
    });
};

window.renderHistory = function() {
    const tbody = document.getElementById('history-table-body');
    tbody.innerHTML = '';
    const filter = document.getElementById('history-filter').value;
    let doneTasks = appState.tasks.filter(t => t.status === 'Done');
    const totalCompleted = doneTasks.length;
    const catCounts = {};
    doneTasks.forEach(t => { const c = t.category || 'Uncategorized'; catCounts[c] = (catCounts[c] || 0) + 1; });
    const topCat = Object.keys(catCounts).length > 0 ? Object.keys(catCounts).reduce((a, b) => catCounts[a] > catCounts[b] ? a : b) : '-';
    document.getElementById('dash-total').innerText = totalCompleted;
    document.getElementById('dash-cat').innerText = topCat;
    if (filter === 'last-week') { const d = new Date(); d.setDate(d.getDate() - 7); doneTasks = doneTasks.filter(t => t.completedDate >= d.toISOString().split('T')[0]); }
    else if (filter === 'last-month') { const d = new Date(); d.setDate(d.getDate() - 30); doneTasks = doneTasks.filter(t => t.completedDate >= d.toISOString().split('T')[0]); }
    doneTasks.sort((a,b) => new Date(b.completedDate) - new Date(a.completedDate));
    doneTasks.forEach(task => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${task.title}</strong></td><td>${task.category || '-'}</td><td>${task.completedDate || 'Unknown'}</td><td><span style="color:var(--text-muted); font-size:0.8rem;"><i class="fa-solid fa-rotate-left"></i> Click to Restore</span></td>`;
        tr.onclick = () => { if(confirm(`Move "${task.title}" back to In Progress?`)) { task.status = 'In Progress'; task.completedDate = null; window.saveData(); renderTasks(); renderHistory(); } };
        tbody.appendChild(tr);
    });
};

let currentMilestoneView = 'kanban';
window.switchMilestoneView = function(viewName) {
    currentMilestoneView = viewName;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    const index = viewName === 'kanban' ? 0 : viewName === 'list' ? 1 : 2;
    document.querySelectorAll('.view-btn')[index].classList.add('active');
    document.querySelectorAll('.ms-view-container').forEach(c => c.classList.remove('active'));
    document.getElementById(`ms-${viewName}`).classList.add('active');
    renderMilestones();
};
function renderMilestones() { if (currentMilestoneView === 'kanban') renderMSKanban(); else if (currentMilestoneView === 'list') renderMSList(); else renderMSCalendar(); }
function renderMSKanban() {
    const cols = { 'Planned': [], 'In Progress': [], 'Mastered': [] };
    appState.milestones.forEach(m => { if(cols[m.status]) cols[m.status].push(m); });
    ['Planned', 'In Progress', 'Mastered'].forEach(status => {
        const colId = `ms-col-${status === 'Planned' ? 'todo' : status === 'In Progress' ? 'progress' : 'done'}`;
        const container = document.getElementById(colId);
        const header = container.querySelector('h4');
        container.innerHTML = '';
        container.appendChild(header);
        cols[status].forEach(m => {
            const card = document.createElement('div'); card.className = 'kanban-card';
            card.innerHTML = `<div class="k-title">${m.title}</div><div class="k-date">${m.targetDate}</div><div style="font-size:0.7rem; margin-top:5px;">Progress: ${m.progress}%</div><div style="height:4px; background:#eee; margin-top:2px;"><div style="width:${m.progress}%; height:100%; background:var(--accent);"></div></div>`;
            card.onclick = () => window.openMilestoneModal(m.id); container.appendChild(card);
        });
    });
}
function renderMSList() {
    const tbody = document.getElementById('ms-table-body');
    tbody.innerHTML = appState.milestones.map(m => `<tr onclick="window.openMilestoneModal('${m.id}')"><td>${m.title}</td><td>${m.targetDate}</td><td>${m.progress}%</td><td>${m.status}</td></tr>`).join('');
}
function renderMSCalendar() {
    const grid = document.getElementById('calendar-grid'); grid.innerHTML = '';
    const now = new Date(); const month = now.getMonth(); const year = now.getFullYear();
    document.getElementById('cal-month-name').innerText = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
    for(let i=0; i<firstDay; i++) grid.appendChild(document.createElement('div'));
    for(let i=1; i<=daysInMonth; i++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const div = document.createElement('div'); div.className = 'cal-day'; if(i === now.getDate()) div.classList.add('today'); div.innerHTML = `<span>${i}</span>`;
        appState.milestones.filter(m => m.targetDate === dateStr).forEach(m => { const item = document.createElement('div'); item.className = 'cal-item'; item.innerText = m.title; item.onclick = (e) => { e.stopPropagation(); window.openMilestoneModal(m.id); }; div.appendChild(item); });
        grid.appendChild(div);
    }
}

/* =========================================
   6. MODALS & SUBMITS
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
        document.getElementById('t-notes').value = t.notes || '';
        populateCatDropdown(t.category);
        document.getElementById('btn-delete-task').classList.remove('delete-btn-hidden');
    } else {
        document.getElementById('task-id').value = '';
        document.getElementById('t-date').value = getLocalISODate();
        document.getElementById('btn-delete-task').classList.add('delete-btn-hidden');
    }
    modal.style.display = 'flex';
};

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
        document.getElementById('j-date').value = getLocalISODate();
    }
    modal.style.display = 'flex';
};

window.openNoteModal = function(id = null) {
    const modal = document.getElementById('note-modal');
    const form = document.getElementById('note-form');
    form.reset();
    if(id) {
        const n = appState.notes.find(x => x.id === id);
        document.getElementById('n-id').value = n.id;
        document.getElementById('n-date').value = n.date;
        document.getElementById('n-content').value = n.content;
        document.getElementById('n-pinned').checked = n.isPinned;
        document.getElementById('btn-delete-note').classList.remove('delete-btn-hidden');
    } else {
        document.getElementById('n-id').value = '';
        document.getElementById('n-date').value = getLocalISODate();
        document.getElementById('btn-delete-note').classList.add('delete-btn-hidden');
    }
    modal.style.display = 'flex';
};

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
};

window.closeModal = function(id) { document.getElementById(id).style.display = 'none'; };

// Submits
document.getElementById('task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const status = document.getElementById('t-status').value;
    const task = {
        id: id || generateUUID(),
        title: document.getElementById('t-title').value,
        dueDate: document.getElementById('t-date').value,
        priority: document.getElementById('t-priority').value,
        category: document.getElementById('t-category').value,
        status: status,
        notes: document.getElementById('t-notes').value,
        completedDate: status === 'Done' ? getLocalISODate() : null
    };
    if(id) {
        const idx = appState.tasks.findIndex(t => t.id === id);
        if (appState.tasks[idx].status === 'Done' && status === 'Done') task.completedDate = appState.tasks[idx].completedDate; 
        appState.tasks[idx] = task;
    } else appState.tasks.push(task);
    window.saveData(); renderAll(); window.closeModal('task-modal');
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
    if(id) { const idx = appState.journal.findIndex(j => j.id === id); appState.journal[idx] = entry; } 
    else appState.journal.push(entry);
    window.saveData(); renderJournal(); window.closeModal('journal-modal');
});

document.getElementById('note-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('n-id').value;
    const note = {
        id: id || generateUUID(),
        date: document.getElementById('n-date').value,
        content: document.getElementById('n-content').value,
        isPinned: document.getElementById('n-pinned').checked
    };
    if(id) { const idx = appState.notes.findIndex(n => n.id === id); appState.notes[idx] = note; } 
    else appState.notes.push(note);
    window.saveData(); renderNotes(); window.closeModal('note-modal');
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
    if(id) { const idx = appState.milestones.findIndex(m => m.id === id); appState.milestones[idx] = ms; } 
    else appState.milestones.push(ms);
    window.saveData(); renderMilestones(); window.closeModal('milestone-modal');
});

// Deletes
window.deleteCurrentTask = function() { if(confirm('Delete?')) { appState.tasks = appState.tasks.filter(t => t.id !== document.getElementById('task-id').value); window.saveData(); renderAll(); window.closeModal('task-modal'); } };
window.deleteCurrentNote = function() { if(confirm('Delete?')) { appState.notes = appState.notes.filter(n => n.id !== document.getElementById('n-id').value); window.saveData(); renderNotes(); window.closeModal('note-modal'); } };
window.deleteCurrentMS = function() { if(confirm('Delete?')) { appState.milestones = appState.milestones.filter(m => m.id !== document.getElementById('m-id').value); window.saveData(); renderMilestones(); window.closeModal('milestone-modal'); } };

function updateDateDisplay() { document.getElementById('current-date-display').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }
function applyTheme(theme) { if (theme === 'dark') document.body.classList.add('dark-mode'); else document.body.classList.remove('dark-mode'); }
document.getElementById('theme-toggle').addEventListener('click', () => { appState.theme = appState.theme === 'light' ? 'dark' : 'light'; applyTheme(appState.theme); window.saveData(); });
document.getElementById('refresh-btn').addEventListener('click', () => { window.loadData(); alert('Synced.'); });
document.getElementById('export-btn').addEventListener('click', window.exportData);

window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.addEventListener('click', () => {
            document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
            li.classList.add('active');
            document.getElementById(li.dataset.tab).classList.add('active-view');
            if(li.dataset.tab === 'history-view') window.renderHistory();
        });
    });
    window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.style.display = 'none'; };
    window.loadData();
});
