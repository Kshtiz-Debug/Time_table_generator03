const state = {
    currentStep: 0,
    scheduleMode: 'class',
    sectionsPerCluster: 2,
    departments: [{ name: '', sections: 1 }],
    numDays: 5,
    numSlots: 6,
    subjects: [{ name: '', type: 'THEORY', hours: 3, lab_duration: 2 }],
    labs: [{ lab_id: 'LAB-1', lab_name: '', room_number: '' }],
    activeLabSection: '',
    labBlocks: [],
    labAssignments: [],
    teachers: [{ id: '', name: '', cluster: 1, max_consecutive_classes: 2, availabilityText: '' }],
    // Maps per section+subject -> teacherId (cluster isolation is enforced by teacher.cluster)
    sectionSubjectTeacherMap: {},
    draggingLabBlockId: '',
    classrooms: {},
    constraints: {
        enforceFirstPeriod: true,
        maxConsecutiveClasses: 2,
    },
    retrySeed: null,
    lastGenerationError: '',
    results: null,
};

const STEPS = [
    { label: 'Setup', icon: '⚙️' },
    { label: 'Subjects', icon: '📚' },
    { label: 'Lab Rooms', icon: '🧪' },
    { label: 'Lab Grid', icon: '🧩' },
    { label: 'Professor Map', icon: '👩‍🏫' },
    { label: 'Classrooms', icon: '🏫' },
    { label: 'Generate', icon: '🚀' },
];

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getNumClusters() {
    if (state.scheduleMode !== 'cluster') return 1;
    const totalSections = getSections().length;
    return Math.max(1, Math.ceil(totalSections / Math.max(1, state.sectionsPerCluster)));
}

function getClusterForSection(section) {
    if (state.scheduleMode !== 'cluster') return 1;
    const sections = getSections();
    const idx = sections.indexOf(section);
    if (idx < 0) return 1;
    return Math.floor(idx / Math.max(1, state.sectionsPerCluster)) + 1;
}

function getTeacherIdForSectionSubject(section, subject) {
    const key = `${section}::${subject}`;
    return state.sectionSubjectTeacherMap[key] || '';
}

document.addEventListener('DOMContentLoaded', () => {
    renderStepper();
    renderStep();
});

function renderStepper() {
    const stepper = document.getElementById('stepper');
    stepper.innerHTML = '';
    STEPS.forEach((step, i) => {
        const item = document.createElement('div');
        item.className = `step-item ${i === state.currentStep ? 'active' : ''} ${i < state.currentStep ? 'completed' : ''}`;
        if (i < state.currentStep) {
            item.onclick = () => {
                state.currentStep = i;
                renderStepper();
                renderStep();
            };
        }
        item.innerHTML = `<div class="step-circle"><span class="step-number">${i + 1}</span></div><span class="step-label">${step.label}</span>`;
        stepper.appendChild(item);
        if (i < STEPS.length - 1) {
            const connector = document.createElement('div');
            connector.className = `step-connector ${i < state.currentStep ? 'completed' : ''}`;
            stepper.appendChild(connector);
        }
    });
}

function renderStep() {
    const card = document.getElementById('wizardCard');
    const routes = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7];
    routes[state.currentStep](card);
}

// ─── Step 1: Basic Setup ─────────────────────────────────────
function renderStep1(card) {
    card.innerHTML = `
        <div class="step-header">
            <span class="step-badge">⚙️ Step 1 of 7</span>
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
        resetLabBoard();
    });
    document.getElementById('numSlots').addEventListener('change', (e) => {
        state.numSlots = parseInt(e.target.value) || 6;
        resetLabBoard();
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
            resetLabBoard();
        });
    });
}

function addDepartment() {
    state.departments.push({ name: '', sections: 1 });
    resetLabBoard();
    renderStep1(document.getElementById('wizardCard'));
}

function removeDepartment(index) {
    state.departments.splice(index, 1);
    resetLabBoard();
    renderStep1(document.getElementById('wizardCard'));
}

function renderStep2(card) {
    card.innerHTML = `
        <div class="step-header">
            <span class="step-badge">📚 Step 2 of 7</span>
            <h2>Subjects</h2>
            <p>Add THEORY/LAB subjects. LAB requires consecutive lab duration.</p>
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
                <div class="form-group">
                    <label>Type</label>
                    <select class="form-select subj-type" data-index="${index}">
                        <option value="THEORY" ${subj.type === 'THEORY' ? 'selected' : ''}>THEORY</option>
                        <option value="LAB" ${subj.type === 'LAB' ? 'selected' : ''}>LAB</option>
                    </select>
                </div>
                ${subj.type === 'LAB' ? `
                <div class="form-group">
                    <label>Lab Duration (Consecutive Slots)</label>
                    <input type="number" class="form-input subj-lab-duration" data-index="${index}"
                        min="2" max="${state.numSlots}" value="${subj.lab_duration || 2}">
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

function bindStep2Events() {
    document.querySelectorAll('.subj-name').forEach(el => {
        el.addEventListener('input', (e) => {
            state.subjects[e.target.dataset.index].name = e.target.value;
            resetLabBoard();
        });
    });
    document.querySelectorAll('.subj-hours').forEach(el => {
        el.addEventListener('change', (e) => {
            state.subjects[e.target.dataset.index].hours = parseInt(e.target.value) || 1;
            resetLabBoard();
        });
    });
    document.querySelectorAll('.subj-type').forEach(el => {
        el.addEventListener('change', (e) => {
            const i = parseInt(e.target.dataset.index);
            state.subjects[i].type = e.target.value;
            resetLabBoard();
            renderStep();
        });
    });
    document.querySelectorAll('.subj-lab-duration').forEach(el => {
        el.addEventListener('change', (e) => {
            state.subjects[e.target.dataset.index].lab_duration = parseInt(e.target.value) || 2;
            resetLabBoard();
        });
    });
}

function addSubject() {
    state.subjects.push({ name: '', type: 'THEORY', hours: 3, lab_duration: 2 });
    resetLabBoard();
    renderStep2(document.getElementById('wizardCard'));
}

function removeSubject(index) {
    state.subjects.splice(index, 1);
    resetLabBoard();
    renderStep2(document.getElementById('wizardCard'));
}

function renderStep3(card) {
    card.innerHTML = `
        <div class="step-header">
            <span class="step-badge">🧪 Step 3 of 7</span>
            <h2>Lab Rooms Input</h2>
            <p>Add all lab masters with ID, name and room number.</p>
        </div>

        <div class="entries-container">
            ${state.labs.map((lab, i) => `
                <div class="entry-card">
                    <span class="entry-number">LAB ${i + 1}</span>
                    ${state.labs.length > 1 ? `<button class="remove-entry" onclick="removeLab(${i})">×</button>` : ''}
                    <div class="entry-fields">
                        <div class="form-group"><label>Lab ID</label><input class="form-input lab-id" data-index="${i}" value="${lab.lab_id || ''}"></div>
                        <div class="form-group"><label>Lab Name</label><input class="form-input lab-name" data-index="${i}" value="${lab.lab_name || ''}" placeholder="e.g. DSA Lab"></div>
                        <div class="form-group"><label>Room Number</label><input class="form-input lab-room" data-index="${i}" value="${lab.room_number || ''}" placeholder="e.g. LAB 511A"></div>
                    </div>
                </div>
            `).join('')}
        </div>
        <button class="add-entry-btn" onclick="addLab()">
            <span>＋</span> Add Lab
        </button>

        ${renderWizardActions(true, true)}
    `;
    document.querySelectorAll('.lab-id').forEach(el => {
        el.addEventListener('input', (e) => {
            state.labs[e.target.dataset.index].lab_id = e.target.value;
        });
    });
    document.querySelectorAll('.lab-name').forEach(el => {
        el.addEventListener('input', (e) => {
            state.labs[e.target.dataset.index].lab_name = e.target.value;
        });
    });
    document.querySelectorAll('.lab-room').forEach(el => {
        el.addEventListener('input', (e) => {
            state.labs[e.target.dataset.index].room_number = e.target.value;
            resetLabBoard();
        });
    });
}

function addLab() {
    state.labs.push({ lab_id: `LAB-${state.labs.length + 1}`, lab_name: '', room_number: '' });
    resetLabBoard();
    renderStep3(document.getElementById('wizardCard'));
}

function removeLab(index) {
    state.labs.splice(index, 1);
    resetLabBoard();
    renderStep3(document.getElementById('wizardCard'));
}

function renderStep4(card) {
    const sections = getSections();
    ensureLabBlocksInitialized();
    const currentSection = state.activeLabSection && sections.includes(state.activeLabSection) ? state.activeLabSection : (sections[0] || '');
    state.activeLabSection = currentSection;
    const unassigned = state.labBlocks.filter(b => b.section === currentSection && !state.labAssignments.some(a => a.blockId === b.id));
    const assignedCurrent = state.labAssignments.filter(a => a.section === currentSection);
    const availableLabRooms = state.labs
        .filter(l => (l.room_number || '').trim())
        .map(l => ({
            room_number: String(l.room_number).trim(),
            lab_name: String(l.lab_name || l.lab_id || '').trim(),
        }));

    card.innerHTML = `
        <div class="step-header">
            <span class="step-badge">🧩 Step 4 of 7</span>
            <h2>Lab Assignment Grid</h2>
            <p>Drag lab blocks into the timetable. Invalid targets highlight in red.</p>
        </div>
        <div class="form-group" style="max-width: 320px;">
            <label>Section</label>
            <select id="activeLabSection" class="form-select">
                ${sections.map(s => `<option value="${escapeHtml(s)}" ${s === currentSection ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
            </select>
        </div>
        <div class="lab-dnd-layout">
            <div class="entry-card">
                <h4 style="margin-bottom: 8px;">Unassigned Lab Blocks</h4>
                <div class="lab-block-pool">
                    ${unassigned.map(block => `
                        <div class="lab-block" draggable="true" data-block-id="${escapeHtml(block.id)}">
                            <div><strong>${escapeHtml(block.subject)}</strong></div>
                            ${availableLabRooms.length ? `
                                <select class="form-select lab-room-select" data-block-id="${escapeHtml(block.id)}" style="margin-top:6px;">
                                    ${availableLabRooms.map(r => `
                                        <option value="${escapeHtml(r.room_number)}" ${String(block.room) === String(r.room_number) ? 'selected' : ''}>
                                            ${escapeHtml(r.room_number)}${r.lab_name ? ' • ' + escapeHtml(r.lab_name) : ''}
                                        </option>
                                    `).join('')}
                                </select>
                            ` : `<div>${escapeHtml(block.room)}</div>`}
                            <div>${block.duration} slots</div>
                        </div>
                    `).join('') || '<div style="color: var(--text-muted)">No unassigned blocks.</div>'}
                </div>
                <h4 style="margin: 12px 0 8px;">Assigned (drag to re-place)</h4>
                <div class="lab-block-pool">
                    ${assignedCurrent.map(a => `
                        <div class="lab-block assigned" draggable="true" data-block-id="${escapeHtml(a.blockId)}">
                            <div><strong>${escapeHtml(a.subject)}</strong></div>
                            <div>${escapeHtml(DAY_NAMES[a.day])} Slot ${a.slot + 1}</div>
                            <div>${a.duration} slots • ${escapeHtml(a.room)}</div>
                        </div>
                    `).join('') || '<div style="color: var(--text-muted)">No assignments yet.</div>'}
                </div>
            </div>
            <div class="entry-card">
                <h4 style="margin-bottom: 8px;">Drop Grid</h4>
                <span id="labRealtimeWarning" style="color:var(--warning);font-size:0.85rem;"></span>
                <div class="form-group" style="margin-top:10px;">
                    <label>Available Lab Rooms for this slot</label>
                    <select id="labRoomChoice" class="form-select">
                        <option value="">Drag lab into a slot</option>
                    </select>
                </div>
                ${renderLabDropGrid(currentSection)}
            </div>
        </div>

        ${renderWizardActions(true, true)}
    `;
    bindStep4DnD();
}

function renderStep5(card) {
    const theorySubjects = state.subjects.filter(s => s.type === 'THEORY' && s.name.trim());
    const labSubjects = state.subjects.filter(s => s.type === 'LAB' && s.name.trim());
    const allSubjects = [...theorySubjects, ...labSubjects];

    const numClusters = getNumClusters();
    const sections = getSections();

    const activeClusterRaw = state.activeProfessorCluster ? parseInt(state.activeProfessorCluster) : 1;
    const activeCluster = Math.min(Math.max(1, activeClusterRaw), numClusters);
    state.activeProfessorCluster = activeCluster;

    const sectionsInCluster = sections.filter(sec => getClusterForSection(sec) === activeCluster);
    const activeSection = state.activeProfessorSection && sectionsInCluster.includes(state.activeProfessorSection)
        ? state.activeProfessorSection
        : (sectionsInCluster[0] || '');
    state.activeProfessorSection = activeSection;

    const teachersInCluster = state.teachers.filter(t => String(t.cluster || 1) === String(activeCluster) && t.id.trim() && t.name.trim());

    card.innerHTML = `
        <div class="step-header">
            <span class="step-badge">👩‍🏫 Step 5 of 7</span>
            <h2>Professor Mapping (Cluster + Section)</h2>
            <p>Enter professors with unique IDs. Then map each subject to a professor for the selected section.</p>
        </div>

        <div class="entries-container">
            ${state.teachers.map((t, i) => `
                <div class="entry-card">
                    <span class="entry-number">PROF ${i + 1}</span>
                    ${state.teachers.length > 1 ? `<button class="remove-entry" onclick="removeProf(${i})">×</button>` : ''}
                    <div class="entry-fields">
                        <div class="form-group"><label>Professor ID</label><input class="form-input prof-id" data-index="${i}" value="${escapeHtml(t.id || '')}" placeholder="e.g. P-101"></div>
                        <div class="form-group"><label>Name</label><input class="form-input prof-name" data-index="${i}" value="${escapeHtml(t.name || '')}"></div>
                        <div class="form-group">
                            <label>Cluster</label>
                            <select class="form-select prof-cluster" data-index="${i}">
                                ${Array.from({ length: numClusters }, (_, ci) => ci + 1)
                                    .map(c => `<option value="${c}" ${String(t.cluster || 1) === String(c) ? 'selected' : ''}>Cluster ${c}</option>`)
                                    .join('')}
                            </select>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        <button class="add-entry-btn" onclick="addProf()"><span>＋</span>Add Professor</button>

        <div class="form-grid" style="margin-top:18px;">
            <div class="form-group">
                <label>Choose Cluster</label>
                <select id="activeProfCluster" class="form-select">
                    ${Array.from({ length: numClusters }, (_, ci) => ci + 1).map(c => `
                        <option value="${c}" ${c === activeCluster ? 'selected' : ''}>Cluster ${c}</option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Choose Section in Cluster</label>
                <select id="activeProfSection" class="form-select">
                    ${sectionsInCluster.map(sec => `
                        <option value="${escapeHtml(sec)}" ${sec === activeSection ? 'selected' : ''}>${escapeHtml(sec)}</option>
                    `).join('')}
                </select>
            </div>
        </div>

        <div class="entries-container" style="margin-top:16px;">
            ${allSubjects.map(s => {
                const mapKey = `${activeSection}::${s.name}`;
                return `
                    <div class="entry-card">
                        <div class="entry-fields" style="grid-template-columns: 1fr;">
                            <div class="form-group">
                                <label>${escapeHtml(s.name)}</label>
                                <select class="form-select subj-prof" data-subject="${escapeHtml(s.name)}">
                                    <option value="">Select Professor</option>
                                    ${teachersInCluster.map(t => `
                                        <option value="${escapeHtml(t.id)}" ${state.sectionSubjectTeacherMap[mapKey] === t.id ? 'selected' : ''}>
                                            ${escapeHtml(t.name)} (ID: ${escapeHtml(t.id)})
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>

        ${renderWizardActions(true, true)}
    `;

    document.querySelectorAll('.prof-id').forEach(el => {
        el.addEventListener('input', (e) => state.teachers[e.target.dataset.index].id = e.target.value);
    });
    document.querySelectorAll('.prof-name').forEach(el => {
        el.addEventListener('input', (e) => state.teachers[e.target.dataset.index].name = e.target.value);
    });
    document.querySelectorAll('.prof-cluster').forEach(el => {
        el.addEventListener('change', (e) => state.teachers[e.target.dataset.index].cluster = parseInt(e.target.value) || 1);
    });

    const clusterSel = document.getElementById('activeProfCluster');
    if (clusterSel) {
        clusterSel.addEventListener('change', (e) => {
            state.activeProfessorCluster = parseInt(e.target.value) || 1;
            state.activeProfessorSection = '';
            renderStep();
        });
    }
    const sectionSel = document.getElementById('activeProfSection');
    if (sectionSel) {
        sectionSel.addEventListener('change', (e) => {
            state.activeProfessorSection = e.target.value;
            renderStep();
        });
    }

    document.querySelectorAll('.subj-prof').forEach(el => {
        el.addEventListener('change', (e) => {
            const subj = e.target.dataset.subject;
            const mapKey = `${state.activeProfessorSection}::${subj}`;
            state.sectionSubjectTeacherMap[mapKey] = e.target.value;
        });
        // Snapshot current selection so the value is persisted even without
        // an explicit user change (e.g. first option auto-selected).
        if (el.value) {
            const subj = el.dataset.subject;
            const mapKey = `${state.activeProfessorSection}::${subj}`;
            if (!state.sectionSubjectTeacherMap[mapKey]) {
                state.sectionSubjectTeacherMap[mapKey] = el.value;
            }
        }
    });
}

function renderStep6(card) {
    const sections = getSections();
    card.innerHTML = `
        <div class="step-header">
            <span class="step-badge">🏫 Step 6 of 7</span>
            <h2>Classroom Assignment</h2>
            <p>Assign fixed classroom per section. Theory classes will use this room.</p>
        </div>
        <div class="entries-container">
            ${sections.map(sec => `
                <div class="entry-card">
                    <div class="entry-fields">
                        <div class="form-group"><label>${escapeHtml(sec)}</label><input class="form-input section-room" data-section="${escapeHtml(sec)}" value="${escapeHtml(state.classrooms[sec] || '')}" placeholder="e.g. CR-201"></div>
                    </div>
                </div>
            `).join('')}
        </div>
        ${renderWizardActions(true, true)}
    `;
    document.querySelectorAll('.section-room').forEach(el => el.addEventListener('input', (e) => state.classrooms[e.target.dataset.section] = e.target.value));
}

function renderStep7(card) {
    const totalSections = getSections().length;
    card.innerHTML = `
        <div class="generate-step-content">
            <span class="generate-icon">🚀</span>
            <h3>Generate Lab-First Timetable</h3>
            <p>Labs are locked first, then theory is auto-filled with constraints.</p>
            <div class="summary-grid">
                <div class="summary-item"><div class="summary-label">Sections</div><div class="summary-value">${totalSections}</div></div>
                <div class="summary-item"><div class="summary-label">Subjects</div><div class="summary-value">${state.subjects.filter(s=>s.name.trim()).length}</div></div>
                <div class="summary-item"><div class="summary-label">Labs</div><div class="summary-value">${state.labs.filter(l=>l.room_number.trim()).length}</div></div>
                <div class="summary-item"><div class="summary-label">Lab Locks</div><div class="summary-value">${state.labAssignments.length}</div></div>
            </div>
            <button class="btn btn-primary btn-generate" onclick="generateTimetable()">Generate Timetable</button>
            ${state.lastGenerationError ? `
            <div style="margin-top:16px; padding:12px; border:1px solid var(--danger); border-radius:10px; background:var(--danger-bg);">
                <div style="font-weight:700; color:var(--danger);">No valid timetable found</div>
                <div style="font-size:.85rem; color:var(--text-secondary); margin-top:4px;">${escapeHtml(state.lastGenerationError)}</div>
                <button class="btn btn-secondary btn-small" style="margin-top:10px;" onclick="retryGenerateTimetable()">Retry</button>
            </div>
            ` : ''}
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
        if (state.labs.some(l => !l.lab_id.trim() || !l.lab_name.trim() || !l.room_number.trim())) {
            showToast('Please fill all lab rows (id/name/room).', 'error');
            return;
        }
    }
    if (state.currentStep === 4) {
        if (state.teachers.some(t => !t.id.trim() || !t.name.trim())) {
            showToast('Please fill all professor IDs and names.', 'error');
            return;
        }
        const subjectsToMap = state.subjects.filter(s => (s.type === 'THEORY' || s.type === 'LAB') && s.name.trim());
        const sections = getSections();

        // Auto-fill unmapped sections by copying from a sibling section
        // in the same cluster that IS already mapped.
        for (const s of subjectsToMap) {
            const sName = s.name.trim();
            for (const sec of sections) {
                const key = `${sec}::${sName}`;
                if (state.sectionSubjectTeacherMap[key]) continue;
                // Find a mapped sibling in the same cluster
                const cluster = getClusterForSection(sec);
                const sibling = sections.find(other =>
                    other !== sec &&
                    getClusterForSection(other) === cluster &&
                    state.sectionSubjectTeacherMap[`${other}::${sName}`]
                );
                if (sibling) {
                    state.sectionSubjectTeacherMap[key] = state.sectionSubjectTeacherMap[`${sibling}::${sName}`];
                }
            }
        }

        // Now validate
        for (const sec of sections) {
            for (const s of subjectsToMap) {
                const key = `${sec}::${s.name.trim()}`;
                if (!state.sectionSubjectTeacherMap[key]) {
                    showToast(`Map ${s.name} for ${sec}.`, 'error');
                    return;
                }
            }
        }
    }
    if (state.currentStep === 5) {
        if (getSections().some(sec => !(state.classrooms[sec] || '').trim())) {
            showToast('Assign classroom for every section.', 'error');
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

async function generateTimetable() {
    const teachers = state.teachers
        .filter(t => t.id.trim() && t.name.trim())
        .map(t => ({
            id: t.id.trim(),
            name: t.name.trim(),
            cluster: t.cluster || 1,
            max_consecutive_classes: t.max_consecutive_classes || state.constraints.maxConsecutiveClasses,
            availability: parseAvailabilityText(t.availabilityText || '')
        }));
    const payload = {
        scheduleMode: state.scheduleMode,
        sectionsPerCluster: state.sectionsPerCluster,
        departments: state.departments.filter(d => d.name.trim()),
        numDays: state.numDays,
        numSlots: state.numSlots,
        subjects: state.subjects.filter(s => s.name.trim()),
        labs: state.labs.filter(l => l.lab_name.trim()),
        labAssignments: state.labAssignments,
        teachers,
        sectionSubjectTeacherMap: state.sectionSubjectTeacherMap,
        classrooms: state.classrooms,
        constraints: state.constraints,
        retrySeed: state.retrySeed,
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
        state.lastGenerationError = '';
        showResults(result);
        showToast('Timetable generated successfully!', 'success');
        if (result.data.warnings && result.data.warnings.length) {
            showToast(`Generated with ${result.data.warnings.length} warning(s).`, 'info');
        }
    } catch (error) {
        state.lastGenerationError = error.message || 'Generation failed';
        if (state.currentStep === 6) renderStep();
        showToast('No valid timetable found', 'error');
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

function retryGenerateTimetable() {
    state.retrySeed = Date.now();
    generateTimetable();
}

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
                <button class="btn btn-outline btn-small" onclick="exportExcel()">📊 Export Excel</button>
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

function exportExcel() {
    if (!state.results || !state.results.data || !state.results.data.sectionTimetables) {
        showToast('Generate timetable first.', 'error');
        return;
    }
    const rows = ['Section,Day,Slot,Subject,Teacher,Room'];
    const timetables = state.results.data.sectionTimetables;
    Object.entries(timetables).forEach(([section, grid]) => {
        grid.forEach((dayRow, dayIdx) => {
            dayRow.forEach((cell, slotIdx) => {
                if (cell.isFree) return;
                rows.push([
                    `"${section}"`,
                    `"${DAY_NAMES[dayIdx] || `Day ${dayIdx + 1}`}"`,
                    slotIdx + 1,
                    `"${(cell.subject || '').replaceAll('"', '""')}"`,
                    `"${(cell.teacher || '').replaceAll('"', '""')}"`,
                    `"${(cell.room || '').replaceAll('"', '""')}"`
                ].join(','));
            });
        });
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'timetable_export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Excel-compatible CSV exported.', 'success');
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

function getSections() {
    const sections = [];
    state.departments.forEach(d => {
        const total = parseInt(d.sections) || 1;
        for (let i = 0; i < total; i++) {
            sections.push(`${d.name} - Section ${String.fromCharCode(65 + i)}`);
        }
    });
    return sections;
}

function parseAvailabilityText(text) {
    if (!text.trim()) return [];
    return text.split(',').map(x => x.trim()).filter(Boolean).map(token => {
        const [d, s] = token.split('-');
        return { day: parseInt(d), slot: parseInt(s) };
    }).filter(x => Number.isInteger(x.day) && Number.isInteger(x.slot));
}

function addProf() {
    state.teachers.push({ id: '', name: '', cluster: 1, max_consecutive_classes: 2, availabilityText: '' });
    renderStep();
}

function removeProf(index) {
    state.teachers.splice(index, 1);
    renderStep();
}

function resetLabBoard() {
    state.labBlocks = [];
    state.labAssignments = [];
}

function validateLabAssignment(candidate, ignoreBlockId = null) {
    const duration = candidate.duration;
    const endSlot = candidate.slot + duration;
    if (endSlot > state.numSlots) return { ok: false, message: 'Lab must be consecutive slots within day.' };
    for (const existing of state.labAssignments) {
        if (ignoreBlockId && existing.blockId === ignoreBlockId) continue;
        if (existing.day !== candidate.day) continue;
        const overlap = !(candidate.slot + duration <= existing.slot || existing.slot + existing.duration <= candidate.slot);
        if (!overlap) continue;
        if (existing.section === candidate.section) return { ok: false, message: 'No overlapping labs for same class.' };
        if (existing.room === candidate.room) return { ok: false, message: 'Room already occupied' };
        const t1 = getTeacherIdForSectionSubject(candidate.section, candidate.subject);
        const t2 = getTeacherIdForSectionSubject(existing.section, existing.subject);
        if (t1 && t2 && t1 === t2) return { ok: false, message: 'Professor conflict' };
    }
    return { ok: true };
}

function ensureLabBlocksInitialized() {
    if (!state.activeLabSection) state.activeLabSection = getSections()[0] || '';
    if (state.labBlocks.length > 0) return;
    const sections = getSections();
    const labSubjects = state.subjects.filter(s => s.type === 'LAB' && s.name.trim());
    labSubjects.forEach(subject => {
        const sessions = Math.max(1, Math.round((subject.hours || 1) / (subject.lab_duration || 2)));
        for (const section of sections) {
            for (let i = 0; i < sessions; i++) {
                state.labBlocks.push({
                    id: `${section}__${subject.name}__${i}`,
                    section,
                    subject: subject.name,
                    duration: subject.lab_duration || 2,
                    room: state.labs[0]?.room_number || ''
                });
            }
        }
    });
}

function renderLabDropGrid(section) {
    const header = Array.from({ length: state.numSlots }, (_, i) => `<th>Slot ${i + 1}</th>`).join('');
    let body = '';
    for (let day = 0; day < state.numDays; day++) {
        body += `<tr><td>${DAY_NAMES[day]}</td>`;
        for (let slot = 0; slot < state.numSlots; slot++) {
            const existing = state.labAssignments.find(a => a.section === section && a.day === day && slot >= a.slot && slot < (a.slot + a.duration));
            if (existing && slot > existing.slot) {
                body += `<td class="lab-grid-cell lab-occupied-cont"></td>`;
                continue;
            }
            if (existing && slot === existing.slot) {
                body += `<td class="lab-grid-cell lab-occupied" colspan="${existing.duration}">${escapeHtml(existing.subject)}<br><span style="font-size:.75rem">${escapeHtml(existing.room)}</span></td>`;
                slot += (existing.duration - 1);
                continue;
            }
            body += `<td class="lab-grid-cell lab-drop-cell" data-section="${escapeHtml(section)}" data-day="${day}" data-slot="${slot}"></td>`;
        }
        body += '</tr>';
    }
    return `<div class="timetable-wrapper"><table class="timetable lab-drop-table"><thead><tr><th>Day \\ Slot</th>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function bindStep4DnD() {
    const sectionSelect = document.getElementById('activeLabSection');
    if (sectionSelect) {
        sectionSelect.addEventListener('change', (e) => {
            state.activeLabSection = e.target.value;
            renderStep();
        });
    }

    document.querySelectorAll('.lab-room-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const blockId = e.target.dataset.blockId;
            const block = state.labBlocks.find(b => b.id === blockId);
            if (!block) return;
            block.room = e.target.value;
        });
    });

    document.querySelectorAll('.lab-block').forEach(block => {
        block.addEventListener('dragstart', (e) => {
            state.draggingLabBlockId = block.dataset.blockId;
            e.dataTransfer.setData('text/plain', block.dataset.blockId);
        });
    });

    document.querySelectorAll('.lab-drop-cell').forEach(cell => {
        cell.addEventListener('dragover', (e) => {
            e.preventDefault();
            const blockId = e.dataTransfer.getData('text/plain');
            const block = state.labBlocks.find(b => b.id === blockId);
            if (!block) return;

            const labRoomChoice = document.getElementById('labRoomChoice');
            const availableRooms = state.labs
                .filter(l => (l.room_number || '').trim())
                .map(l => ({
                    room_number: String(l.room_number).trim(),
                    lab_name: String(l.lab_name || l.lab_id || '').trim(),
                }));

            const validRooms = [];
            let firstError = 'No available labs for this time';

            for (const r of availableRooms) {
                const candidate = {
                    blockId,
                    subject: block.subject,
                    section: cell.dataset.section,
                    room: r.room_number,
                    day: parseInt(cell.dataset.day),
                    slot: parseInt(cell.dataset.slot),
                    duration: block.duration
                };
                const validation = validateLabAssignment(candidate, blockId);
                if (validation.ok) {
                    validRooms.push(r);
                } else if (!firstError || firstError === 'No available labs for this time') {
                    firstError = validation.message;
                }
            }

            cell.classList.remove('invalid-drop', 'valid-drop');
            const warning = document.getElementById('labRealtimeWarning');
            if (validRooms.length > 0) {
                cell.classList.add('valid-drop');
                if (labRoomChoice) {
                    labRoomChoice.innerHTML = validRooms.map(r => `
                        <option value="${escapeHtml(r.room_number)}">${escapeHtml(r.room_number)}${r.lab_name ? ' • ' + escapeHtml(r.lab_name) : ''}</option>
                    `).join('');
                    labRoomChoice.value = validRooms[0].room_number;
                }
                if (warning) warning.textContent = '';
            } else {
                cell.classList.add('invalid-drop');
                if (labRoomChoice) {
                    labRoomChoice.innerHTML = `<option value="">No available rooms</option>`;
                }
                if (warning) warning.textContent = firstError || 'No available labs for this time';
            }
        });
        cell.addEventListener('dragleave', () => {
            cell.classList.remove('invalid-drop', 'valid-drop');
        });
        cell.addEventListener('drop', (e) => {
            e.preventDefault();
            const blockId = e.dataTransfer.getData('text/plain');
            const block = state.labBlocks.find(b => b.id === blockId);
            if (!block) return;

            const labRoomChoice = document.getElementById('labRoomChoice');
            const selectedRoom = labRoomChoice ? labRoomChoice.value : '';
            const roomToUse = selectedRoom || block.room;

            const candidate = {
                blockId,
                subject: block.subject,
                section: cell.dataset.section,
                room: roomToUse,
                day: parseInt(cell.dataset.day),
                slot: parseInt(cell.dataset.slot),
                duration: block.duration
            };
            const validation = validateLabAssignment(candidate, blockId);
            if (!validation.ok) {
                showToast(validation.message, 'error');
                return;
            }
            const oldIdx = state.labAssignments.findIndex(a => a.blockId === blockId);
            if (oldIdx >= 0) state.labAssignments.splice(oldIdx, 1);
            state.labAssignments.push(candidate);
            renderStep();
        });
    });
}

function escapeHtml(value) {
    return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
