import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import ListItem from '@tiptap/extension-list-item'
import { v4 as uuidv4 } from 'uuid'
import { mockApi } from '@/lib/mockApi'
import type { Span } from '@/types'

interface WikilinkSuggestion {
  title: string
  noteId: string
}

interface BulletEditorProps {
  noteId: string
}

function BulletEditor({ noteId }: BulletEditorProps) {
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
    ],
    content: '<ul><li></li></ul>', // Start with one bullet
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'bullet-editor',
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
          if (event.key === 'Enter' || event.key === 'Tab') {
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
          if (event.key === 'Enter' || event.key === 'Tab') {
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
                const newState = editor?.state
                if (newState) {
                  const endPos = newState.doc.content.size - 3 // Position inside the new paragraph
                  const tr = newState.tr.setSelection(
                    newState.selection.constructor.near(newState.doc.resolve(endPos))
                  )
                  editor?.view.dispatch(tr)
                  editor?.commands.focus()
                }
              }, 0)
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

    try {
      // Clear any previous errors
      setCommitError(null)
      setFailedBulletText(null)

      // Commit to backend
      const result = await mockApi.appendBullet(noteId, {
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
        await mockApi.appendAnnotation(bulletId, 'task', { state: 'open' })
        console.log('[Commit] Created task annotation for bullet:', bulletId)
      }

      // Mark this list item as committed by adding data attribute
      const tr = state.tr
      tr.setNodeMarkup(listItemPos, null, {
        ...listItemNode.attrs,
        'data-bullet-id': bulletId,
        'data-committed': 'true',
      })

      // Make it non-editable by wrapping in a special mark
      // For now, we'll just visually indicate it's committed
      view.dispatch(tr)

      // Track this as last committed
      lastCommittedIdRef.current = bulletId

      // Create new editable bullet
      editor.commands.splitListItem('listItem')

      // Clear the committed flag on the new bullet (splitListItem copies attrs)
      // Find the new list item (the one right after the one we just committed)
      const newState = editor.state
      let newListItemPos = -1

      newState.doc.descendants((node, pos) => {
        // Find first listItem after the committed one
        if (node.type.name === 'listItem' && pos > listItemPos) {
          newListItemPos = pos
          return false // Stop searching
        }
      })

      if (newListItemPos >= 0) {
        const newTr = newState.tr
        const newNode = newState.doc.nodeAt(newListItemPos)
        if (newNode) {
          // Clear custom committed attributes but keep other attributes
          const cleanAttrs = { ...newNode.attrs }
          delete cleanAttrs['data-committed']
          delete cleanAttrs['data-bullet-id']

          newTr.setNodeMarkup(newListItemPos, null, cleanAttrs)
          editor.view.dispatch(newTr)
        }
      }

      editor.commands.focus()

    } catch (error) {
      console.error('[Editor] Failed to commit bullet:', error)

      // Show error banner and save failed text for retry
      setCommitError(error instanceof Error ? error.message : 'Failed to commit bullet')
      setFailedBulletText(text)

      // Don't create new bullet or mark as committed - keep current bullet editable for retry
    }
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

  // Load bullets on mount
  useEffect(() => {
    async function loadBullets() {
      const bullets = await mockApi.getBullets(noteId)

      if (bullets.length > 0) {
        // Convert bullets to HTML and load into editor
        // Build nested bullet list HTML
        let html = '<ul>'

        bullets.forEach((bullet) => {
          // Apply visual indent via inline style
          const indentPx = bullet.depth * 24 // 24px per depth level
          html += `<li data-bullet-id="${bullet.id}" data-committed="true" style="margin-left: ${indentPx}px;">${bullet.text}</li>`
        })

        html += '<li></li></ul>' // Add empty editable bullet at end

        editor?.commands.setContent(html)
        editor?.commands.focus('end')

        console.log('[BulletEditor] Loaded', bullets.length, 'bullets')

        // Set last committed for parent tracking
        if (bullets.length > 0) {
          lastCommittedIdRef.current = bullets[bullets.length - 1].id
        }
      }
    }

    if (editor) {
      loadBullets()
    }
  }, [noteId, editor])

  // Detect [[ wikilink trigger and show autocomplete
  useEffect(() => {
    if (!editor) return

    const detectWikilinkTrigger = () => {
      const { state } = editor
      const { selection } = state
      const { $from } = selection

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
        mockApi.searchNotes(query || '').then((notes) => {
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
        mockApi.searchTags(query || '').then((tags) => {
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

    // Replace # and partial query with #tag
    const tagText = `#${tag}`
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

    // Replace [[ and partial query with [[Title]]
    const wikilinkText = `[[${suggestion.title}]]`
    const tr = state.tr.insertText(wikilinkText, triggerPos - 2, state.selection.from)
    editor.view.dispatch(tr)

    // Clear autocomplete
    setWikilinkQuery(null)
    setWikilinkSuggestions([])
    wikilinkTriggerPosRef.current = null

    editor.commands.focus()
  }

  return (
    <div style={{ position: 'relative' }}>
      <EditorContent editor={editor} />

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
    </div>
  )
}

export default BulletEditor
