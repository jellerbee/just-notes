import { Mark, mergeAttributes } from '@tiptap/core'

export interface WikilinkOptions {
  HTMLAttributes: Record<string, any>
  onNavigate?: (target: string) => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikilink: {
      /**
       * Set a wikilink mark
       */
      setWikilink: (target: string) => ReturnType
      /**
       * Toggle a wikilink mark
       */
      toggleWikilink: (target: string) => ReturnType
      /**
       * Unset a wikilink mark
       */
      unsetWikilink: () => ReturnType
    }
  }
}

export const Wikilink = Mark.create<WikilinkOptions>({
  name: 'wikilink',

  addOptions() {
    return {
      HTMLAttributes: {},
      onNavigate: undefined,
    }
  },

  addAttributes() {
    return {
      target: {
        default: null,
        parseHTML: element => element.getAttribute('data-target'),
        renderHTML: attributes => {
          if (!attributes.target) {
            return {}
          }
          return {
            'data-target': attributes.target,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-wikilink]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        {
          'data-wikilink': 'true',
          class: 'wikilink',
        }
      ),
      0,
    ]
  },

  addCommands() {
    return {
      setWikilink:
        (target: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { target })
        },
      toggleWikilink:
        (target: string) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, { target })
        },
      unsetWikilink:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      // Prevent editing inside wikilinks
      Backspace: ({ editor }) => {
        const { $from } = editor.state.selection
        const marks = $from.marks()
        const hasWikilink = marks.some(mark => mark.type.name === 'wikilink')

        // Allow backspace in wikilinks (they're in committed bullets anyway)
        return false
      },
    }
  },
})
