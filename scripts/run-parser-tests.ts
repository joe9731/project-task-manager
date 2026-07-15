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
  // Case 1: basic tasks, emoji date, nested subtask
  const sample1 = `- [ ] Task one #项目管理/ProjA 📅 2026-07-20\n- [x] Done task #proj\n  - [ ] subtask #项目管理/ProjA/Sub`;
  const t1 = parseFileContent(sample1, 'test1.md');
  assert(t1.length === 3, `expected 3 tasks, got ${t1.length}`);
  assert(t1[0].tags.includes('#项目管理/ProjA'), 'first task should include project tag');
  assert(t1[0].dueDate !== undefined && t1[0].dueDate !== null, 'first task should have dueDate parsed from emoji');
  // Check indentation length (preserve raw whitespace)
  assert(Boolean(t1[2].indentation && t1[2].indentation.length > 0), 'subtask should preserve indentation');

  // Case 2: inline dataview fields and Chinese natural language
  const sample2 = `- [ ] 中国任务 due:: 2026-07-25 #中国\n- [ ] 明天要做的事 #日常`;
  const t2 = parseFileContent(sample2, 'test2.md');
  assert(t2.length === 2, `expected 2 tasks, got ${t2.length}`);
  // first should have due date from inline field
  assert(t2[0].dueDate !== null, 'first task should parse inline due date');
  // second may have a natural-language date (明天) — at minimum, parser should attempt and not throw
  // We just assert that parser ran and produced a TaskLite entry with description preserved
  assert(t2[1].description.includes('明天') || t2[1].dueDate !== null, 'second task either keeps "明天" in description or has a dueDate parsed');

  // Case 3: tags only line
  const sample3 = `- [ ] #onlyTag #项目管理/Tag`;
  const t3 = parseFileContent(sample3, 'test3.md');
  assert(t3.length === 1, 'expected 1 task');
  assert(t3[0].tags.length >= 1, 'tags should be detected');

  // Case 4: various checkbox symbols
  const sample4 = `* [ ] a\n* [x] b\n1. [ ] c\n- [/] weird`;
  const t4 = parseFileContent(sample4, 'test4.md');
  assert(t4.length === 4, `expected 4 tasks, got ${t4.length}`);

  // Check ids and line numbers
  const sample5 = `- [ ] a\nnot a task\n- [ ] b`;
  const t5 = parseFileContent(sample5, 'test5.md');
  assert(t5[0].id === 'test5.md:1', `first id should be test5.md:1 got ${t5[0].id}`);
  assert(t5[1].id === 'test5.md:3', `second id should be test5.md:3 got ${t5[1].id}`);

  console.log('All parser tests finished.');
}

run().catch((e) => { console.error(e); process.exit(1); });
