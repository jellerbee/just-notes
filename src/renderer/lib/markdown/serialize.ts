// For MVP, we primarily edit raw Markdown text in the editor and write it back directly.
// If you choose to round-trip ProseMirror JSON <-> Markdown, add proper serializers here.
export function serializePMToMarkdown(_pmDoc: unknown): string {
  // TODO: implement if/when using rich JSON doc. For MVP, the editor can operate on plaintext.
  return '';
}