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
// Allow empty checkbox (space), x/X for done, and common symbols
const TASK_LINE_REGEX = /^(\s*)([-*+]|\d+\.)\s*\[\s*([ xX\-\/\+\?])\s*\]\s*(.*)$/;

// Inline dataview-like field: [due:: 2023-07-12] or (due:: 2023-07-12)
const INLINE_FIELD_REGEX = /(?:\[|\()\s*([^:\]\)]+?)::\s*([^\]\)]+?)\s*(?:\]|\))/g;
// Bare inline like: due:: 2023-07-12 or scheduled:: 2026-07-01 (without brackets)
const BARE_INLINE_REGEX = /(?:^|\s)(due(?: date|_date)?|scheduled|schedule|start)::\s*([^\s#)\]]+)/i;

/**
 * Try to extract a date from text using several heuristics:
 * - emoji date like 📅 YYYY-MM-DD
 * - dataview inline field due:: YYYY-MM-DD
 * - explicit `due on YYYY-MM-DD` or `due YYYY-MM-DD`
 * - natural language via chrono (supports Chinese like 明天/下周一)
 */
function parseDateCandidate(val: string | null | undefined): moment.Moment | null {
    if (!val) return null;
    const v = (val || '').trim();
    // direct yyyy-mm-dd
    const simple = v.match(/([0-9]{4}-[0-9]{2}-[0-9]{2})/);
    if (simple) return moment(simple[1], 'YYYY-MM-DD');

    try {
        const parsed = chrono.parseDate(v, new Date());
        if (parsed) return moment(parsed);
    } catch (e) {
        // ignore
    }
    return null;
}

function extractDate(text: string): { due: moment.Moment | null; scheduled: moment.Moment | null } {
    let due: moment.Moment | null = null;
    let scheduled: moment.Moment | null = null;
    if (!text) return { due, scheduled };

    // emoji date (📅 yyyy-mm-dd) or other emoji like 🗓️
    const emojiMatch = text.match(/📅\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/);
    if (emojiMatch) {
        due = moment(emojiMatch[1], 'YYYY-MM-DD');
    }

    // inline fields: parse all and pick due/scheduled if present
    let m: RegExpExecArray | null;
    INLINE_FIELD_REGEX.lastIndex = 0;
    while ((m = INLINE_FIELD_REGEX.exec(text)) !== null) {
        const key = (m[1] || '').trim().toLowerCase();
        const val = (m[2] || '').trim();
        if (!key) continue;
        if (key.includes('due')) {
            const p = parseDateCandidate(val);
            if (p) due = p;
        } else if (key.includes('schedule') || key.includes('scheduled') || key.includes('start')) {
            const p = parseDateCandidate(val);
            if (p) scheduled = p;
        }
    }

    // bare inline fields like `due:: 2026-07-25` (without brackets)
    const bare = text.match(BARE_INLINE_REGEX);
    if (bare) {
        const key = (bare[1] || '').trim().toLowerCase();
        const val = (bare[2] || '').trim();
        if (key.includes('due')) {
            const p = parseDateCandidate(val);
            if (p) due = p;
        } else if (key.includes('schedule') || key.includes('scheduled') || key.includes('start')) {
            const p = parseDateCandidate(val);
            if (p) scheduled = p;
        }
    }

    // explicit due on yyyy-mm-dd
    const dueMatch = text.match(/due(?: on)?\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
    if (dueMatch) due = moment(dueMatch[1], 'YYYY-MM-DD');

    // natural language via chrono (only if not already set)
    if (!due) {
        try {
            const parsed = chrono.parseDate(text, new Date());
            if (parsed) due = moment(parsed);
        } catch (e) {
            // ignore
        }
    }

    return { due, scheduled };
}

export function parseTaskLine(line: string): Partial<TaskLite> | null {
    const m = line.match(TASK_LINE_REGEX);
    if (!m) return null;

    const indentation = m[1] ?? '';
    const listMarker = m[2] ?? '-';
    const statusSymbol = (m[3] || ' ') as string;
    let body = m[4] ?? '';

    // Extract inline fields and remove them from body for a cleaner description
    const inlineFields: { [k: string]: string } = {};
    let im: RegExpExecArray | null;
    INLINE_FIELD_REGEX.lastIndex = 0;
    while ((im = INLINE_FIELD_REGEX.exec(body)) !== null) {
        const key = (im[1] || '').trim();
        const val = (im[2] || '').trim();
        if (key) inlineFields[key.toLowerCase()] = val;
    }

    // Also detect bare inline fields like `due:: 2026-07-25` in the body
    const bareMatch = body.match(BARE_INLINE_REGEX);
    if (bareMatch) {
        const key = (bareMatch[1] || '').trim().toLowerCase();
        const val = (bareMatch[2] || '').trim();
        if (key) inlineFields[key.toLowerCase()] = val;
    }

    // Remove inline fields from body (bracketed ones). Note: bare inline remains in body if not removed explicitly; remove it now.
    body = body.replace(INLINE_FIELD_REGEX, '').replace(BARE_INLINE_REGEX, '').trim();

    // Emoji date removal (keep parsed info but remove token from description)
    body = body.replace(/📅\s*[0-9]{4}-[0-9]{2}-[0-9]{2}/g, '').trim();

    // Tags: match #tag or #tag/subtag ... allow Chinese chars; capture full tag including '/'
    const tagRegex = /#([^\s#]+)/g;
    const tags: string[] = [];
    let tm: RegExpExecArray | null;
    tagRegex.lastIndex = 0;
    while ((tm = tagRegex.exec(body)) !== null) {
        // tm[0] includes leading '#'
        tags.push(tm[0]);
    }

    // Clean description: optionally remove tags from description for display cleanliness
    let cleanDescription = body.replace(tagRegex, '').trim();

    // If description becomes empty (e.g., line was just tags), keep original trimmed body
    if (!cleanDescription) cleanDescription = body;

    // Try to parse dates from either inline fields or remaining text
    let due: moment.Moment | null = null;
    let scheduled: moment.Moment | null = null;

    // Inline fields precedence
    if (inlineFields['due'] || inlineFields['due date'] || inlineFields['due_date']) {
        due = parseDateCandidate(inlineFields['due'] || inlineFields['due date'] || inlineFields['due_date']);
    }
    if (inlineFields['scheduled'] || inlineFields['schedule'] || inlineFields['start']) {
        scheduled = parseDateCandidate(inlineFields['scheduled'] || inlineFields['schedule'] || inlineFields['start']);
    }

    // fallback parsing
    const extracted = extractDate(line);
    if (!due && extracted.due) due = extracted.due;
    if (!scheduled && extracted.scheduled) scheduled = extracted.scheduled;

    return {
        indentation,
        listMarker,
        statusSymbol,
        description: cleanDescription,
        tags,
        dueDate: due,
        scheduledDate: scheduled,
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
