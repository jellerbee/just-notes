"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMarkdownToBlocks = parseMarkdownToBlocks;
const uuid_1 = require("uuid");
function parseMarkdownToBlocks(md) {
    // MVP deterministic line-based parser for list bullets
    const lines = md.split(/\r?\n/);
    const blocks = [];
    const stack = [];
    let siblingOrders = []; // per depth
    const ID_MARKER_RE = /<!--\s*\{id:\s*([0-9a-fA-F-]{36})\}\s*-->/;
    const WIKILINK = /\[\[([^\]]+)\]\]/g;
    const URL = /https?:\/\/\S+/g;
    const TAG = /(^|\s)#([A-Za-z0-9\-_]+)/g;
    for (const rawLine of lines) {
        const m = rawLine.match(/^(\s*)-\s+(.*)$/);
        if (!m)
            continue;
        const indent = m[1] ?? '';
        const rest = m[2] ?? '';
        const depth = Math.floor((indent.replace(/\t/g, '  ').length) / 2);
        // Ensure ID extraction
        const idMatch = rawLine.match(ID_MARKER_RE);
        const id = idMatch ? idMatch[1] : (0, uuid_1.v4)(); // should already exist due to ensure pass
        // Determine parent by depth
        while (stack.length && stack[stack.length - 1].depth >= depth)
            stack.pop();
        const parentId = stack.length ? stack[stack.length - 1].id : undefined;
        // Order
        siblingOrders[depth] = (siblingOrders[depth] ?? 0) + 1;
        for (let d = depth + 1; d < siblingOrders.length; d++)
            siblingOrders[d] = 0; // reset deeper levels
        // Updated task parsing for checkbox syntax
        let textBody = rest;
        let task;
        // Check for checkbox syntax: [ ], [x], with optional (Doing) modifier
        const checkboxMatch = textBody.match(/^(\[[ x]\])\s*(?:\(([^)]+)\))?\s*(.*)$/);
        if (checkboxMatch) {
            const checkbox = checkboxMatch[1];
            const modifier = checkboxMatch[2]?.toLowerCase();
            const taskText = checkboxMatch[3];
            if (checkbox === '[x]') {
                task = { state: 'DONE' };
            }
            else if (modifier === 'doing') {
                task = { state: 'DOING' };
            }
            else {
                task = { state: 'TODO' };
            }
            textBody = taskText;
        }
        // Plain text normalization (strip markup minimal)
        const textPlain = textBody
            .replace(WIKILINK, (_, t) => t)
            .replace(TAG, (_, s, t) => ` ${t}`)
            .replace(URL, (u) => u);
        const links = [];
        let m2;
        WIKILINK.lastIndex = 0; // Reset regex state
        while ((m2 = WIKILINK.exec(textBody)))
            links.push({ kind: 'wikilink', target: m2[1] });
        URL.lastIndex = 0;
        while ((m2 = URL.exec(textBody)))
            links.push({ kind: 'url', target: m2[0] });
        const tags = [];
        TAG.lastIndex = 0;
        while ((m2 = TAG.exec(textBody)))
            tags.push(m2[2]);
        const block = {
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
