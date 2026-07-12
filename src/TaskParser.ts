/**
 * Lightweight Task parser (PoC)
 *
 * parseFileContent(content, path) => TaskLite[]
 *
 * NOTE: This is a simplified parser for PoC. Later iterations should:
 * - support dataview inline fields
 * - support recurring tasks parsing (rrule)
 * - support more status symbols and custom task formats
 */

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

const TASK_LINE_REGEX = /^(\s*)([-*+]|\d+\.)\s*\[([ xX\-\/\+?])\]\s*(.*)$/;

/**
 * Parse single line into TaskLite partial (doesn't set id).
 */
export function parseTaskLine(line: string): Partial<TaskLite> | null {
    const m = line.match(TASK_LINE_REGEX);
    if (!m) return null;

    const indentation = m[1] ?? '';
    const listMarker = m[2] ?? '-';
    const statusSymbol = m[3] ?? ' ';
    const body = m[4] ?? '';

    // Extract tags of form #tag or #tag/subtag
    const tags = Array.from(body.matchAll(/#([^\s#\/][^\s#]*)/g)).map((v) => v[0]);

    // Try simple date extraction (emoji or "due on YYYY-MM-DD" or dataview-like)
    let dueDate: moment.Moment | null = null;
    const emojiDateMatch = body.match(/📅\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/);
    if (emojiDateMatch) {
        dueDate = moment(emojiDateMatch[1], 'YYYY-MM-DD');
    } else {
        const dueMatch = body.match(/due (?:on )?([0-9]{4}-[0-9]{2}-[0-9]{2})/);
        if (dueMatch) {
            dueDate = moment(dueMatch[1], 'YYYY-MM-DD');
        }
    }

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

/**
 * Parse entire file content into TaskLite[] with line numbers
 */
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
