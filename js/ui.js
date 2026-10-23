// Renderizado y eventos de la interfaz

const ICONS = {
    grip: [[9, 6], [15, 6], [9, 12], [15, 12], [9, 18], [15, 18]]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="currentColor" stroke="none"/>`)
        .join(''),
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    swap: '<path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'
};

// Plazos: corto, medio y viajes (la letra del badge sale de la primera letra: C, M, V)
const DEADLINE_LABELS = { corto: 'Corto', medio: 'Medio', viaje: 'Viajes' };
const NEXT_DEADLINE = { corto: 'medio', medio: 'viaje', viaje: 'corto' };

const EXPAND_DELAY = 250;   // ms para distinguir un toque simple de un doble toque
const EDGE_ZONE = 80;       // px cerca del borde donde se desplaza la lista al arrastrar
const SCROLL_STEP = 8;      // px por tick de desplazamiento

let currentFilter = 'todos';

const listElement = document.getElementById('taskList');
const filterControl = document.getElementById('filterControl');
const todoForm = document.getElementById('todoForm');
const taskInput = document.getElementById('taskInput');
const deadlineSelect = document.getElementById('deadlineInput');

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function createIcon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = ICONS[name];
    return svg;
}

function createActionButton(action, label, icon, extraClass = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `chip ${extraClass}`.trim();
    button.dataset.action = action;
    button.appendChild(createIcon(icon));
    button.appendChild(document.createTextNode(label));
    return button;
}

// Fila compacta: [badge] [texto de una línea] [arrastrar]. Las acciones quedan ocultas hasta tocar la tarea.
function createTaskItem(task) {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.dataset.id = task.id;

    const row = document.createElement('div');
    row.className = 'task-row';

    // Tocar la letra pasa al siguiente plazo: Corto -> Medio -> Viajes -> Corto
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = `task-badge badge-${task.deadline}`;
    badge.dataset.action = 'cycle-deadline';
    badge.setAttribute('aria-label', `Cambiar a ${DEADLINE_LABELS[NEXT_DEADLINE[task.deadline]]}`);
    badge.textContent = task.deadline.charAt(0).toUpperCase();

    const text = document.createElement('div');
    text.className = 'task-text';
    text.textContent = task.text;

    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.setAttribute('aria-label', 'Arrastrar para ordenar');
    handle.appendChild(createIcon('grip'));

    row.append(badge, text, handle);

    // Botones para elegir directamente cualquiera de los otros plazos
    const actions = document.createElement('div');
    actions.className = 'task-actions';
    Object.keys(DEADLINE_LABELS)
        .filter(deadline => deadline !== task.deadline)
        .forEach(deadline => {
            const button = createActionButton('set-deadline', `Pasar a ${DEADLINE_LABELS[deadline]}`, 'swap');
            button.dataset.deadline = deadline;
            actions.appendChild(button);
        });
    actions.append(
        createActionButton('edit', 'Editar', 'edit'),
        createActionButton('delete', 'Borrar', 'trash', 'danger')
    );

    li.append(row, actions);
    return li;
}

function renderTasks() {
    listElement.innerHTML = '';

    const visible = getVisibleTasks(currentFilter);
    if (visible.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'empty-state';
        empty.textContent = 'No hay tareas en esta vista';
        listElement.appendChild(empty);
        return;
    }

    visible.forEach(task => listElement.appendChild(createTaskItem(task)));
}

function syncFilterButtons() {
    filterControl.querySelectorAll('button[data-filter]').forEach(button => {
        const active = button.dataset.filter === currentFilter;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
}

function handleAction(button, item) {
    const action = button.dataset.action;
    const id = Number(item.dataset.id);

    if (action === 'edit') {
        startEdit(item);
        return;
    }

    if (action === 'delete') deleteTask(id);

    if (action === 'set-deadline') setTaskDeadline(id, button.dataset.deadline);

    if (action === 'cycle-deadline') {
        const task = tasks.find(t => t.id === id);
        if (task) setTaskDeadline(id, NEXT_DEADLINE[task.deadline]);
    }

    renderTasks();
}

// Solo una tarea expandida a la vez
let expandTimer = null;

function toggleExpanded(item) {
    const opening = !item.classList.contains('expanded');
    listElement.querySelectorAll('.task-item.expanded').forEach(el => el.classList.remove('expanded'));
    if (opening) item.classList.add('expanded');
}

function scheduleExpand(item) {
    clearTimeout(expandTimer);
    expandTimer = setTimeout(() => toggleExpanded(item), EXPAND_DELAY);
}

function startEdit(item) {
    const id = Number(item.dataset.id);
    const task = tasks.find(t => t.id === id);
    const textEl = item.querySelector('.task-text');
    if (!task || !textEl) return;

    clearTimeout(expandTimer);

    const textarea = document.createElement('textarea');
    textarea.className = 'edit-input';
    textarea.rows = 1;
    textarea.value = task.text;
    textarea.setAttribute('aria-label', 'Editar tarea');

    const autosize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    };

    // Guardar al salir del campo (blur) o cancelar con Escape. Solo una vez.
    let finished = false;
    const finish = (save) => {
        if (finished) return;
        finished = true;
        if (save) {
            const newText = textarea.value.trim();
            if (newText !== '') updateTaskText(id, newText);
        }
        renderTasks();
    };

    textarea.addEventListener('input', autosize);
    textarea.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') finish(false);
    });
    textarea.addEventListener('blur', () => finish(true));

    textEl.replaceWith(textarea);
    item.classList.add('expanded');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    autosize();
}

// Arrastrar para ordenar (puntero, funciona con dedo en iPhone)
let drag = null;

function startDrag(event, item, handle) {
    event.preventDefault();
    clearTimeout(expandTimer);
    listElement.querySelectorAll('.task-item.expanded').forEach(el => el.classList.remove('expanded'));

    const items = [...listElement.querySelectorAll('.task-item')];
    const fromIndex = items.indexOf(item);

    drag = {
        item,
        items,
        fromIndex,
        toIndex: fromIndex,
        pointerId: event.pointerId,
        startY: event.clientY,
        startScrollY: window.scrollY,
        clientY: event.clientY,
        // Distancia entre filas (alto + separación); las filas colapsadas tienen el mismo alto
        pitch: items.length > 1 ? items[1].offsetTop - items[0].offsetTop : item.offsetHeight,
        timer: null
    };

    handle.setPointerCapture(event.pointerId);
    item.classList.add('dragging');
    document.body.classList.add('is-dragging');

    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    drag.timer = setInterval(autoScroll, 16);
}

function onDragMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.clientY = event.clientY;
    updateDrag();
}

function autoScroll() {
    if (!drag) return;
    const y = drag.clientY;
    const step = y > window.innerHeight - EDGE_ZONE ? SCROLL_STEP : y < EDGE_ZONE ? -SCROLL_STEP : 0;
    if (step) {
        window.scrollBy(0, step);
        updateDrag();
    }
}

function updateDrag() {
    // Incluye el desplazamiento de la página para que la tarea siga al dedo mientras se hace scroll
    const dy = drag.clientY - drag.startY + (window.scrollY - drag.startScrollY);
    drag.item.style.transform = `translateY(${dy}px)`;

    const target = clamp(
        drag.fromIndex + Math.round(dy / drag.pitch),
        0,
        drag.items.length - 1
    );
    if (target === drag.toIndex) return;
    drag.toIndex = target;

    // Las filas entre el origen y el destino se hacen espacio
    drag.items.forEach((el, i) => {
        if (el === drag.item) return;
        let shift = 0;
        if (drag.fromIndex < target && i > drag.fromIndex && i <= target) {
            shift = -drag.pitch;
        } else if (drag.fromIndex > target && i >= target && i < drag.fromIndex) {
            shift = drag.pitch;
        }
        el.style.transform = shift ? `translateY(${shift}px)` : '';
    });
}

function endDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;

    clearInterval(drag.timer);
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
    document.body.classList.remove('is-dragging');

    const { fromIndex, toIndex } = drag;
    const moved = event.type === 'pointerup' && fromIndex !== toIndex;
    drag = null;

    if (moved) moveVisibleTask(currentFilter, fromIndex, toIndex);
    renderTasks();
}

// Eventos

todoForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = taskInput.value.trim();
    if (text === '') return;

    addTask(text, deadlineSelect.value);
    taskInput.value = '';
    renderTasks();
    taskInput.blur();
});

filterControl.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;

    currentFilter = button.dataset.filter;
    syncFilterButtons();
    renderTasks();
});

listElement.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('.drag-handle');
    if (!handle) return;

    startDrag(event, handle.closest('.task-item'), handle);
});

listElement.addEventListener('click', (event) => {
    const item = event.target.closest('.task-item');
    if (!item) return;

    const button = event.target.closest('button[data-action]');
    if (button) {
        handleAction(button, item);
        return;
    }

    if (event.target.closest('.task-text')) {
        scheduleExpand(item);
    }
});

listElement.addEventListener('dblclick', (event) => {
    const item = event.target.closest('.task-item');
    if (!item || !event.target.closest('.task-text')) return;

    startEdit(item);
});

// PWA: registrar el service worker (requiere https, como GitHub Pages)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
}

syncFilterButtons();
renderTasks();
