import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import ListItem from '@tiptap/extension-list-item'
import { v4 as uuidv4 } from 'uuid'
import { api } from '@/lib/api'
import type { Span } from '@/types'
import { Wikilink } from '@/extensions/Wikilink'
import { RedactionModal } from './RedactionModal'

interface WikilinkSuggestion {
  title: string
  noteId: string
}

interface BulletEditorProps {
  noteId: string
  noteDate: string
  noteType: 'daily' | 'named'
  scrollToBulletId?: string
  onNavigatePrevious: () => void
  onNavigateNext: () => void
  onNavigateToNote: (noteDate: string) => void
  onNavigateToToday: () => void
}

function BulletEditor({ noteId, noteDate, noteType, scrollToBulletId, onNavigatePrevious, onNavigateNext, onNavigateToNote, onNavigateToToday }: BulletEditorProps) {
  const lastCommittedIdRef = useRef<string | null>(null)

  // Wikilink autocomplete state
  const [wikilinkQuery, setWikilinkQuery] = useState<string | null>(null)
  const [wikilinkSuggestions, setWikilinkSuggestions] = useState<WikilinkSuggestion[]>([])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const wikilinkTriggerPosRef = useRef<number | null>(null)
  const [wikilinkDropdownPos, setWikilinkDropdownPos] = useState<{ top: number; left: number } | null>(null)

  // Tag autocomplete state
  const [tagQuery, setTagQuery] = useState<string | null>(null)
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const [selectedTagIndex, setSelectedTagIndex] = useState(0)
  const tagTriggerPosRef = useRef<number | null>(null)
  const [tagDropdownPos, setTagDropdownPos] = useState<{ top: number; left: number } | null>(null)

  // Error handling state
  const [commitError, setCommitError] = useState<string | null>(null)
  const [failedBulletText, setFailedBulletText] = useState<string | null>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    bulletId: string
    bulletText: string
    position: { x: number; y: number }
  } | null>(null)

  // Redaction modal state
  const [redactionModalOpen, setRedactionModalOpen] = useState(false)
  const [bulletToRedact, setBulletToRedact] = useState<{
    bulletId: string
    bulletText: string
  } | null>(null)

  // Hide redacted bullets toggle
  const [hideRedacted, setHideRedacted] = useState(false)

  // Single Tiptap editor - handles everything inline like Word
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Only allow bullets, no other formatting for now
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        blockquote: false,
        orderedList: false,
        bulletList: true,
        listItem: false, // Disable default listItem, we'll add our own
        paragraph: true,
        bold: true,
        italic: true,
        code: true,
        history: {
          depth: 100,
        },
      }),
      // Add custom listItem with support for data-committed attribute
      ListItem.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            'data-committed': {
              default: null,
              parseHTML: element => element.getAttribute('data-committed'),
              renderHTML: attributes => {
                if (!attributes['data-committed']) return {}
                return { 'data-committed': attributes['data-committed'] }
              },
            },
            'data-bullet-id': {
              default: null,
              parseHTML: element => element.getAttribute('data-bullet-id'),
              renderHTML: attributes => {
                if (!attributes['data-bullet-id']) return {}
                return { 'data-bullet-id': attributes['data-bullet-id'] }
              },
            },
            'data-redacted': {
              default: null,
              parseHTML: element => element.getAttribute('data-redacted'),
              renderHTML: attributes => {
                if (!attributes['data-redacted']) return {}
                return { 'data-redacted': attributes['data-redacted'] }
              },
            },
            style: {
              default: null,
              parseHTML: element => element.getAttribute('style'),
              renderHTML: attributes => {
                if (!attributes.style) return {}
                return { style: attributes.style }
              },
            },
          }
        },
      }),
      // Add wikilink extension for clickable links
      Wikilink.configure({
        HTMLAttributes: {
          class: 'wikilink',
        },
      }),
    ],
    content: '<ul><li></li></ul>', // Start with one bullet
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'bullet-editor',
      },
      handlePaste: (view, event, slice) => {
        // Prevent pasted committed bullets from making current bullet committed
        // We need to transform the slice content to remove committed attributes
        const { state } = view
        const { tr } = state

        // Get the pasted HTML from clipboard
        const html = event.clipboardData?.getData('text/html')
        console.log('[BulletEditor] Pasted HTML:', html)

        // If there's HTML, clean it and let the browser handle plain text paste
        if (html && (html.includes('data-committed') || html.includes('data-bullet-id'))) {
          event.preventDefault()

          // Get plain text instead
          const text = event.clipboardData?.getData('text/plain')
          if (text) {
            // Insert as plain text
            const transaction = state.tr.insertText(text)
            view.dispatch(transaction)
            return true
          }
        }

        // Let Tiptap handle normal paste
        return false
      },
      handleKeyDown: (view, event) => {
        const { state } = view
        const { selection } = state

        // Handle tag autocomplete navigation
        if (tagQuery !== null && tagSuggestions.length > 0) {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setSelectedTagIndex((prev) =>
              prev < tagSuggestions.length - 1 ? prev + 1 : prev
            )
            return true
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setSelectedTagIndex((prev) => (prev > 0 ? prev - 1 : prev))
            return true
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            if (tagSuggestions[selectedTagIndex]) {
              selectTagSuggestion(tagSuggestions[selectedTagIndex])
            }
            return true
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            setTagQuery(null)
            setTagSuggestions([])
            tagTriggerPosRef.current = null
            return true
          }
        }

        // Handle wikilink autocomplete navigation
        if (wikilinkQuery !== null && wikilinkSuggestions.length > 0) {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setSelectedSuggestionIndex((prev) =>
              prev < wikilinkSuggestions.length - 1 ? prev + 1 : prev
            )
            return true
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : prev))
            return true
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            if (wikilinkSuggestions[selectedSuggestionIndex]) {
              selectWikilinkSuggestion(wikilinkSuggestions[selectedSuggestionIndex])
            }
            return true
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            setWikilinkQuery(null)
            setWikilinkSuggestions([])
            wikilinkTriggerPosRef.current = null
            return true
          }
        }

        // Check if cursor is in a committed bullet
        // Find the INNERMOST (closest) listItem containing the cursor
        let isInCommittedBullet = false
        let currentListItem = null
        let currentListItemPos = -1

        state.doc.descendants((node, pos) => {
          if (node.type.name === 'listItem' &&
              pos < selection.from &&
              pos + node.nodeSize > selection.from) {
            // Always update - this way we get the innermost (last found) listItem
            currentListItem = node
            currentListItemPos = pos
            isInCommittedBullet = node.attrs['data-committed'] === 'true'
          }
        })

        // If in committed bullet, block all text-modifying keys
        if (isInCommittedBullet) {
          // Allow navigation keys (arrows, home, end, etc.)
          const navigationKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                                  'Home', 'End', 'PageUp', 'PageDown']

          // Allow copy operations (Cmd/Ctrl+C, Cmd/Ctrl+A for select all)
          const isCopy = (event.metaKey || event.ctrlKey) && event.key === 'c'
          const isSelectAll = (event.metaKey || event.ctrlKey) && event.key === 'a'

          if (navigationKeys.includes(event.key) || isCopy || isSelectAll) {
            return false // Allow these keys
          }

          // Special handling for Enter in committed bullet
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()

            // Find the next list item after this committed one
            let nextListItemPos = -1
            let nextListItem = null
            const currentPos = selection.from

            state.doc.descendants((node, pos) => {
              if (node.type.name === 'listItem' && pos > currentListItemPos) {
                nextListItemPos = pos
                nextListItem = node
                return false
              }
            })

            if (nextListItem && nextListItem.attrs['data-committed'] !== 'true') {
              // There's an uncommitted bullet below - move cursor to end of it
              const textContent = nextListItem.textContent || ''
              // Find the paragraph node inside the list item and move to its end
              let paragraphPos = -1
              nextListItem.descendants((node, pos) => {
                if (node.type.name === 'paragraph') {
                  paragraphPos = nextListItemPos + 1 + pos
                  return false
                }
              })

              if (paragraphPos >= 0) {
                const endPos = paragraphPos + 1 + textContent.length
                // Use setTextSelection to avoid any formatting side effects
                editor?.commands.setTextSelection(endPos)
              }
            } else {
              // No uncommitted bullet below - create a new one at the end of current list
              // List items need a paragraph wrapper
              editor?.commands.insertContentAt(state.doc.content.size - 1, '<li><p></p></li>')
              // Move cursor to the new bullet
              setTimeout(() => {
                if (editor) {
                  const newState = editor.state

                  // Find the second-to-last paragraph (inside the new empty bullet)
                  const paragraphs: number[] = []
                  newState.doc.descendants((node, pos) => {
                    if (node.type.name === 'paragraph') {
                      paragraphs.push(pos)
                    }
                  })

                  if (paragraphs.length >= 2) {
                    const emptyBulletParaPos = paragraphs[paragraphs.length - 2]
                    editor.commands.setTextSelection({ from: emptyBulletParaPos + 1, to: emptyBulletParaPos + 1 })
                    editor.commands.focus()
                  }
                }
              }, 10)
            }

            return true
          }

          // Block everything else (typing, paste, delete, backspace, etc.)
          event.preventDefault()
          return true
        }

        // Enter - commit current bullet (only works on uncommitted bullets now)
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          handleCommit(view)
          return true
        }

        // Tab/Shift+Tab - let Tiptap handle indent/outdent natively
        // (Do not intercept - return false to allow default behavior)

        return false
      },
    },
  })

  const handleCommit = async (view: any) => {
    if (!editor) return

    const { state } = view
    const { selection, doc } = state

    // Get current list item node - find INNERMOST (closest) listItem
    let listItemNode = null
    let listItemPos = -1

    doc.descendants((node, pos) => {
      if (node.type.name === 'listItem' && pos < selection.from && pos + node.nodeSize > selection.from) {
        // Always update - this way we get the innermost (last found) listItem
        listItemNode = node
        listItemPos = pos
      }
    })

    if (!listItemNode) {
      console.log('[Editor] No list item found at cursor')
      return
    }

    // Don't commit if this bullet is already committed
    if (listItemNode.attrs['data-committed'] === 'true') {
      console.log('[Editor] Cannot commit - bullet already committed')
      return
    }

    // Extract text from list item
    const text = listItemNode.textContent.trim()

    if (!text) {
      console.log('[Editor] Empty bullet, not committing')
      // Just create new bullet
      editor.commands.splitListItem('listItem')
      return
    }

    // Calculate depth from nesting level in Tiptap structure
    // Count how many bulletList ancestors this listItem has
    let depth = 0
    let pos = listItemPos
    doc.nodesBetween(0, doc.content.size, (node, nodePos) => {
      if (nodePos < pos && nodePos + node.nodeSize > pos && node.type.name === 'bulletList') {
        depth++
      }
    })
    depth = Math.max(0, depth - 1) // Subtract 1 because root bulletList doesn't count

    // Find parent: the last committed bullet at depth-1
    let parentId: string | null = null
    if (depth > 0) {
      // Walk backwards from current position to find previous committed bullet at lower depth
      let foundParent = false
      doc.nodesBetween(0, listItemPos, (node, nodePos) => {
        if (foundParent) return false
        if (node.type.name === 'listItem' && node.attrs['data-committed'] === 'true') {
          // Calculate this node's depth
          let nodeDepth = 0
          doc.nodesBetween(0, doc.content.size, (n, nPos) => {
            if (nPos < nodePos && nPos + n.nodeSize > nodePos && n.type.name === 'bulletList') {
              nodeDepth++
            }
          })
          nodeDepth = Math.max(0, nodeDepth - 1)

          // If this is at depth-1, it's our parent
          if (nodeDepth === depth - 1) {
            parentId = node.attrs['data-bullet-id']
            foundParent = true
            return false
          }
        }
      })
    }

    // Generate bullet ID
    const bulletId = uuidv4()

    // Extract spans (wikilinks, tags, URLs)
    const spans = extractSpans(text)

    // Clear any previous errors
    setCommitError(null)
    setFailedBulletText(null)

    // OPTIMISTIC UI UPDATE - Mark as committed and create new bullet immediately
    editor.chain()
      .command(({ tr, state }) => {
        // Mark current bullet as committed
        tr.setNodeMarkup(listItemPos, null, {
          ...listItemNode.attrs,
          'data-bullet-id': bulletId,
          'data-committed': 'true',
        })

        // Apply wikilink marks to make links clickable
        const bulletText = listItemNode.textContent
        const wikilinkRegex = /\[\[([^\]]+)\]\]/g
        let match
        let offset = listItemPos + 1 // +1 to skip listItem node itself and go into its content

        while ((match = wikilinkRegex.exec(bulletText)) !== null) {
          const start = offset + match.index
          const end = start + match[0].length
          const target = match[1]

          tr.addMark(
            start,
            end,
            state.schema.marks.wikilink.create({ target })
          )
        }

        return true
      })
      .splitListItem('listItem')
      .command(({ tr, state }) => {
        // Clear committed attributes from the new bullet (splitListItem copies attrs)
        // Find the new list item
        let newListItemPos = -1
        state.doc.descendants((node, pos) => {
          if (node.type.name === 'listItem' && pos > listItemPos) {
            newListItemPos = pos
            return false
          }
        })

        if (newListItemPos >= 0) {
          const newNode = state.doc.nodeAt(newListItemPos)
          if (newNode) {
            const cleanAttrs = { ...newNode.attrs }
            delete cleanAttrs['data-committed']
            delete cleanAttrs['data-bullet-id']
            tr.setNodeMarkup(newListItemPos, null, cleanAttrs)
          }
        }
        return true
      })
      .focus()
      .run()

    // Track this as last committed
    lastCommittedIdRef.current = bulletId

    // ASYNC BACKEND SAVE - Don't wait for this
    ;(async () => {
      try {
        // Commit to backend
        await api.appendBullet(noteId, {
          bulletId,
          parentId,
          depth,
          text,
          spans,
        })

        // Check if this is a task (starts with [ ] or [])
        const isTask = /^\[\s*\]/.test(text.trim())
        console.log('[Commit] Task detection - text:', text, 'isTask:', isTask)
        if (isTask) {
          // Create task annotation
          await api.appendAnnotation(bulletId, 'task', { state: 'open' })
          console.log('[Commit] Created task annotation for bullet:', bulletId)
        }

        console.log('[Commit] Backend save successful for bullet:', bulletId)
      } catch (error) {
        console.error('[Editor] Failed to commit bullet to backend:', error)

        // ROLLBACK OPTIMISTIC UI UPDATE
        // Find the bullet with this bulletId and remove committed state
        if (editor) {
          const { state } = editor
          const { doc } = state

          let failedBulletPos = -1
          doc.descendants((node, pos) => {
            if (node.type.name === 'listItem' && node.attrs['data-bullet-id'] === bulletId) {
              failedBulletPos = pos
              return false
            }
          })

          if (failedBulletPos >= 0) {
            const failedNode = doc.nodeAt(failedBulletPos)
            if (failedNode) {
              // Remove committed attributes
              const cleanAttrs = { ...failedNode.attrs }
              delete cleanAttrs['data-committed']
              delete cleanAttrs['data-bullet-id']
              delete cleanAttrs['style'] // Remove indent styling too

              // Apply the rollback
              editor.chain()
                .command(({ tr }) => {
                  tr.setNodeMarkup(failedBulletPos, null, cleanAttrs)
                  return true
                })
                .run()

              console.log('[Editor] Rolled back optimistic UI for failed bullet:', bulletId)
            }
          }

          // Also clear the lastCommittedIdRef since this commit failed
          if (lastCommittedIdRef.current === bulletId) {
            lastCommittedIdRef.current = null
          }
        }

        // Show error banner and save failed text for retry
        setCommitError(error instanceof Error ? error.message : 'Failed to commit bullet')
        setFailedBulletText(text)
      }
    })()
  }

  // Retry failed commit
  const retryCommit = () => {
    if (failedBulletText && editor) {
      // Set the text back in the editor
      const { state } = editor
      const { selection } = state

      // Clear error and retry
      setCommitError(null)
      editor.commands.focus()

      // Trigger commit with the view
      handleCommit(editor.view)
    }
  }

  // Extract spans from text (wikilinks, tags, URLs)
  const extractSpans = (text: string): Span[] => {
    const spans: Span[] = []

    // Wikilinks [[...]]
    const wikilinkRegex = /\[\[([^\]]+)\]\]/g
    let match
    while ((match = wikilinkRegex.exec(text)) !== null) {
      spans.push({
        type: 'wikilink',
        start: match.index,
        end: match.index + match[0].length,
        payload: { target: match[1] },
      })
    }

    // Tags #tag
    const tagRegex = /(^|\s)#([A-Za-z0-9_-]+)/g
    while ((match = tagRegex.exec(text)) !== null) {
      spans.push({
        type: 'tag',
        start: match.index + match[1].length,
        end: match.index + match[0].length,
        payload: { target: match[2] },
      })
    }

    // URLs
    const urlRegex = /https?:\/\/\S+/g
    while ((match = urlRegex.exec(text)) !== null) {
      spans.push({
        type: 'url',
        start: match.index,
        end: match.index + match[0].length,
        payload: { target: match[0] },
      })
    }

    return spans
  }

  // Helper: Convert bullet text to HTML with wikilink marks
  const convertTextToHTML = (text: string): string => {
    // Replace [[wikilinks]] with span elements that will be parsed as wikilink marks
    return text.replace(/\[\[([^\]]+)\]\]/g, (match, target) => {
      return `<span data-wikilink="true" data-target="${target}">[[${target}]]</span>`
    })
  }

  // Load bullets on mount or when noteId changes
  useEffect(() => {
    async function loadBullets() {
      const bullets = await api.getBullets(noteId)

      // Convert bullets to HTML and load into editor
      // Build nested bullet list HTML
      let html = '<ul>'

      if (bullets.length > 0) {
        bullets.forEach((bullet) => {
          // Apply visual indent via inline style
          const indentPx = bullet.depth * 24 // 24px per depth level
          const htmlText = convertTextToHTML(bullet.text)
          const redactedAttr = bullet.redacted ? ' data-redacted="true"' : ''
          html += `<li data-bullet-id="${bullet.id}" data-committed="true"${redactedAttr} style="margin-left: ${indentPx}px;">${htmlText}</li>`
        })

        // Set last committed for parent tracking
        lastCommittedIdRef.current = bullets[bullets.length - 1].id
      }

      html += '<li><p></p></li></ul>' // Add empty editable bullet with explicit paragraph

      editor?.commands.setContent(html)

      // Focus inside the last (empty) bullet
      setTimeout(() => {
        if (editor) {
          const { state } = editor

          // Find all paragraphs and their positions
          const paragraphs: number[] = []
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'paragraph') {
              paragraphs.push(pos)
            }
          })

          // The last paragraph is often outside the list (Tiptap adds an extra one),
          // so use the second-to-last which is inside the last list item (the empty bullet)
          if (paragraphs.length >= 2) {
            const emptyBulletParaPos = paragraphs[paragraphs.length - 2]
            editor.commands.setTextSelection({ from: emptyBulletParaPos + 1, to: emptyBulletParaPos + 1 })
            editor.commands.focus()
          } else if (paragraphs.length === 1) {
            // Fallback: only one paragraph, use it
            const paraPos = paragraphs[0]
            editor.commands.setTextSelection({ from: paraPos + 1, to: paraPos + 1 })
            editor.commands.focus()
          }
        }
      }, 50)

      console.log('[BulletEditor] Loaded', bullets.length, 'bullets for note', noteId)

      // Scroll to specific bullet if requested
      if (scrollToBulletId && bullets.length > 0) {
        setTimeout(() => {
          const bulletElement = document.querySelector(`[data-bullet-id="${scrollToBulletId}"]`)
          if (bulletElement) {
            bulletElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
            console.log('[BulletEditor] Scrolled to bullet:', scrollToBulletId)
          } else {
            console.warn('[BulletEditor] Bullet not found for scrolling:', scrollToBulletId)
          }
        }, 100) // Small delay to ensure DOM is ready
      }
    }

    if (editor) {
      loadBullets()
    }
  }, [noteId, editor, scrollToBulletId])

  // Detect [[ wikilink trigger and show autocomplete
  useEffect(() => {
    if (!editor) return

    const detectWikilinkTrigger = () => {
      const { state } = editor
      const { selection } = state
      const { $from } = selection

      // Check if cursor is inside an existing wikilink - if so, don't trigger autocomplete
      const marks = $from.marks()
      const insideWikilink = marks.some(mark => mark.type.name === 'wikilink')
      if (insideWikilink) {
        setWikilinkQuery(null)
        setWikilinkSuggestions([])
        wikilinkTriggerPosRef.current = null
        setWikilinkDropdownPos(null)
        return
      }

      // Get text before cursor
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)

      // Check if we just typed [[
      const match = textBefore.match(/\[\[([^\]]*?)$/)

      if (match) {
        const query = match[1]
        setWikilinkQuery(query)
        wikilinkTriggerPosRef.current = $from.pos - query.length

        // Calculate cursor position for dropdown
        const coords = editor.view.coordsAtPos($from.pos)
        setWikilinkDropdownPos({
          top: coords.bottom,
          left: coords.left
        })

        // Search for matching notes (empty query shows all notes)
        api.searchNotes(query || '').then((notes) => {
          const suggestions = notes.map(n => ({
            title: n.date,
            noteId: n.id
          }))

          // If query is not empty and no matches, add option to create new note
          if (query && suggestions.length === 0) {
            suggestions.push({
              title: query,
              noteId: 'new'
            })
          }

          setWikilinkSuggestions(suggestions)
          setSelectedSuggestionIndex(0)
        })
      } else {
        setWikilinkQuery(null)
        setWikilinkSuggestions([])
        wikilinkTriggerPosRef.current = null
        setWikilinkDropdownPos(null)
      }
    }

    editor.on('update', detectWikilinkTrigger)
    editor.on('selectionUpdate', detectWikilinkTrigger)

    return () => {
      editor.off('update', detectWikilinkTrigger)
      editor.off('selectionUpdate', detectWikilinkTrigger)
    }
  }, [editor])

  // Detect # tag trigger and show autocomplete
  useEffect(() => {
    if (!editor) return

    const detectTagTrigger = () => {
      const { state } = editor
      const { selection } = state
      const { $from } = selection

      // Get text before cursor
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)

      // Check if we just typed # followed by word characters
      // Match # at word boundary (start of line or after space) followed by optional text
      const match = textBefore.match(/(^|\s)#([A-Za-z0-9_-]*)$/)

      if (match) {
        const query = match[2]
        setTagQuery(query)
        tagTriggerPosRef.current = $from.pos - query.length

        // Calculate cursor position for dropdown
        const coords = editor.view.coordsAtPos($from.pos)
        setTagDropdownPos({
          top: coords.bottom,
          left: coords.left
        })

        // Search for matching tags
        api.searchTags(query || '').then((tags) => {
          // If query is not empty and no matches, add option to create new tag
          const suggestions = [...tags]
          if (query && !tags.includes(query)) {
            suggestions.unshift(query) // Add current query as first option
          }

          setTagSuggestions(suggestions)
          setSelectedTagIndex(0)
        })
      } else {
        setTagQuery(null)
        setTagSuggestions([])
        tagTriggerPosRef.current = null
        setTagDropdownPos(null)
      }
    }

    editor.on('update', detectTagTrigger)
    editor.on('selectionUpdate', detectTagTrigger)

    return () => {
      editor.off('update', detectTagTrigger)
      editor.off('selectionUpdate', detectTagTrigger)
    }
  }, [editor])

  // Handle tag suggestion selection
  const selectTagSuggestion = (tag: string) => {
    if (!editor || tagTriggerPosRef.current === null) return

    const { state } = editor
    const triggerPos = tagTriggerPosRef.current

    // Replace # and partial query with #tag and add trailing space
    const tagText = `#${tag} `
    const tr = state.tr.insertText(tagText, triggerPos - 1, state.selection.from)
    editor.view.dispatch(tr)

    // Clear autocomplete
    setTagQuery(null)
    setTagSuggestions([])
    tagTriggerPosRef.current = null

    editor.commands.focus()
  }

  // Handle wikilink suggestion selection
  const selectWikilinkSuggestion = (suggestion: WikilinkSuggestion) => {
    if (!editor || wikilinkTriggerPosRef.current === null) return

    const { state } = editor
    const triggerPos = wikilinkTriggerPosRef.current

    // Replace [[ and partial query with [[Title]] and add trailing space
    const wikilinkText = `[[${suggestion.title}]] `
    const tr = state.tr.insertText(wikilinkText, triggerPos - 2, state.selection.from)
    editor.view.dispatch(tr)

    // Clear autocomplete
    setWikilinkQuery(null)
    setWikilinkSuggestions([])
    wikilinkTriggerPosRef.current = null

    editor.commands.focus()
  }

  // Handle context menu (right-click on bullet)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()

    // Find the bullet element that was clicked
    const target = e.target as HTMLElement
    const bulletElement = target.closest('li[data-committed="true"]') as HTMLElement

    if (!bulletElement) return

    const bulletId = bulletElement.getAttribute('data-bullet-id')
    if (!bulletId) return

    // Get bullet text
    const bulletTextElement = bulletElement.querySelector('p')
    const bulletText = bulletTextElement?.textContent || ''

    setContextMenu({
      bulletId,
      bulletText,
      position: { x: e.clientX, y: e.clientY }
    })
  }

  // Handle redaction confirmation
  const handleRedactionConfirm = async (reason: string) => {
    if (!bulletToRedact) return

    try {
      await api.redact(bulletToRedact.bulletId, reason || undefined)

      // Update the bullet in DOM to show as redacted (strikethrough via CSS)
      const bulletElement = document.querySelector(`li[data-bullet-id="${bulletToRedact.bulletId}"]`)
      if (bulletElement) {
        // Just add the data-redacted attribute - CSS handles strikethrough styling
        bulletElement.setAttribute('data-redacted', 'true')
        // Optionally store reason in data attribute for future use
        if (reason) {
          bulletElement.setAttribute('data-redact-reason', reason)
        }
      }

      // Close modal
      setRedactionModalOpen(false)
      setBulletToRedact(null)
    } catch (error) {
      console.error('Failed to redact bullet:', error)
      alert('Failed to redact bullet. Please try again.')
    }
  }

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenu])

  // Format note title (date or arbitrary name)
  const formatNoteTitle = (identifier: string): string => {
    // Try to parse as date (YYYY-MM-DD format)
    const dateMatch = identifier.match(/^\d{4}-\d{2}-\d{2}$/)
    if (dateMatch) {
      const date = new Date(identifier + 'T00:00:00')
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      }
    }
    // Not a date - return as-is (arbitrary note name)
    return identifier
  }

  // Keyboard shortcuts for navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if no modals are open and not in autocomplete
      if (wikilinkQuery !== null || tagQuery !== null) return

      // ArrowUp = previous/older day
      if (e.key === 'ArrowUp' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onNavigatePrevious()
      }
      // ArrowDown = next/newer day
      if (e.key === 'ArrowDown' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onNavigateNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [wikilinkQuery, tagQuery, onNavigatePrevious, onNavigateNext])

  // Handle wikilink clicks
  useEffect(() => {
    if (!editor) return

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement

      // Check if clicked element or parent is a wikilink
      const wikilinkEl = target.closest('[data-wikilink="true"]')
      if (wikilinkEl) {
        const wikilinkTarget = wikilinkEl.getAttribute('data-target')
        if (wikilinkTarget) {
          event.preventDefault()
          console.log('[BulletEditor] Wikilink clicked:', wikilinkTarget)
          // Navigate to note (works for both dates and arbitrary titles)
          onNavigateToNote(wikilinkTarget)
        }
      }
    }

    const editorEl = editor.view.dom
    editorEl.addEventListener('click', handleClick)
    return () => editorEl.removeEventListener('click', handleClick)
  }, [editor, onNavigateToNote])

  return (
    <div style={{ position: 'relative' }}>
      {/* Header with date and navigation */}
      <div style={{
        padding: '20px 20px 10px 20px',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#fff',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        {/* Left: Previous day button (only for daily notes) or Today button */}
        {noteType === 'daily' ? (
          <button
            onClick={onNavigatePrevious}
            title="Previous day (Cmd/Ctrl+↑)"
            style={{
              background: 'transparent',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ↑
          </button>
        ) : (
          <button
            onClick={onNavigateToToday}
            title="Go to today (Cmd/Ctrl+H)"
            style={{
              background: 'transparent',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Today
          </button>
        )}

        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          margin: 0,
          color: '#333',
        }}>
          {formatNoteTitle(noteDate)}
        </h1>

        {/* Right: Hide redacted toggle + next day button */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setHideRedacted(!hideRedacted)}
            title={hideRedacted ? 'Show redacted bullets' : 'Hide redacted bullets'}
            style={{
              background: hideRedacted ? '#f8f9fa' : 'transparent',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              color: hideRedacted ? '#666' : '#999',
            }}
          >
            {hideRedacted ? 'Show Redacted' : 'Hide Redacted'}
          </button>

          {noteType === 'daily' ? (
            <button
              onClick={onNavigateNext}
              title="Next day (Cmd/Ctrl+↓)"
              style={{
                background: 'transparent',
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ↓
            </button>
          ) : (
            <div style={{ width: '44px' }}>{/* Spacer for symmetry */}</div>
          )}
        </div>
      </div>

      <div onContextMenu={handleContextMenu} className={hideRedacted ? 'hide-redacted' : ''}>
        <EditorContent editor={editor} />
      </div>

      {/* Error banner */}
      {commitError && (
        <div style={{
          position: 'fixed',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#dc3545',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minWidth: '300px',
        }}>
          <div style={{ flex: 1 }}>
            <strong>Commit failed:</strong> {commitError}
          </div>
          <button
            onClick={retryCommit}
            style={{
              background: 'white',
              color: '#dc3545',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Retry
          </button>
          <button
            onClick={() => {
              setCommitError(null)
              setFailedBulletText(null)
            }}
            style={{
              background: 'transparent',
              color: 'white',
              border: '1px solid white',
              padding: '6px 12px',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tag autocomplete dropdown */}
      {tagQuery !== null && tagSuggestions.length > 0 && tagDropdownPos && (
        <div
          style={{
            position: 'fixed',
            top: `${tagDropdownPos.top}px`,
            left: `${tagDropdownPos.left}px`,
            background: 'white',
            border: '2px solid #28a745',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(40, 167, 69, 0.2)',
            maxHeight: '250px',
            overflowY: 'auto',
            zIndex: 1000,
            minWidth: '220px',
          }}
        >
          {tagSuggestions.map((tag, index) => (
            <div
              key={tag}
              onClick={() => selectTagSuggestion(tag)}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                background: index === selectedTagIndex ? '#28a745' : 'white',
                color: index === selectedTagIndex ? 'white' : '#333',
                transition: 'all 0.15s ease',
                borderBottom: index < tagSuggestions.length - 1 ? '1px solid #eee' : 'none',
                fontSize: '14px',
              }}
              onMouseEnter={(e) => {
                if (index !== selectedTagIndex) {
                  e.currentTarget.style.background = '#f0f9f4'
                }
              }}
              onMouseLeave={(e) => {
                if (index !== selectedTagIndex) {
                  e.currentTarget.style.background = 'white'
                }
              }}
            >
              #{tag}
            </div>
          ))}
        </div>
      )}

      {/* Wikilink autocomplete dropdown */}
      {wikilinkQuery !== null && wikilinkSuggestions.length > 0 && wikilinkDropdownPos && (
        <div
          style={{
            position: 'fixed',
            top: `${wikilinkDropdownPos.top}px`,
            left: `${wikilinkDropdownPos.left}px`,
            background: 'white',
            border: '2px solid #007acc',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0, 122, 204, 0.2)',
            maxHeight: '250px',
            overflowY: 'auto',
            zIndex: 1000,
            minWidth: '220px',
          }}
        >
          {wikilinkSuggestions.map((suggestion, index) => (
            <div
              key={suggestion.noteId}
              onClick={() => selectWikilinkSuggestion(suggestion)}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                background: index === selectedSuggestionIndex ? '#007acc' : 'white',
                color: index === selectedSuggestionIndex ? 'white' : '#333',
                transition: 'all 0.15s ease',
                borderBottom: index < wikilinkSuggestions.length - 1 ? '1px solid #eee' : 'none',
                fontSize: '14px',
              }}
              onMouseEnter={(e) => {
                if (index !== selectedSuggestionIndex) {
                  e.currentTarget.style.background = '#e6f2fb'
                }
              }}
              onMouseLeave={(e) => {
                if (index !== selectedSuggestionIndex) {
                  e.currentTarget.style.background = 'white'
                }
              }}
            >
              [[{suggestion.title}]]
            </div>
          ))}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.position.y,
            left: contextMenu.position.x,
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1002,
            minWidth: '150px',
          }}
        >
          <button
            onClick={() => {
              setBulletToRedact({
                bulletId: contextMenu.bulletId,
                bulletText: contextMenu.bulletText
              })
              setRedactionModalOpen(true)
              setContextMenu(null)
            }}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              color: '#dc3545',
              fontWeight: '500',
              fontSize: '14px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8f9fa'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            Redact
          </button>
        </div>
      )}

      {/* Redaction Modal */}
      <RedactionModal
        isOpen={redactionModalOpen}
        bulletText={bulletToRedact?.bulletText || ''}
        onConfirm={handleRedactionConfirm}
        onCancel={() => {
          setRedactionModalOpen(false)
          setBulletToRedact(null)
        }}
      />
    </div>
  )
}

export default BulletEditor
