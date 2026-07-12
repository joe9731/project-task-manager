import chrono from 'chrono-node';
import moment from 'moment';

export interface TaskLite {
    id: string; // path:line
    filePath: string;
    lineNumber: number;
    indentation: string;
    listMarker: string;
    statusSymbol: string;
    description: string;
    tags: string[];
    dueDate?: moment.Moment | null;
    scheduledDate?: moment.Moment | null;
    rawLine: string;
}

// Support - [ ], * [ ], 1. [ ] etc.
const TASK_LINE_REGEX = /^(\s*)([-*+]|\d+\.)\s*\[([ xX\-\/\+?])\]\s*(.*)$/;

// Inline dataview-like field: [due:: 2023-07-12]
const INLINE_FIELD_REGEX = /(?:\[|\()\s*([^:\]]+)::\s*([^\]\)]+)\s*(?:\]|\))/g;

/**
 * Try to extract a date from text using several heuristics:
 * - emoji date like 📅 YYYY-MM-DD
 * - dataview inline field due:: YYYY-MM-DD
 * - explicit `due on YYYY-MM-DD` or `due YYYY-MM-DD`
 * - natural language via chrono (supports Chinese like 明天/下周一)
 */
function extractDate(text: string): moment.Moment | null {
    if (!text) return null;

    // emoji date
    const emojiMatch = text.match(/📅\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/);
    if (emojiMatch) {
        return moment(emojiMatch[1], 'YYYY-MM-DD');
    }

    // dataview inline field checks
    let m: RegExpExecArray | null;
    INLINE_FIELD_REGEX.lastIndex = 0; // reset
    while ((m = INLINE_FIELD_REGEX.exec(text)) !== null) {
        const key = m[1].trim().toLowerCase();
        const val = m[2].trim();
        if (['due', 'due date', 'due::', 'due_date', 'completion', 'done'].includes(key) || key === 'due') {
            const parsed = chrono.parseDate(val);
            if (parsed) return moment(parsed);
            // fallback simple yyyy-mm-dd
            const simple = val.match(/([0-9]{4}-[0-9]{2}-[0-9]{2})/);
            if (simple) return moment(simple[1], 'YYYY-MM-DD');
        }
    }

    // explicit due on yyyy-mm-dd
    const dueMatch = text.match(/due(?: on)?\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
    if (dueMatch) {
        return moment(dueMatch[1], 'YYYY-MM-DD');
    }

    // try to let chrono parse natural language (including Chinese)
    try {
        const parsed = chrono.parseDate(text, new Date());
        if (parsed) return moment(parsed);
    } catch (e) {
        // ignore
    }

    return null;
}

export function parseTaskLine(line: string): Partial<TaskLite> | null {
    const m = line.match(TASK_LINE_REGEX);
    if (!m) return null;

    const indentation = m[1] ?? '';
    const listMarker = m[2] ?? '-';
    const statusSymbol = m[3] ?? ' ';
    const body = m[4] ?? '';

    // Tags: match #tag or #tag/subtag ... allow Chinese chars
    const tagRegex = /#([^\s#\/][^\s#]*)/g;
    const tags: string[] = [];
    let tm: RegExpExecArray | null;
    tagRegex.lastIndex = 0;
    while ((tm = tagRegex.exec(body)) !== null) {
        tags.push(tm[0]); // keep the leading # to be consistent
    }

    const dueDate = extractDate(body);

    return {
        indentation,
        listMarker,
        statusSymbol,
        description: body,
        tags,
        dueDate,
        scheduledDate: null,
        rawLine: line,
    };
}

export function parseFileContent(content: string, filePath: string): TaskLite[] {
    const lines = content.split(/\r?\n/);
    const tasks: TaskLite[] = [];

    for (let i = 0; i < lines.length; i++) {
        const parsed = parseTaskLine(lines[i]);
        if (parsed) {
            const id = `${filePath}:${i + 1}`;
            tasks.push({
                id,
                filePath,
                lineNumber: i + 1,
                indentation: parsed.indentation ?? '',
                listMarker: parsed.listMarker ?? '-',
                statusSymbol: parsed.statusSymbol ?? ' ',
                description: parsed.description ?? '',
                tags: parsed.tags ?? [],
                dueDate: parsed.dueDate ?? null,
                scheduledDate: parsed.scheduledDate ?? null,
                rawLine: parsed.rawLine ?? lines[i],
            });
        }
    }
    return tasks;
}
