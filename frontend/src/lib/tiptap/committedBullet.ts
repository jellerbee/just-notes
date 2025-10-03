// Custom Tiptap extension for committed (read-only) bullets
import { Node, mergeAttributes } from '@tiptap/core'

export interface CommittedBulletOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    committedBullet: {
      setCommittedBullet: (attrs: { bulletId: string; text: string }) => ReturnType
    }
  }
}

export const CommittedBullet = Node.create<CommittedBulletOptions>({
  name: 'committedBullet',
  group: 'block',
  content: 'text*',

  addAttributes() {
    return {
      bulletId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-bullet-id'),
        renderHTML: (attributes) => {
          return {
            'data-bullet-id': attributes.bulletId,
          }
        },
      },
      committed: {
        default: true,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'li[data-committed="true"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'li',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-committed': 'true',
        contenteditable: 'false',
        class: 'committed-bullet',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setCommittedBullet:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
            content: [{ type: 'text', text: attrs.text }],
          })
        },
    }
  },
})
