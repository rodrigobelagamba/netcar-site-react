import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectUrl = new URL('../docs/local-seo-project/project.json', import.meta.url);
const projectPath = fileURLToPath(projectUrl);
const project = JSON.parse(await readFile(projectUrl, 'utf8'));
const validateOnly = process.argv.includes('--validate');

const errors = [];
const ids = new Set();
const priorities = new Set(['P0', 'P1', 'P2', 'P3']);
const allowedStatuses = new Set(project.allowedStatuses ?? []);

for (const field of ['name', 'updatedAt', 'canonicalRepository', 'tasks']) {
  if (project[field] === undefined || project[field] === '') {
    errors.push(`Campo obrigatório ausente: ${field}`);
  }
}

if (!Array.isArray(project.tasks)) {
  errors.push('tasks precisa ser uma lista');
} else {
  for (const [index, task] of project.tasks.entries()) {
    const label = task.id || `índice ${index}`;

    for (const field of ['id', 'title', 'cities', 'priority', 'status', 'owner', 'dependencies', 'acceptance']) {
      if (task[field] === undefined || task[field] === '') {
        errors.push(`${label}: campo obrigatório ausente: ${field}`);
      }
    }

    if (ids.has(task.id)) errors.push(`${label}: ID duplicado`);
    ids.add(task.id);

    if (!priorities.has(task.priority)) errors.push(`${label}: prioridade inválida: ${task.priority}`);
    if (!allowedStatuses.has(task.status)) errors.push(`${label}: estado inválido: ${task.status}`);
    if (!Array.isArray(task.cities) || task.cities.length === 0) errors.push(`${label}: cities precisa ter ao menos uma cidade`);
    if (!Array.isArray(task.dependencies)) errors.push(`${label}: dependencies precisa ser uma lista`);
    if (!Array.isArray(task.acceptance) || task.acceptance.length === 0) errors.push(`${label}: acceptance precisa ter ao menos um item`);
  }
}

if (errors.length > 0) {
  console.error(`Projeto inválido em ${projectPath}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else if (validateOnly) {
  console.log(`Projeto válido: ${project.name} (${project.tasks.length} tarefas)`);
} else {
  const counts = project.tasks.reduce((accumulator, task) => {
    accumulator[task.status] = (accumulator[task.status] ?? 0) + 1;
    return accumulator;
  }, {});
  const next = project.tasks
    .filter((task) => ['ready', 'verify_production', 'in_progress'].includes(task.status))
    .sort((left, right) => left.priority.localeCompare(right.priority));

  console.log(project.name);
  console.log(`Atualizado em: ${project.updatedAt}`);
  console.log(`Base canônica: ${project.canonicalRepository}`);
  console.log(`Mídia paga obrigatória: ${project.paidMediaRequired ? 'sim' : 'não'}`);
  console.log(`Cidades prioritárias: ${project.priorityCities.join(', ')}`);
  console.log('\nEstado:');
  for (const status of project.allowedStatuses) console.log(`- ${status}: ${counts[status] ?? 0}`);
  console.log('\nPróximas tarefas:');
  for (const task of next) console.log(`- ${task.id} [${task.priority}/${task.status}] ${task.title}`);
}
