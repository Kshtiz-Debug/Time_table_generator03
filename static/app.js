/**
 * ═══════════════════════════════════════════════════════════════
 * TimetableAI — Interactive College Timetable Generator
 * Frontend Application Logic
 * ═══════════════════════════════════════════════════════════════
 */

// ─── State ───────────────────────────────────────────────────
const state = {
    currentStep: 0,
    scheduleMode: 'class',
    sectionsPerCluster: 2,
    departments: [{ name: '', sections: 1 }],
    numDays: 5,
    numSlots: 6,
    subjects: [{ name: '', hours: 3 }],
    teachers: [{ name: '', id: '', subjects: [], cluster: 1 }],
    rooms: [{ name: '', type: 'Classroom' }],
    constraints: {
        avoidTeacherClash: true,
        avoidRoomClash: true,
        fixedLunch: true,
        labConsecutive: false,
    },
    results: null,
};

const STEPS = [
    { label: 'Setup', icon: '⚙️' },
    { label: 'Subjects', icon: '📚' },
    { label: 'Teachers', icon: '👩‍🏫' },
    { label: 'Rooms', icon: '🏛️' },
    { label: 'Constraints', icon: '🔒' },
    { label: 'Generate', icon: '🚀' },
];

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ─── Initialize ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderStepper();
    renderStep();
});

// ─── Stepper ─────────────────────────────────────────────────
function renderStepper() {
    const stepper = document.getElementById('stepper');
    stepper.innerHTML = '';

    STEPS.forEach((step, i) => {
        const item = document.createElement('div');
        item.className = 'step-item';
        if (i === state.currentStep) item.classList.add('active');
        if (i < state.currentStep) item.classList.add('completed');
        item.onclick = () => {
            if (i < state.currentStep) {
                state.currentStep = i;
                renderStepper();
                renderStep();
            }
        };

        item.innerHTML = `
            <div class="step-circle">
                <span class="step-number">${i + 1}</span>
            </div>
            <span class="step-label">${step.label}</span>
        `;
        stepper.appendChild(item);

        if (i < STEPS.length - 1) {
            const connector = document.createElement('div');
            connector.className = 'step-connector' + (i < state.currentStep ? ' completed' : '');
            stepper.appendChild(connector);
        }
    });
}

// ─── Step Router ─────────────────────────────────────────────
function renderStep() {
    const card = document.getElementById('wizardCard');
    card.style.animation = 'none';
    card.offsetHeight; // trigger reflow
    card.style.animation = 'fadeIn 0.4s ease-out';

    switch (state.currentStep) {
        case 0: renderStep1(card); break;
        case 1: renderStep2(card); break;
        case 2: renderStep3(card); break;
        case 3: renderStep4(card); break;
        case 4: renderStep5(card); break;
        case 5: renderStep6(card); break;
    }
}

// ─── Step 1: Basic Setup ─────────────────────────────────────
function renderStep1(card) {
    card.innerHTML = `
        <div class="step-header">
            <span class="step-badge">⚙️ Step 1 of 6</span>
            <h2>Basic Setup</h2>
            <p>Configure the foundational structure of your institution's timetable.</p>
        </div>

        <div class="form-grid">
            <div class="form-group">
                <label>Number of Working Days <span class="required">*</span></label>
                <input type="number" class="form-input" id="numDays" min="1" max="7"
                    value="${state.numDays}" placeholder="e.g. 5">
            </div>
            <div class="form-group">
                <label>Time Slots per Day <span class="required">*</span></label>
                <input type="number" class="form-input" id="numSlots" min="1" max="12"
                    value="${state.numSlots}" placeholder="e.g. 6">
            </div>
        </div>

        <div class="form-group" style="margin-top: 12px; margin-bottom: 24px;">
            <label style="color: var(--text-primary); font-size: 1.05rem; display: block; margin-bottom: 10px;">Schedule Mode <span class="required">*</span></label>
            <div style="display: flex; gap: 20px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-primary);">
                    <input type="radio" name="scheduleMode" value="class" ${state.scheduleMode === 'class' ? 'checked' : ''} style="accent-color: var(--accent-primary); width: 18px; height: 18px;">
                    Class-wise (Default)
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-primary);">
                    <input type="radio" name="scheduleMode" value="cluster" ${state.scheduleMode === 'cluster' ? 'checked' : ''} style="accent-color: var(--accent-primary); width: 18px; height: 18px;">
                    Cluster-wise
                </label>
            </div>
        </div>

        ${state.scheduleMode === 'cluster' ? `
        <div class="form-grid" style="animation: fadeIn 0.3s ease-out;">
            <div class="form-group">
                <label>Sections per Cluster <span class="required">*</span></label>
                <input type="number" class="form-input" id="sectionsPerCluster" min="1" max="20"
                    value="${state.sectionsPerCluster}" placeholder="e.g. 5">
                <small style="color: var(--text-muted); margin-top: 4px;">Sections will be grouped in sizes of this number.</small>
            </div>
        </div>
        ` : ''}

        <div class="step-header" style="margin-top: 32px; margin-bottom: 16px;">
            <h2 style="font-size: 1.2rem;">Departments & Sections</h2>
            <p>Add each department and the number of sections it has.</p>
        </div>

        <div class="entries-container" id="deptEntries">
            ${state.departments.map((dept, i) => renderDeptEntry(dept, i)).join('')}
        </div>
        <button class="add-entry-btn" onclick="addDepartment()">
            <span>＋</span> Add Department
        </button>

        ${renderWizardActions(false, true)}
    `;

    bindStep1Events();
}

function renderDeptEntry(dept, index) {
    return `
        <div class="entry-card dept-entry" data-index="${index}">
            <span class="entry-number">DEPT ${index + 1}</span>
            ${state.departments.length > 1 ? `<button class="remove-entry" onclick="removeDepartment(${index})">×</button>` : ''}
            <div class="entry-fields">
                <div class="form-group">
                    <label>Department Name</label>
                    <input type="text" class="form-input dept-name" data-index="${index}"
                        value="${dept.name}" placeholder="e.g. Computer Science">
                </div>
                <div class="form-group">
                    <label>Sections</label>
                    <input type="number" class="form-input dept-sections" data-index="${index}"
                        min="1" max="10" value="${dept.sections}" placeholder="e.g. 2">
                </div>
            </div>
        </div>
    `;
}

function bindStep1Events() {
    document.getElementById('numDays').addEventListener('change', (e) => {
        state.numDays = parseInt(e.target.value) || 5;
    });
    document.getElementById('numSlots').addEventListener('change', (e) => {
        state.numSlots = parseInt(e.target.value) || 6;
    });
    document.querySelectorAll('input[name="scheduleMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.scheduleMode = e.target.value;
            renderStep1(document.getElementById('wizardCard'));
        });
    });
    const spcInput = document.getElementById('sectionsPerCluster');
    if (spcInput) {
        spcInput.addEventListener('change', (e) => {
            state.sectionsPerCluster = parseInt(e.target.value) || 2;
        });
    }
    document.querySelectorAll('.dept-name').forEach(el => {
        el.addEventListener('input', (e) => {
            state.departments[e.target.dataset.index].name = e.target.value;
        });
    });
    document.querySelectorAll('.dept-sections').forEach(el => {
        el.addEventListener('change', (e) => {
            state.departments[e.target.dataset.index].sections = parseInt(e.target.value) || 1;
        });
    });
}

function addDepartment() {
    state.departments.push({ name: '', sections: 1 });
    renderStep1(document.getElementById('wizardCard'));
}

function removeDepartment(index) {
    state.departments.splice(index, 1);
    renderStep1(document.getElementById('wizardCard'));
}

// ─── Step 2: Subjects ────────────────────────────────────────
function renderStep2(card) {
    card.innerHTML = `
        <div class="step-header">
            <span class="step-badge">📚 Step 2 of 6</span>
            <h2>Subjects</h2>
            <p>Define the subjects offered and their weekly hours.</p>
        </div>

        <div class="entries-container" id="subjectEntries">
            ${state.subjects.map((subj, i) => renderSubjectEntry(subj, i)).join('')}
        </div>
        <button class="add-entry-btn" onclick="addSubject()">
            <span>＋</span> Add Subject
        </button>

        ${renderWizardActions(true, true)}
    `;

    bindStep2Events();
}

function renderSubjectEntry(subj, index) {
    return `
        <div class="entry-card" data-index="${index}">
            <span class="entry-number">SUBJECT ${index + 1}</span>
            ${state.subjects.length > 1 ? `<button class="remove-entry" onclick="removeSubject(${index})">×</button>` : ''}
            <div class="entry-fields">
                <div class="form-group">
                    <label>Subject Name</label>
                    <input type="text" class="form-input subj-name" data-index="${index}"
                        value="${subj.name}" placeholder="e.g. Data Structures">
                </div>
                <div class="form-group">
                    <label>Hours per Week</label>
                    <input type="number" class="form-input subj-hours" data-index="${index}"
                        min="1" max="20" value="${subj.hours}" placeholder="e.g. 3">
                </div>
            </div>
        </div>
    `;
}

function bindStep2Events() {
    document.querySelectorAll('.subj-name').forEach(el => {
        el.addEventListener('input', (e) => {
            state.subjects[e.target.dataset.index].name = e.target.value;
        });
    });
    document.querySelectorAll('.subj-hours').forEach(el => {
        el.addEventListener('change', (e) => {
            state.subjects[e.target.dataset.index].hours = parseInt(e.target.value) || 1;
        });
    });
}

function addSubject() {
    state.subjects.push({ name: '', hours: 3 });
    renderStep2(document.getElementById('wizardCard'));
}

function removeSubject(index) {
    state.subjects.splice(index, 1);
    // Clean up teacher assignments referencing removed subject
    state.teachers.forEach(t => {
        t.subjects = t.subjects.filter(s => state.subjects.some(subj => subj.name === s));
    });
    renderStep2(document.getElementById('wizardCard'));
}

// ─── Step 3: Teachers ────────────────────────────────────────
function renderStep3(card) {
    const subjectOptions = state.subjects.filter(s => s.name.trim() !== '');

    card.innerHTML = `
        <div class="step-header">
            <span class="step-badge">👩‍🏫 Step 3 of 6</span>
            <h2>Teachers</h2>
            <p>Add teachers and assign the subjects they can teach.</p>
        </div>

        <div class="entries-container" id="teacherEntries">
            ${state.teachers.map((teacher, i) => renderTeacherEntry(teacher, i, subjectOptions)).join('')}
        </div>
        <button class="add-entry-btn" onclick="addTeacher()">
            <span>＋</span> Add Teacher
        </button>

        ${renderWizardActions(true, true)}
    `;

    bindStep3Events();
}

function renderTeacherEntry(teacher, index, subjectOptions) {
    const selectedTags = teacher.subjects.map(s =>
        `<span class="selected-tag">${s} <span class="remove-tag" data-teacher="${index}" data-subject="${s}">×</span></span>`
    ).join('');

    let computedNumClusters = 1;
    if (state.scheduleMode === 'cluster') {
        const totalSections = state.departments.reduce((sum, d) => sum + (parseInt(d.sections) || 1), 0);
        computedNumClusters = Math.ceil(totalSections / state.sectionsPerCluster) || 1;
    }

    const clusterDropdown = state.scheduleMode === 'cluster' ? `
        <div class="form-group">
            <label>Assigned Cluster</label>
            <select class="form-select teacher-cluster" data-index="${index}">
                ${Array.from({length: computedNumClusters}, (_, i) => i + 1).map(c => 
                    `<option value="${c}" ${teacher.cluster === c ? 'selected' : ''}>Cluster ${c}</option>`
                ).join('')}
            </select>
        </div>
    ` : '';

    return `
        <div class="entry-card" data-index="${index}">
            <span class="entry-number">TEACHER ${index + 1}</span>
            ${state.teachers.length > 1 ? `<button class="remove-entry" onclick="removeTeacher(${index})">×</button>` : ''}
            <div class="entry-fields">
                <div class="form-group">
                    <label>Teacher ID</label>
                    <input type="text" class="form-input teacher-id" data-index="${index}"
                        value="${teacher.id || ''}" placeholder="e.g. T-101">
                </div>
                <div class="form-group">
                    <label>Teacher Name</label>
                    <input type="text" class="form-input teacher-name" data-index="${index}"
                        value="${teacher.name}" placeholder="e.g. Dr. Smith">
                </div>
                ${clusterDropdown}
                <div class="form-group">
                    <label>Subjects</label>
                    <div class="multi-select-container" id="multiSelect-${index}">
                        <div class="multi-select-trigger" onclick="toggleMultiSelect(${index})">
                            ${selectedTags || '<span style="color: var(--text-muted)">Select subjects...</span>'}
                        </div>
                        <div class="multi-select-dropdown" id="dropdown-${index}">
                            ${subjectOptions.map(s => `
                                <div class="multi-select-option ${teacher.subjects.includes(s.name) ? 'selected' : ''}"
                                    onclick="toggleSubjectForTeacher(${index}, '${s.name.replace(/'/g, "\\'")}')">
                                    <span class="check-icon">${teacher.subjects.includes(s.name) ? '✓' : ''}</span>
                                    ${s.name}
                                </div>
                            `).join('')}
                            ${subjectOptions.length === 0 ? '<div style="padding: 12px; color: var(--text-muted); font-size: 0.85rem;">No subjects added yet. Go back to Step 2.</div>' : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function bindStep3Events() {
    document.querySelectorAll('.teacher-id').forEach(el => {
        el.addEventListener('input', (e) => {
            state.teachers[e.target.dataset.index].id = e.target.value;
        });
    });
    document.querySelectorAll('.teacher-name').forEach(el => {
        el.addEventListener('input', (e) => {
            state.teachers[e.target.dataset.index].name = e.target.value;
        });
    });
    document.querySelectorAll('.teacher-cluster').forEach(el => {
        el.addEventListener('change', (e) => {
            state.teachers[e.target.dataset.index].cluster = parseInt(e.target.value) || 1;
        });
    });
    document.querySelectorAll('.remove-tag').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const ti = parseInt(e.target.dataset.teacher);
            const subj = e.target.dataset.subject;
            state.teachers[ti].subjects = state.teachers[ti].subjects.filter(s => s !== subj);
            renderStep3(document.getElementById('wizardCard'));
        });
    });

    // Close dropdowns on outside click
    document.addEventListener('click', closeAllDropdowns);
}

function toggleMultiSelect(index) {
    event.stopPropagation();
    const dropdown = document.getElementById(`dropdown-${index}`);
    const trigger = dropdown.previousElementSibling;
    const isOpen = dropdown.classList.contains('open');
    closeAllDropdowns();
    if (!isOpen) {
        dropdown.classList.add('open');
        trigger.classList.add('open');
    }
}

function closeAllDropdowns() {
    document.querySelectorAll('.multi-select-dropdown').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('.multi-select-trigger').forEach(t => t.classList.remove('open'));
}

function toggleSubjectForTeacher(teacherIndex, subjectName) {
    event.stopPropagation();
    const teacher = state.teachers[teacherIndex];
    if (teacher.subjects.includes(subjectName)) {
        teacher.subjects = teacher.subjects.filter(s => s !== subjectName);
    } else {
        teacher.subjects.push(subjectName);
    }
    renderStep3(document.getElementById('wizardCard'));
    // Keep dropdown open
    setTimeout(() => {
        const dropdown = document.getElementById(`dropdown-${teacherIndex}`);
        const trigger = dropdown.previousElementSibling;
        dropdown.classList.add('open');
        trigger.classList.add('open');
    }, 0);
}

function addTeacher() {
    state.teachers.push({ name: '', id: '', subjects: [], cluster: 1 });
    renderStep3(document.getElementById('wizardCard'));
}

function removeTeacher(index) {
    state.teachers.splice(index, 1);
    renderStep3(document.getElementById('wizardCard'));
}

// ─── Step 4: Rooms ───────────────────────────────────────────
function renderStep4(card) {
    card.innerHTML = `
        <div class="step-header">
            <span class="step-badge">🏛️ Step 4 of 6</span>
            <h2>Rooms</h2>
            <p>Define available rooms and their types.</p>
        </div>

        <div class="entries-container" id="roomEntries">
            ${state.rooms.map((room, i) => renderRoomEntry(room, i)).join('')}
        </div>
        <button class="add-entry-btn" onclick="addRoom()">
            <span>＋</span> Add Room
        </button>

        ${renderWizardActions(true, true)}
    `;

    bindStep4Events();
}

function renderRoomEntry(room, index) {
    return `
        <div class="entry-card" data-index="${index}">
            <span class="entry-number">ROOM ${index + 1}</span>
            ${state.rooms.length > 1 ? `<button class="remove-entry" onclick="removeRoom(${index})">×</button>` : ''}
            <div class="entry-fields">
                <div class="form-group">
                    <label>Room Name / Number</label>
                    <input type="text" class="form-input room-name" data-index="${index}"
                        value="${room.name}" placeholder="e.g. Room 101">
                </div>
                <div class="form-group">
                    <label>Room Type</label>
                    <select class="form-select room-type" data-index="${index}">
                        <option value="Classroom" ${room.type === 'Classroom' ? 'selected' : ''}>📖 Classroom</option>
                        <option value="Lab" ${room.type === 'Lab' ? 'selected' : ''}>🔬 Lab</option>
                    </select>
                </div>
            </div>
        </div>
    `;
}

function bindStep4Events() {
    document.querySelectorAll('.room-name').forEach(el => {
        el.addEventListener('input', (e) => {
            state.rooms[e.target.dataset.index].name = e.target.value;
        });
    });
    document.querySelectorAll('.room-type').forEach(el => {
        el.addEventListener('change', (e) => {
            state.rooms[e.target.dataset.index].type = e.target.value;
        });
    });
}

function addRoom() {
    state.rooms.push({ name: '', type: 'Classroom' });
    renderStep4(document.getElementById('wizardCard'));
}

function removeRoom(index) {
    state.rooms.splice(index, 1);
    renderStep4(document.getElementById('wizardCard'));
}

// ─── Step 5: Constraints ────────────────────────────────────
function renderStep5(card) {
    const constraints = [
        {
            key: 'avoidTeacherClash',
            title: 'Avoid Teacher Clashes',
            desc: 'Ensure no teacher is assigned to two classes at the same time.',
            icon: '🚫',
        },
        {
            key: 'avoidRoomClash',
            title: 'Avoid Room Clashes',
            desc: 'Ensure no room is double-booked in the same time slot.',
            icon: '🏢',
        },
        {
            key: 'fixedLunch',
            title: 'Fixed Lunch Break',
            desc: 'Reserve a dedicated mid-day slot for a lunch break across all sections.',
            icon: '🍽️',
        },
        {
            key: 'labConsecutive',
            title: 'Lab: Consecutive Slots',
            desc: 'Lab sessions require two consecutive time slots.',
            icon: '🔬',
        },
    ];

    card.innerHTML = `
        <div class="step-header">
            <span class="step-badge">🔒 Step 5 of 6</span>
            <h2>Constraints</h2>
            <p>Select scheduling constraints the generator should respect.</p>
        </div>

        <div class="constraints-grid">
            ${constraints.map(c => `
                <div class="constraint-card ${state.constraints[c.key] ? 'active' : ''}"
                    onclick="toggleConstraint('${c.key}')">
                    <div class="constraint-checkbox">${state.constraints[c.key] ? '✓' : ''}</div>
                    <div class="constraint-info">
                        <h4>${c.icon} ${c.title}</h4>
                        <p>${c.desc}</p>
                    </div>
                </div>
            `).join('')}
        </div>

        ${renderWizardActions(true, true)}
    `;
}

function toggleConstraint(key) {
    state.constraints[key] = !state.constraints[key];
    renderStep5(document.getElementById('wizardCard'));
}

// ─── Step 6: Generate ────────────────────────────────────────
function renderStep6(card) {
    const totalSections = state.departments.reduce((sum, d) => sum + (d.sections || 1), 0);
    const totalSubjects = state.subjects.filter(s => s.name.trim()).length;
    const totalTeachers = state.teachers.filter(t => t.name.trim()).length;
    const totalRooms = state.rooms.filter(r => r.name.trim()).length;

    card.innerHTML = `
        <div class="generate-step-content">
            <span class="generate-icon">🚀</span>
            <h3>Ready to Generate!</h3>
            <p>Review your configuration summary below, then hit generate to create your optimized timetable.</p>

            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-label">Departments</div>
                    <div class="summary-value">${state.departments.length}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Sections</div>
                    <div class="summary-value">${totalSections}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Working Days</div>
                    <div class="summary-value">${state.numDays}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Slots / Day</div>
                    <div class="summary-value">${state.numSlots}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Subjects</div>
                    <div class="summary-value">${totalSubjects}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Teachers</div>
                    <div class="summary-value">${totalTeachers}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Rooms</div>
                    <div class="summary-value">${totalRooms}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Constraints</div>
                    <div class="summary-value">${Object.values(state.constraints).filter(Boolean).length}</div>
                </div>
            </div>

            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                <button class="btn btn-secondary" onclick="openSaveModal()">💾 Save Config</button>
                <button class="btn btn-primary btn-generate" onclick="generateTimetable()">
                    ⚡ Generate Timetable
                </button>
            </div>
        </div>

        ${renderWizardActions(true, false)}
    `;
}

// ─── Wizard Navigation Actions ───────────────────────────────
function renderWizardActions(showBack, showNext) {
    return `
        <div class="wizard-actions">
            ${showBack
                ? `<button class="btn btn-secondary" onclick="goBack()">← Back</button>`
                : '<div></div>'}
            ${showNext
                ? `<button class="btn btn-primary" onclick="goNext()">Next →</button>`
                : '<div></div>'}
        </div>
    `;
}

function goNext() {
    // Validation
    if (state.currentStep === 0) {
        if (state.departments.some(d => !d.name.trim())) {
            showToast('Please fill in all department names.', 'error');
            return;
        }
    }
    if (state.currentStep === 1) {
        if (state.subjects.some(s => !s.name.trim())) {
            showToast('Please fill in all subject names.', 'error');
            return;
        }
    }
    if (state.currentStep === 2) {
        if (state.teachers.some(t => !t.name.trim())) {
            showToast('Please fill in all teacher names.', 'error');
            return;
        }
    }
    if (state.currentStep === 3) {
        if (state.rooms.some(r => !r.name.trim())) {
            showToast('Please fill in all room names.', 'error');
            return;
        }
    }

    if (state.currentStep < STEPS.length - 1) {
        state.currentStep++;
        renderStepper();
        renderStep();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function goBack() {
    if (state.currentStep > 0) {
        state.currentStep--;
        renderStepper();
        renderStep();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// ─── Generate Timetable ──────────────────────────────────────
async function generateTimetable() {
    const payload = {
        scheduleMode: state.scheduleMode,
        sectionsPerCluster: state.sectionsPerCluster,
        departments: state.departments.filter(d => d.name.trim()),
        numDays: state.numDays,
        numSlots: state.numSlots,
        subjects: state.subjects.filter(s => s.name.trim()),
        teachers: state.teachers.filter(t => t.name.trim() || t.id.trim()),
        rooms: state.rooms.filter(r => r.name.trim()),
        constraints: state.constraints,
    };

    // Show loading
    document.getElementById('loadingOverlay').classList.add('active');

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok || result.error) {
            throw new Error(result.error || 'Failed to generate timetable');
        }

        state.results = result;
        showResults(result);
        showToast('Timetable generated successfully!', 'success');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

// ─── Display Results ─────────────────────────────────────────
function showResults(result) {
    // Hide wizard, show results
    document.getElementById('wizardCard').classList.add('hidden');
    document.getElementById('stepperContainer').classList.add('hidden');

    const resultsSection = document.getElementById('resultsSection');
    resultsSection.classList.add('active');

    const config = result.config;
    const sectionTimetables = result.data.sectionTimetables;
    const teacherTimetables = result.data.teacherTimetables;

    resultsSection.innerHTML = `
        <div class="results-header">
            <h2>📊 Generated Timetable</h2>
            <div class="results-actions">
                <div class="view-toggle">
                    <button id="viewSections" class="active" onclick="switchView('sections')">📋 Section-wise</button>
                    <button id="viewTeachers" onclick="switchView('teachers')">👩‍🏫 Teacher-wise</button>
                </div>
                <button class="btn btn-outline btn-small" onclick="exportPDF()">📄 Export PDF</button>
                <button class="btn btn-secondary btn-small" onclick="goBackToWizard()">← Edit Inputs</button>
            </div>
        </div>

        <div id="sectionTimetablesView">
            ${renderSectionTimetables(sectionTimetables, config)}
        </div>

        <div id="teacherTimetablesView" class="hidden">
            ${renderTeacherTimetables(teacherTimetables, config)}
        </div>
    `;
}

function renderSectionTimetables(timetables, config) {
    let html = '';
    for (const [sectionId, grid] of Object.entries(timetables)) {
        html += `
            <div class="timetable-section">
                <div class="timetable-title">
                    <span class="section-badge">📋</span>
                    <h3>${sectionId}</h3>
                </div>
                ${renderTimetableTable(grid, config)}
            </div>
        `;
    }
    return html;
}

function renderTeacherTimetables(timetables, config) {
    let html = '';
    if (!timetables || Object.keys(timetables).length === 0) {
        return '<p style="color: var(--text-muted); text-align: center; padding: 40px;">No teacher timetables available.</p>';
    }
    for (const [teacherName, grid] of Object.entries(timetables)) {
        html += `
            <div class="timetable-section">
                <div class="timetable-title">
                    <span class="section-badge">👩‍🏫</span>
                    <h3>${teacherName}</h3>
                </div>
                ${renderTimetableTable(grid, config, true)}
            </div>
        `;
    }
    return html;
}

function renderTimetableTable(grid, config, isTeacher = false) {
    const numDays = config.numDays;
    const numSlots = config.numSlots;

    let headerHtml = '<tr><th>Day \\ Slot</th>';
    for (let s = 0; s < numSlots; s++) {
        headerHtml += `<th>Slot ${s + 1}</th>`;
    }
    headerHtml += '</tr>';

    let bodyHtml = '';
    for (let d = 0; d < numDays; d++) {
        const dayName = DAY_NAMES[d] || `Day ${d + 1}`;
        bodyHtml += `<tr><td>${dayName}</td>`;
        for (let s = 0; s < numSlots; s++) {
            const cell = grid[d] && grid[d][s];
            if (!cell || cell.isFree) {
                bodyHtml += `<td><span class="cell-free">Free</span></td>`;
            } else if (cell.isLunch) {
                bodyHtml += `<td class="cell-lunch">🍽️ LUNCH</td>`;
            } else {
                const labClass = cell.isLab ? 'cell-lab' : '';
                if (isTeacher) {
                    bodyHtml += `
                        <td class="${labClass}">
                            <div class="cell-subject">${cell.subject}</div>
                            <div class="cell-teacher">${cell.section || ''}</div>
                            <div class="cell-room">${cell.room || ''}</div>
                        </td>
                    `;
                } else {
                    bodyHtml += `
                        <td class="${labClass}">
                            <div class="cell-subject">${cell.subject}</div>
                            <div class="cell-teacher">${cell.teacher || ''}</div>
                            <div class="cell-room">${cell.room || ''}</div>
                        </td>
                    `;
                }
            }
        }
        bodyHtml += '</tr>';
    }

    return `
        <div class="timetable-wrapper">
            <table class="timetable">
                <thead>${headerHtml}</thead>
                <tbody>${bodyHtml}</tbody>
            </table>
        </div>
    `;
}

function switchView(view) {
    const sectionsView = document.getElementById('sectionTimetablesView');
    const teachersView = document.getElementById('teacherTimetablesView');
    const btnSections = document.getElementById('viewSections');
    const btnTeachers = document.getElementById('viewTeachers');

    if (view === 'sections') {
        sectionsView.classList.remove('hidden');
        teachersView.classList.add('hidden');
        btnSections.classList.add('active');
        btnTeachers.classList.remove('active');
    } else {
        sectionsView.classList.add('hidden');
        teachersView.classList.remove('hidden');
        btnSections.classList.remove('active');
        btnTeachers.classList.add('active');
    }
}

function goBackToWizard() {
    document.getElementById('wizardCard').classList.remove('hidden');
    document.getElementById('stepperContainer').classList.remove('hidden');
    document.getElementById('resultsSection').classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Export PDF ──────────────────────────────────────────────
function exportPDF() {
    showToast('Preparing PDF export...', 'info');
    setTimeout(() => {
        window.print();
    }, 500);
}

// ─── Save / Load Config ──────────────────────────────────────
function openSaveModal() {
    document.getElementById('saveModal').classList.add('active');
    document.getElementById('configNameInput').focus();
}

function closeSaveModal() {
    document.getElementById('saveModal').classList.remove('active');
}

async function saveConfiguration() {
    const name = document.getElementById('configNameInput').value.trim();
    if (!name) {
        showToast('Please enter a configuration name.', 'error');
        return;
    }

    const payload = {
        name: name,
        scheduleMode: state.scheduleMode,
        sectionsPerCluster: state.sectionsPerCluster,
        departments: state.departments,
        numDays: state.numDays,
        numSlots: state.numSlots,
        subjects: state.subjects,
        teachers: state.teachers,
        rooms: state.rooms,
        constraints: state.constraints,
    };

    try {
        const response = await fetch('/api/save-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (result.success) {
            showToast('Configuration saved successfully!', 'success');
            closeSaveModal();
        } else {
            throw new Error(result.error || 'Failed to save');
        }
    } catch (error) {
        showToast('Error saving: ' + error.message, 'error');
    }
}

// ─── Toast Notifications ─────────────────────────────────────
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${message}`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
