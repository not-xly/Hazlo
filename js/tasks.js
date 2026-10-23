// Estado de las tareas y persistencia en localStorage

const STORAGE_KEY = 'hazlo_tasks';

const DEFAULT_TASKS = [
    { id: 1, text: "Toca una tarea para ver opciones. Doble toque para editar. Arrastra el icono de la derecha para ordenar.", deadline: "corto" },
    { id: 2, text: "Ejemplo de tarea en el listado", deadline: "medio" }
];

function loadTasks() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return Array.isArray(saved) ? saved : DEFAULT_TASKS.map(t => ({ ...t }));
    } catch (error) {
        // Si el dato guardado está dañado, empezamos con la lista de ejemplo
        return DEFAULT_TASKS.map(t => ({ ...t }));
    }
}

let tasks = loadTasks();

function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function generateId() {
    return Date.now() + Math.floor(Math.random() * 1000);
}

function addTask(text, deadline) {
    const newTask = {
        id: generateId(),
        text: text,
        deadline: deadline
    };

    // Corto plazo -> Arriba, Medio plazo -> Abajo
    if (newTask.deadline === 'corto') {
        tasks.unshift(newTask);
    } else {
        tasks.push(newTask);
    }

    saveTasks();
}

function updateTaskText(id, newText) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.text = newText;
        saveTasks();
    }
}

function setTaskDeadline(id, deadline) {
    const task = tasks.find(t => t.id === id);
    if (task && task.deadline !== deadline) {
        task.deadline = deadline;
        saveTasks();
    }
}

function deleteTask(id) {
    tasks = tasks.filter(task => task.id !== id);
    saveTasks();
}

function getVisibleTasks(filter) {
    return tasks.filter(task => filter === 'todos' || task.deadline === filter);
}

// Mueve una tarea dentro de la vista filtrada. Las tareas que no se ven
// conservan sus posiciones en la lista completa.
function moveVisibleTask(filter, fromIndex, toIndex) {
    const slots = [];
    tasks.forEach((task, index) => {
        if (filter === 'todos' || task.deadline === filter) slots.push(index);
    });

    const visible = slots.map(slot => tasks[slot]);
    const [moved] = visible.splice(fromIndex, 1);
    visible.splice(toIndex, 0, moved);

    slots.forEach((slot, i) => {
        tasks[slot] = visible[i];
    });
    saveTasks();
}
