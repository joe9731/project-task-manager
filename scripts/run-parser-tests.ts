// Simple test runner for TaskParser
import { parseFileContent } from '../src/TaskParser';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('PASS:', msg);
  }
}

async function run() {
  const sample = `- [ ] Task one #项目管理/ProjA 📅 2026-07-20\n- [x] Done task #proj\n  - [ ] subtask #项目管理/ProjA/Sub`;
  const tasks = parseFileContent(sample, 'test.md');
  assert(tasks.length === 3, `expected 3 tasks, got ${tasks.length}`);

  const first = tasks[0];
  assert(first.tags && first.tags.length > 0, 'first task should have tags');
  assert(first.dueDate !== undefined && first.dueDate !== null, 'first task should have dueDate parsed');

  console.log('All parser tests finished.');
}

run().catch((e) => { console.error(e); process.exit(1); });
