/**
 *
 * This plugin will change Slate's default marks model (every prop is a mark) with the Portable Text model (marks is an array of strings on prop .marks).
 *
 */

import {Subject} from 'rxjs'
import {isEqual, flatten, uniq} from 'lodash'
import {Editor, Range, Transforms, Text, Path, NodeEntry, Element} from 'slate'

import {debugWithName} from '../../utils/debug'
import {EditorChange, PortableTextSlateEditor} from '../../types/editor'
import {toPortableTextRange} from '../../utils/selection'
import {PortableTextFeatures} from '../../types/portableText'

const debug = debugWithName('plugin:withPortableTextMarkModel')

export function createWithPortableTextMarkModel(
  portableTextFeatures: PortableTextFeatures,
  keyGenerator: () => string,
  change$: Subject<EditorChange>
) {
  return function withPortableTextMarkModel(editor: PortableTextSlateEditor) {
    const {apply, normalizeNode} = editor
    const decorators = portableTextFeatures.decorators.map(t => t.value)

    // Extend Slate's default normalization. Merge spans with same set of .marks when doing merge_node operations
    editor.normalizeNode = nodeEntry => {
      normalizeNode(nodeEntry)
      const [node, path] = nodeEntry
      const isBlock = node._type === portableTextFeatures.types.block.name
      const isSpan = node._type === portableTextFeatures.types.span.name
      // Check consistency of markDefs
      if (
        isBlock &&
        editor.operations.some(op =>
          ['split_node', 'remove_node', 'remove_text', 'merge_node'].includes(op.type)
        )
      ) {
        normalizeMarkDefs(editor)
      }
      if (isSpan) {
        if (!node.marks) {
          debug('Adding .marks to span node')
          Transforms.setNodes(editor, {marks: []}, {at: path})
        }
        if (
          editor.operations.some(op =>
            [
              'insert_node',
              'insert_text',
              'merge_node',
              'remove_node',
              'remove_text',
              'set_node'
            ].includes(op.type)
          )
        ) {
          mergeSpans(editor)
        }
        // Make sure we don't continue marks on a new empty block when the current one is split
        for (const op of editor.operations) {
          if (
            op.type === 'split_node' &&
            op.path.length === 1 &&
            op.path[0] === path[0] &&
            !Path.equals(path, op.path)
          ) {
            const [child] = Editor.node(editor, [op.path[0] + 1, 0])
            if (child.text === '') {
              debug(`Removing leftover marks for new empty block`, op)
              Transforms.setNodes(editor, {marks: []}, {at: [op.path[0] + 1, 0], voids: false})
              editor.onChange()
              break
            }
          }
        }
      }
      // This should not be needed? Commented out for now.
      // // Ensure that every span node has .marks
      // const [node, path] = nodeEntry
      // if (node._type === portableTextFeatures.types.span.name) {
      //   if (!node.marks) {
      //     debug('Adding .marks to span node')
      //     Transforms.setNodes(editor, {marks: []}, {at: path})
      //   }
      // }
    }

    // Special hook before inserting text at the end of an annotation.
    editor.apply = op => {
      if (op.type === 'insert_text') {
        const {selection} = editor
        if (selection && Range.isCollapsed(selection) && Editor.marks(editor)?.marks.some(mark => !decorators.includes(mark))) {
          const [node] = Array.from(
            Editor.nodes(editor, {
              mode: 'lowest',
              at: selection.focus,
              match: n => n._type === portableTextFeatures.types.span.name,
              voids: false
            })
          )[0] || [undefined]
          if (
            node &&
            node.text &&
            typeof node.text === 'string' &&
            node.text.length === selection.focus.offset &&
            Array.isArray(node.marks) &&
            node.marks.length > 0
          ) {
            apply(op)
            Transforms.splitNodes(editor, {
              match: Text.isText,
              at: {...selection.focus, offset: selection.focus.offset}
            })
            const marksWithoutAnnotationMarks: string[] = (
              {
                ...(Editor.marks(editor) || {})
              }.marks || []
            ).filter(mark => decorators.includes(mark))
            Transforms.setNodes(
              editor,
              {marks: marksWithoutAnnotationMarks},
              {at: Path.next(selection.focus.path)}
            )
            return
          }
        }
      }
      apply(op)
    }

    // Override built in addMark function
    editor.addMark = (mark: string) => {
      if (editor.selection) {
        if (Range.isExpanded(editor.selection)) {
          // Split if needed
          Transforms.setNodes(editor, {}, {match: Text.isText, split: true})
          // Use new selection
          const splitTextNodes = [
            ...Editor.nodes(editor, {at: editor.selection, match: Text.isText})
          ]
          const shouldRemoveMark = flatten(
            splitTextNodes.map(item => item[0]).map(node => node.marks)
          ).includes(mark)
          if (shouldRemoveMark) {
            editor.removeMark(mark)
            return
          }
          splitTextNodes.forEach(([node, path]) => {
            const marks = [
              ...(Array.isArray(node.marks) ? node.marks : []).filter(
                (eMark: string) => eMark !== mark
              ),
              mark
            ]
            Transforms.setNodes(editor, {marks}, {at: path})
          })
        } else {
          const existingMarks: string[] =
            {
              ...(Editor.marks(editor) || {})
            }.marks || []
          const marks = {
            ...(Editor.marks(editor) || {}),
            marks: [...existingMarks, mark]
          }
          editor.marks = marks
        }
        editor.onChange()
      }
    }

    // Override built in removeMark function
    editor.removeMark = (mark: string) => {
      if (editor.selection) {
        if (Range.isExpanded(editor.selection)) {
          // Split if needed
          Transforms.setNodes(editor, {}, {match: Text.isText, split: true})
          const splitTextNodes = [
            ...Editor.nodes(editor, {at: editor.selection, match: Text.isText})
          ]
          splitTextNodes.forEach(([node, path]) => {
            Transforms.setNodes(
              editor,
              {
                marks: (Array.isArray(node.marks) ? node.marks : []).filter(
                  (eMark: string) => eMark !== mark
                )
              },
              {at: path}
            )
          })
        } else {
          const existingMarks: string[] =
            {
              ...(Editor.marks(editor) || {})
            }.marks || []
          const marks = {
            ...(Editor.marks(editor) || {}),
            marks: existingMarks.filter(eMark => eMark !== mark)
          }
          editor.marks = marks
        }
        editor.onChange()
      }
    }

    editor.pteIsMarkActive = (mark: string): boolean => {
      if (!editor.selection) {
        return false
      }
      let existingMarks =
        {
          ...(Editor.marks(editor) || {})
        }.marks || []
      if (Range.isExpanded(editor.selection)) {
        Array.from(Editor.nodes(editor, {match: Text.isText, at: editor.selection})).forEach(n => {
          const [node] = n as NodeEntry<Text>
          existingMarks = uniq([...existingMarks, ...((node.marks as string[]) || [])])
        })
      }
      return existingMarks.includes(mark)
    }

    // Custom editor function to toggle a mark
    editor.pteToggleMark = (mark: string) => {
      const isActive = editor.pteIsMarkActive(mark)
      if (isActive) {
        debug(`Remove mark '${mark}'`)
        Editor.removeMark(editor, mark)
      } else {
        debug(`Add mark '${mark}'`)
        Editor.addMark(editor, mark, true)
      }
      const newSelection = toPortableTextRange(editor)
      if (newSelection) {
        // Emit a new selection here (though it might be the same).
        // This is for toolbars etc that listens to selection changes to update themselves.
        change$.next({type: 'selection', selection: newSelection})
      }
      editor.onChange()
    }
    return editor
  }

  /**
   * Normalize re-marked spans in selection
   * @param {Editor} editor
   */
  function mergeSpans(editor: Editor) {
    const {selection} = editor
    if (selection) {
      for (const [node, path] of Array.from(
        Editor.nodes(editor, {
          at: Editor.range(editor, [selection.anchor.path[0]], [selection.focus.path[0]])
        })
      ).reverse()) {
        const [parent] = path.length > 1 ? Editor.node(editor, Path.parent(path)) : [undefined]
        const nextPath = [path[0], path[1] + 1]
        if (Editor.isBlock(editor, parent)) {
          const nextNode = parent.children[nextPath[1]]
          if (
            node._type === 'span' &&
            nextNode &&
            nextNode._type === 'span' &&
            isEqual(nextNode.marks, node.marks)
          ) {
            debug('Merging spans')
            Transforms.mergeNodes(editor, {at: nextPath, voids: true})
            editor.onChange()
          }
        }
      }
    }
  }
  /**
   * Normalize markDefs
   *
   * @param {Editor} editor
   */
  function normalizeMarkDefs(editor: Editor) {
    const {selection} = editor
    if (selection) {
      const blocks = Editor.nodes(editor, {
        at: selection,
        match: n => n._type === portableTextFeatures.types.block.name
      })
      for (const [block, path] of blocks) {
        if (Array.isArray(block.markDefs) && Element.isElement(block)) {
          const newMarkDefs = block.markDefs.filter(def => {
            return block.children.find(child => {
              return Array.isArray(child.marks) && child.marks.includes(def._key)
            })
          })
          const isEmptySingleChild =
            block.markDefs.length > 0 &&
            block.children.length === 1 &&
            block.children[0].text === ''
          if (!isEqual(newMarkDefs, block.markDefs) || isEmptySingleChild) {
            debug('Removing markDef not in use')
            Transforms.setNodes(
              editor,
              {
                markDefs: isEmptySingleChild ? [] : newMarkDefs
              },
              {at: path}
            )
            editor.onChange()
          }
        }
      }
    }
  }
}
