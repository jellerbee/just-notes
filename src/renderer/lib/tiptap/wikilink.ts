import { Node, mergeAttributes } from '@tiptap/core'

export const Wikilink = Node.create({
  name: 'wikilink',
  inline: true,
  group: 'inline',
  atom: true,
  addAttributes() { return { target: { default: '' } } },
  parseHTML() { return [{ tag: 'span[data-wikilink]' }] },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-wikilink': 'true' }), `[[${HTMLAttributes.target}]]`]
  },
});

// TODO: input rules to transform typing `[[` opens suggestions and inserts a wikilink node.