import { visit } from 'unist-util-visit';
import { v4 as uuidv4 } from 'uuid';

export interface ParsedBlock {
  id: string;
  parentId?: string;
  order: number;
  depth: number; // 0 = top-level
  textMd: string;
  textPlain: string;
  links: { kind: 'wikilink' | 'url'; target: string }[];
  tags: string[];
  task?: { state: 'TODO' | 'DOING' | 'DONE'; due?: string; priority?: 'A' | 'B' | 'C' };
}

export function parseMarkdownToBlocks(md: string): { blocks: ParsedBlock[] } {
  // MVP deterministic line-based parser for list bullets
  const lines = md.split(/\r?\n/);
  const blocks: ParsedBlock[] = [];
  const stack: { id: string; depth: number }[] = [];
  let siblingOrders: number[] = []; // per depth

  const ID_MARKER_RE = /<!--\s*\{id:\s*([0-9a-fA-F-]{36})\}\s*-->/;
  const WIKILINK = /\[\[([^\]]+)\]\]/g;
  const URL = /https?:\/\/\S+/g;
  const TAG = /(^|\s)#([A-Za-z0-9\-_]+)/g;

  for (const rawLine of lines) {
    const m = rawLine.match(/^(\s*)-\s+(.*)$/);
    if (!m) continue;
    const indent = m[1] ?? '';
    const rest = m[2] ?? '';
    const depth = Math.floor((indent.replace(/\t/g, '  ').length) / 2);

    // Ensure ID extraction
    const idMatch = rawLine.match(ID_MARKER_RE);
    const id = idMatch ? idMatch[1] : uuidv4(); // should already exist due to ensure pass

    // Determine parent by depth
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    const parentId = stack.length ? stack[stack.length - 1].id : undefined;

    // Order
    siblingOrders[depth] = (siblingOrders[depth] ?? 0) + 1;
    for (let d = depth + 1; d < siblingOrders.length; d++) siblingOrders[d] = 0; // reset deeper levels

    // Extract links and tags FIRST before any text processing
    const links: ParsedBlock['links'] = [];
    const tags: string[] = [];
    let m2: RegExpExecArray | null;

    // Extract wikilinks from original text
    WIKILINK.lastIndex = 0;
    while ((m2 = WIKILINK.exec(rest))) links.push({ kind: 'wikilink', target: m2[1] });

    // Extract URLs from original text
    URL.lastIndex = 0;
    while ((m2 = URL.exec(rest))) links.push({ kind: 'url', target: m2[0] });

    // Extract tags from original text
    TAG.lastIndex = 0;
    while ((m2 = TAG.exec(rest))) tags.push(m2[2]);

    // Updated task parsing for checkbox syntax
    let textBody = rest;
    let task: ParsedBlock['task'] | undefined;

    // Check for checkbox syntax: [ ], [x], with optional (Doing) modifier
    const checkboxMatch = textBody.match(/^(\[[ x]\])\s*(?:\(([^)]+)\))?\s*(.*)$/);
    if (checkboxMatch) {
      const checkbox = checkboxMatch[1];
      const modifier = checkboxMatch[2]?.toLowerCase();
      const taskText = checkboxMatch[3];

      if (checkbox === '[x]') {
        task = { state: 'DONE' };
      } else if (modifier === 'doing') {
        task = { state: 'DOING' };
      } else {
        task = { state: 'TODO' };
      }
      textBody = taskText;
    }

    // Plain text normalization (strip markup minimal)
    const textPlain = textBody
      .replace(WIKILINK, (_, t) => t)
      .replace(TAG, (_, s, t) => ` ${t}`)
      .replace(URL, (u) => u)
      .replace(ID_MARKER_RE, '') // Remove UUID markers from search text
      .trim();

    const block: ParsedBlock = {
      id,
      parentId,
      order: siblingOrders[depth],
      depth,
      textMd: rawLine.trimEnd(),
      textPlain: textPlain.trim(),
      links,
      tags,
      task,
    };

    blocks.push(block);
    stack.push({ id, depth });
  }

  return { blocks };
}