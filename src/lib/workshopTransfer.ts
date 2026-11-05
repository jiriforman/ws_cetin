// Export / import of everything editable in the admin console as ONE file (Excel workbook or JSON).
// Rich text is stored as HTML and travels through both formats unchanged.
import type { Phase, Section, Team, Tool } from '@/lib/workshopData';

type Kind = 'text' | 'html' | 'int' | 'bool' | 'list' | 'enum';

interface Field {
  key: string;
  kind: Kind;
  help: string;
  width?: number;
  required?: boolean;
  readOnly?: boolean;
  options?: readonly string[];
}

export type EntityKey = 'teams' | 'phases' | 'tools' | 'sections';

interface Entity {
  key: EntityKey;
  sheet: string;
  canCreate: boolean;
  canDelete: boolean;
  fields: Field[];
}

const ID_EXISTING: Field = { key: 'id', kind: 'text', width: 16, readOnly: true, help: 'Identifies the row. Do not change.' };
const ID_CREATABLE: Field = { key: 'id', kind: 'text', width: 16, help: 'Keep for existing rows. Leave empty to create a new one.' };

export const ENTITIES: Entity[] = [
  {
    key: 'phases',
    sheet: 'Phases',
    canCreate: true,
    canDelete: true,
    fields: [
      ID_CREATABLE,
      { key: 'order', kind: 'int', width: 8, help: 'Position in the list (1, 2, 3, ...).' },
      { key: 'name', kind: 'text', width: 30, required: true, help: 'Required.' },
      { key: 'duration_minutes', kind: 'int', width: 18, help: 'Whole number of minutes.' },
      { key: 'budget', kind: 'int', width: 10, help: 'Whole number.' },
      { key: 'tools', kind: 'list', width: 30, help: 'Comma separated tool names from the Tools sheet (including tools added in this file).' },
      { key: 'background', kind: 'html', width: 60, help: 'Rich text as HTML (<p>, <b>, <i>, <ul><li>, <h2>, <a href>, video embeds...).' },
      { key: 'task', kind: 'html', width: 60, help: 'Rich text as HTML.' },
      { key: 'materials', kind: 'html', width: 60, help: 'Rich text as HTML.' },
      { key: 'output', kind: 'html', width: 60, help: 'Rich text as HTML.' },
      { key: 'evaluation', kind: 'html', width: 60, help: 'How the phase turned out, as rich text HTML (plain text is still accepted).' },
      { key: 'learnings_visible', kind: 'bool', width: 18, help: 'TRUE to publish learnings in phase details and the summary; FALSE to hide.' },
      { key: 'learnings_project_management', kind: 'html', width: 60, help: 'Project management learnings as HTML bullet points.' },
      { key: 'learnings_ai_arsenal', kind: 'html', width: 60, help: 'AI Arsenal learnings as HTML bullet points.' },
      { key: 'cheat_sheet', kind: 'html', width: 60, help: 'Cheat sheet shown on the unlisted /cheat page, as HTML.' },
      { key: 'parallel_with', kind: 'text', width: 24, help: 'Name of the phase this one runs in parallel with (team splits in half). Empty = runs alone. Set on both phases.' },
      { key: 'status', kind: 'text', width: 12, readOnly: true, help: 'Read only - controlled from the admin console.' },
    ],
  },
  {
    key: 'tools',
    sheet: 'Tools',
    canCreate: true,
    canDelete: true,
    fields: [
      ID_CREATABLE,
      { key: 'display_order', kind: 'int', width: 14, help: 'Position on the AI Arsenal page.' },
      { key: 'tool_name', kind: 'text', width: 24, required: true, help: 'Required. Phases refer to tools by this name.' },
      { key: 'description', kind: 'text', width: 60, help: 'Plain text.' },
      { key: 'link_url', kind: 'text', width: 40, help: 'https://...' },
      { key: 'logo_url', kind: 'text', width: 40, help: 'Image URL or /logos/... path.' },
      { key: 'category', kind: 'text', width: 16, help: 'AI Arsenal group: chat, create or build. Empty = Other.' },
      { key: 'visible', kind: 'bool', width: 10, help: 'TRUE or FALSE.' },
    ],
  },
  {
    key: 'sections',
    sheet: 'Content',
    canCreate: false,
    canDelete: false,
    fields: [
      ID_EXISTING,
      { key: 'page_key', kind: 'text', width: 16, readOnly: true, help: 'Read only - which page the section belongs to.' },
      { key: 'enabled', kind: 'bool', width: 10, help: 'TRUE or FALSE.' },
      { key: 'content_rtf', kind: 'html', width: 90, help: 'Page text as HTML.' },
    ],
  },
  {
    key: 'teams',
    sheet: 'Teams',
    canCreate: false,
    canDelete: false,
    fields: [
      ID_EXISTING,
      { key: 'token', kind: 'text', width: 18, readOnly: true, help: 'Read only - the team access link is /team/<token>.' },
      { key: 'name', kind: 'text', width: 24, required: true, help: 'Required.' },
      { key: 'status', kind: 'enum', width: 10, options: ['active', 'disabled'], help: 'active or disabled.' },
      { key: 'logo_url', kind: 'text', width: 40, help: 'Image URL.' },
    ],
  },
];

export type ImportRow = Record<string, string | number | boolean | string[] | null>;
export type ImportPayload = Record<EntityKey, ImportRow[] | undefined>;

export interface Data {
  teams: Team[];
  phases: Phase[];
  tools: Tool[];
  sections: Section[];
}

export const toRows = ({ teams, phases, tools, sections }: Data): Record<EntityKey, ImportRow[]> => {
  const toolName = new Map(tools.map((t) => [t.id, t.toolName]));
  const phaseName = new Map(phases.map((p) => [p.id, p.name]));
  return {
    phases: [...phases]
      .sort((a, b) => a.order - b.order)
      .map((p) => ({
        id: p.id,
        order: p.order,
        name: p.name,
        duration_minutes: p.durationMinutes,
        budget: p.budget,
        tools: p.tools.map((id) => toolName.get(id)).filter((n): n is string => !!n),
        background: p.background,
        task: p.task,
        materials: p.materials,
        output: p.output,
        evaluation: p.evaluation,
        learnings_project_management: p.learningsProjectManagement,
        learnings_ai_arsenal: p.learningsAiArsenal,
        learnings_visible: p.learningsVisible,
        cheat_sheet: p.cheatSheet,
        parallel_with: phaseName.get(p.parallelWith) ?? '',
        status: p.status,
      })),
    tools: [...tools]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((t) => ({
        id: t.id,
        display_order: t.displayOrder,
        tool_name: t.toolName,
        description: t.description,
        link_url: t.linkUrl,
        logo_url: t.logoUrl,
        category: t.category,
        visible: t.visible,
      })),
    sections: [...sections]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((s) => ({ id: s.id, page_key: s.pageKey, enabled: s.enabled, content_rtf: s.contentRTF })),
    teams: [...teams]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => ({
        id: t.id,
        token: t.token ?? '',
        name: t.name,
        status: t.status,
        logo_url: t.logoUrl,
      })),
  };
};

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const fileName = (ext: string) => `narcos-workshop-${new Date().toISOString().slice(0, 10)}.${ext}`;

const instructions = () =>
  Object.fromEntries(
    ENTITIES.map((e) => [
      e.sheet,
      {
        rows: `${e.canCreate ? 'Add rows with an empty id to create. ' : 'Existing rows only. '}${
          e.canDelete ? 'Rows removed from the file can be deleted on import (optional).' : 'Rows cannot be added or deleted.'
        }`,
        columns: Object.fromEntries(e.fields.map((f) => [f.key, f.help])),
      },
    ]),
  );

const cellValue = (value: ImportRow[string]) => (Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : value ?? '');

export const exportWorkshop = async (data: Data, format: 'xlsx' | 'json') => {
  const rows = toRows(data);

  if (format === 'json') {
    const json = {
      _instructions: instructions(),
      ...Object.fromEntries(ENTITIES.map((e) => [e.key, rows[e.key]])),
    };
    download(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }), fileName('json'));
    return;
  }

  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();

  const help = wb.addWorksheet('Instructions');
  help.columns = [
    { header: 'sheet', key: 'sheet', width: 12 },
    { header: 'column', key: 'column', width: 20 },
    { header: 'how to fill', key: 'help', width: 100 },
  ];
  help.getRow(1).font = { bold: true };
  help.addRow({ sheet: 'All', help: 'Rich text columns contain HTML - keep the tags, they are imported exactly as written.' });
  help.addRow({ sheet: 'All', help: 'Grey header = read only (ignored on import). Do not rename sheets or column headers.' });
  help.addRow({ sheet: 'All', help: 'Import: Admin console > Import. A preview is shown before anything is saved.' });
  ENTITIES.forEach((e) => {
    help.addRow({});
    help.addRow({ sheet: e.sheet, help: instructions()[e.sheet].rows }).font = { bold: true };
    e.fields.forEach((f) => help.addRow({ sheet: e.sheet, column: f.key, help: f.help }));
  });

  ENTITIES.forEach((e) => {
    const sheet = wb.addWorksheet(e.sheet, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = e.fields.map((f) => ({ header: f.key, key: f.key, width: f.width ?? 16 }));
    rows[e.key].forEach((row) => sheet.addRow(Object.fromEntries(e.fields.map((f) => [f.key, cellValue(row[f.key])]))));
    sheet.eachRow((row) => (row.alignment = { vertical: 'top', wrapText: true }));
    const header = sheet.getRow(1);
    header.font = { bold: true };
    e.fields.forEach((f, i) => {
      if (f.readOnly && f.key !== 'id') {
        header.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
      }
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  download(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName('xlsx'));
};

const splitList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((v) => String(v).trim()).filter(Boolean)
    : String(value ?? '')
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

const TRUE = ['true', 'yes', 'ano', '1', 'y'];
const FALSE = ['false', 'no', 'ne', '0', 'n'];

/** Converts raw cell/JSON values into typed rows, collecting every validation problem. */
const normalize = (raw: Record<EntityKey, Record<string, unknown>[] | undefined>): ImportPayload => {
  const errors: string[] = [];
  const result = {} as ImportPayload;

  for (const e of ENTITIES) {
    const list = raw[e.key];
    if (!list) continue;
    result[e.key] = list.map((source, i) => {
      const where = `${e.sheet} row ${i + 2}`;
      const row: ImportRow = {};
      const id = String(source.id ?? '').trim();
      row.id = id || null;
      if (!id && !e.canCreate) errors.push(`${where}: "id" is required (new ${e.sheet.toLowerCase()} cannot be added)`);

      for (const f of e.fields) {
        if (f.key === 'id' || f.readOnly) continue;
        // Older workbooks must not erase learnings or cheat sheets added in the admin.
        if ((f.key.startsWith('learnings_') || f.key === 'cheat_sheet') && source[f.key] === undefined) continue;
        const value = source[f.key];
        const empty = value === undefined || value === null || String(value).trim() === '';
        switch (f.kind) {
          case 'int': {
            if (empty) {
              row[f.key] = e.key === 'phases' && f.key === 'order' ? i + 1 : 0;
              break;
            }
            const n = Number(value);
            if (!Number.isInteger(n) || n < 0) errors.push(`${where}: "${f.key}" must be a whole number, got "${value}"`);
            row[f.key] = n;
            break;
          }
          case 'bool': {
            if (typeof value === 'boolean') row[f.key] = value;
            else if (empty) row[f.key] = true;
            else {
              const s = String(value).trim().toLowerCase();
              if (TRUE.includes(s)) row[f.key] = true;
              else if (FALSE.includes(s)) row[f.key] = false;
              else errors.push(`${where}: "${f.key}" must be TRUE or FALSE, got "${value}"`);
            }
            break;
          }
          case 'list': {
            const items = splitList(value);
            if (f.options) {
              const lower = items.map((s) => s.toLowerCase());
              lower.filter((s) => !f.options!.includes(s)).forEach((s) => errors.push(`${where}: unknown ${f.key} "${s}" (use ${f.options!.join(', ')})`));
              row[f.key] = lower;
            } else row[f.key] = items;
            break;
          }
          case 'enum': {
            const s = String(value ?? '').trim().toLowerCase();
            if (empty) row[f.key] = f.options![0];
            else if (!f.options!.includes(s)) errors.push(`${where}: "${f.key}" must be one of ${f.options!.join(', ')}, got "${value}"`);
            else row[f.key] = s;
            break;
          }
          default:
            row[f.key] = empty ? '' : f.kind === 'html' ? String(value) : String(value).trim();
        }
        if (f.required && !row[f.key]) errors.push(`${where}: "${f.key}" is required`);
      }
      return row;
    });

    const ids = result[e.key]!.map((r) => r.id).filter(Boolean);
    ids.filter((id, i) => ids.indexOf(id) !== i).forEach((id) => errors.push(`${e.sheet}: id "${id}" appears more than once`));
  }

  // Phase tool names must exist in the imported Tools sheet (or the current tools if not imported)
  if (result.phases && result.tools) {
    const names = new Set(result.tools.map((t) => String(t.tool_name).toLowerCase()));
    result.phases.forEach((p, i) =>
      (p.tools as string[]).filter((t) => !names.has(t.toLowerCase())).forEach((t) => errors.push(`Phases row ${i + 2}: unknown tool "${t}"`)),
    );
  }

  if (errors.length) throw new Error(errors.join('\n'));
  if (!ENTITIES.some((e) => result[e.key]?.length)) throw new Error('The file contains no data');
  return result;
};

export const parseWorkshopFile = async (file: File): Promise<ImportPayload> => {
  const raw = {} as Record<EntityKey, Record<string, unknown>[] | undefined>;

  if (file.name.toLowerCase().endsWith('.json')) {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(await file.text());
    } catch {
      throw new Error('The file is not valid JSON');
    }
    for (const e of ENTITIES) {
      const list = data[e.key];
      if (list !== undefined && !Array.isArray(list)) throw new Error(`"${e.key}" must be an array`);
      raw[e.key] = list as Record<string, unknown>[] | undefined;
    }
    return normalize(raw);
  }

  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error('The file is not a valid .xlsx workbook');
  }
  for (const e of ENTITIES) {
    const sheet = wb.getWorksheet(e.sheet);
    if (!sheet) continue;
    const header = new Map<number, string>();
    sheet.getRow(1).eachCell((cell, col) => header.set(col, cell.text.trim().toLowerCase()));
    const rows: Record<string, unknown>[] = [];
    sheet.eachRow((row, n) => {
      if (n === 1) return;
      const obj: Record<string, unknown> = {};
      header.forEach((key, col) => (obj[key] = row.getCell(col).text));
      if (Object.entries(obj).some(([k, v]) => k !== 'status' && String(v).trim())) rows.push(obj);
    });
    raw[e.key] = rows;
  }
  return normalize(raw);
};

export interface EntityDiff {
  changed: { label: string; fields: string[] }[];
  unchanged: number;
  created: string[];
  unknown: string[];
  missing: { id: string; label: string }[];
}

const LABEL_FIELD: Record<EntityKey, string> = { phases: 'name', tools: 'tool_name', sections: 'page_key', teams: 'name' };

const comparable = (value: unknown) => {
  if (Array.isArray(value)) return JSON.stringify(value.map((v) => String(v).toLowerCase()));
  if (value === null || value === undefined) return '';
  return String(value);
};

/** Compares an import file with the current data: which rows and fields would change. */
export const diffImport = (payload: ImportPayload, data: Data): Partial<Record<EntityKey, EntityDiff>> => {
  const current = toRows(data);
  const result: Partial<Record<EntityKey, EntityDiff>> = {};
  for (const e of ENTITIES) {
    const rows = payload[e.key];
    if (!rows) continue;
    const byId = new Map(current[e.key].map((r) => [String(r.id), r]));
    const labelOf = (r: ImportRow) => String(r[LABEL_FIELD[e.key]] ?? byId.get(String(r.id))?.[LABEL_FIELD[e.key]] ?? r.id);
    const editable = e.fields.filter((f) => f.key !== 'id' && !f.readOnly).map((f) => f.key);
    const diff: EntityDiff = { changed: [], unchanged: 0, created: [], unknown: [], missing: [] };
    for (const row of rows) {
      if (!row.id) {
        diff.created.push(labelOf(row));
        continue;
      }
      const existing = byId.get(String(row.id));
      if (!existing) {
        diff.unknown.push(String(row.id));
        continue;
      }
      const fields = editable.filter((k) => comparable(existing[k]) !== comparable(row[k]));
      if (fields.length) diff.changed.push({ label: labelOf(row), fields });
      else diff.unchanged++;
    }
    const fileIds = new Set(rows.map((r) => String(r.id)));
    diff.missing = current[e.key]
      .filter((r) => !fileIds.has(String(r.id)))
      .map((r) => ({ id: String(r.id), label: String(r[LABEL_FIELD[e.key]] ?? r.id) }));
    result[e.key] = diff;
  }
  return result;
};
