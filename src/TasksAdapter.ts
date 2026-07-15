import { TaskLite } from './TaskParser';
import moment from 'moment';

/**
 * Adapter to convert external tasks (from obsidian-tasks or similar) into TaskLite
 * This is best-effort mapping — fields will be normalized where available.
 */
export function adaptExternalTasks(externalTasks: any[], sourceIdPrefix = 'external'): TaskLite[] {
  if (!Array.isArray(externalTasks)) return [];

  return externalTasks.map((t: any, idx: number) => {
    // Best-effort mapping — different plugins expose different fields
    const filePath = t.path || t.file || t.filePath || t.source || '(external)';
    const lineNumber = typeof t.line === 'number' ? t.line : (typeof t.lineNumber === 'number' ? t.lineNumber : idx + 1);
    const description = t.text || t.content || t.title || t.description || String(t).slice(0, 80);

    let statusSymbol = ' ';
    if (t.status) {
      const s = String(t.status).toLowerCase();
      if (s === 'done' || s === 'completed' || s === 'x' || s === 'true') statusSymbol = 'x';
      else if (s === 'cancelled' || s === '-') statusSymbol = '-';
    }

    const tags: string[] = [];
    if (Array.isArray(t.tags)) {
      for (const tg of t.tags) {
        if (typeof tg === 'string') tags.push(tg.startsWith('#') ? tg : `#${tg}`);
      }
    } else if (typeof t.tags === 'string') {
      tags.push(...t.tags.split(/\s+/).map((s: string) => (s.startsWith('#') ? s : `#${s}`)));
    }

    let dueDate: moment.Moment | null = null;
    let scheduledDate: moment.Moment | null = null;
    try {
      if (t.due) dueDate = moment(t.due);
      if (t.dueDate) dueDate = moment(t.dueDate);
      if (t.scheduled) scheduledDate = moment(t.scheduled);
      if (t.start) scheduledDate = moment(t.start);
    } catch (e) {
      // ignore
    }

    const id = `${sourceIdPrefix}:${filePath}:${lineNumber}`;

    const task: TaskLite = {
      id,
      filePath,
      lineNumber,
      indentation: '',
      listMarker: '-',
      statusSymbol,
      description: String(description),
      tags,
      dueDate: dueDate ?? null,
      scheduledDate: scheduledDate ?? null,
      rawLine: String(t.rawLine || t.lineText || description),
    };

    return task;
  });
}
