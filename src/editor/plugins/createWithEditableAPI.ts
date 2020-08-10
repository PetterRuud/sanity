import {
  Text,
  Range,
  Transforms,
  Editor,
  Path as SlatePath,
  Element as SlateElement,
  Operation
} from 'slate'
import {isEqual} from 'lodash'
import {ReactEditor} from '@sanity/slate-react'
import {Type} from '../../types/schema'
import {PortableTextBlock, PortableTextChild} from '../../types/portableText'
import {Path} from '../../types/path'
import {EditorSelection, PortableTextSlateEditor} from '../../types/editor'
import {toSlateValue, fromSlateValue, isEqualToEmptyEditor} from '../../utils/values'
import {toSlateRange, toPortableTextRange} from '../../utils/selection'
import {PortableTextEditor} from '../PortableTextEditor'

import {debugWithName} from '../../utils/debug'
import {DOMNode} from '@sanity/slate-react/dist/utils/dom'
import {PTE_SELECTION} from '../../utils/weakMaps'

const debug = debugWithName('API:editable')

export function createWithEditableAPI(
  portableTextEditor: PortableTextEditor,
  portableTextFeatures,
  keyGenerator: () => string
) {
  return function withEditableAPI(editor: PortableTextSlateEditor & ReactEditor) {
    const {apply} = editor

    // Convert the selection when the operation happens,
    // or we may be out of sync between selection and value
    editor.apply = (operation: Operation) => {
      apply(operation)
      if (operation.type === 'set_selection') {
        PTE_SELECTION.set(editor, toPortableTextRange(editor))
      }
    }
    portableTextEditor.setEditable({
      focus: (): void => {
        ReactEditor.focus(editor)
      },
      blur: (): void => {
        ReactEditor.blur(editor)
      },
      toggleMark: (mark: string): void => {
        editor.pteToggleMark(mark)
        ReactEditor.focus(editor)
      },
      toggleList: (listStyle: string): void => {
        editor.pteToggleListItem(listStyle)
        ReactEditor.focus(editor)
      },
      toggleBlockStyle: (blockStyle: string): void => {
        editor.pteToggleBlockStyle(blockStyle)
        ReactEditor.focus(editor)
      },
      isMarkActive: (mark: string): boolean => {
        // Try/catch this, as Slate may error because the selection is currently wrong
        // TODO: catch only relevant error from Slate
        try {
          return editor.pteIsMarkActive(mark)
        } catch (err) {
          return false
        }
      },
      marks: (): string[] => {
        return (
          {
            ...(Editor.marks(editor) || {})
          }.marks || []
        )
      },
      undo: (): void => editor.undo(),
      redo: (): void => editor.redo(),
      select: (selection: EditorSelection): void => {
        const isEmpty = isEqualToEmptyEditor(editor.children, portableTextFeatures) // TODO: check up on this
        if (isEmpty || selection === null) {
          debug('No value or selection is null, deselecting')
          Transforms.deselect(editor)
          return
        }
        const slateSelection = toSlateRange(selection, editor)
        if (slateSelection) {
          const [node] = Editor.node(editor, slateSelection)
          if (Editor.isVoid(editor, node)) {
            Transforms.select(editor, slateSelection.focus.path.concat(0))
          } else {
            Transforms.select(editor, slateSelection)
          }
          ReactEditor.focus(editor)
          return
        }
      },
      focusBlock: (): PortableTextBlock | undefined => {
        if (editor.selection) {
          // Try/catch this, as Slate may error because the selection is currently wrong
          // TODO: catch only relevant error from Slate
          try {
            const [block] = Array.from(
              Editor.nodes(editor, {
                at: editor.selection.focus,
                match: n => Editor.isBlock(editor, n)
              })
            )[0]
            if (block) {
              return fromSlateValue([block], portableTextFeatures.types.block.name)[0]
            }
          } catch (err) {
            return undefined
          }
        }
        return undefined
      },
      focusChild: (): PortableTextChild | undefined => {
        if (editor.selection) {
          try {
            const [node] = Array.from(
              Editor.nodes(editor, {
                mode: 'lowest',
                at: editor.selection.focus,
                match: n => n._type !== undefined,
                voids: true
              })
            )[0]
            if (node && !Editor.isBlock(editor, node)) {
              const pseudoBlock = {
                _key: 'pseudo',
                _type: portableTextFeatures.types.block.name,
                children: [node]
              }
              return fromSlateValue([pseudoBlock], portableTextFeatures.types.block.name)[0]
                .children[0]
            }
          } catch (err) {
            return undefined
          }
        }
        return undefined
      },
      insertChild: (type: Type, value?: {[prop: string]: any}): Path => {
        if (!editor.selection) {
          throw new Error('The editor has no selection')
        }
        const [focusBlock] = Array.from(
          Editor.nodes(editor, {at: editor.selection.focus, match: n => Editor.isBlock(editor, n)})
        )[0]
        if (!focusBlock) {
          throw new Error('No focus block')
        }
        if (focusBlock && Editor.isVoid(editor, focusBlock)) {
          throw new Error("Can't insert childs into block objects")
        }
        const block = toSlateValue(
          [
            {
              _key: keyGenerator(),
              _type: portableTextFeatures.types.block.name,
              children: [
                {
                  _key: keyGenerator(),
                  _type: type.name,
                  ...(value ? value : {})
                }
              ]
            }
          ],
          portableTextFeatures.types.block.name
        )[0] as SlateElement
        const child = block.children[0]
        Editor.insertNode(editor, child)
        editor.onChange()
        return toPortableTextRange(editor)?.focus.path || []
      },
      insertBlock: (type: Type, value?: {[prop: string]: any}): Path => {
        if (!editor.selection) {
          throw new Error('The editor has no selection')
        }
        const block = toSlateValue(
          [
            {
              _key: keyGenerator(),
              _type: type.name,
              ...(value ? value : {})
            }
          ],
          portableTextFeatures.types.block.name
        )[0]
        Editor.insertNode(editor, block)
        editor.onChange()
        return toPortableTextRange(editor)?.focus.path || []
      },
      hasBlockStyle: (style: string): boolean => {
        try {
          return editor.pteHasBlockStyle(style)
        } catch (err) {
          debug(err)
          return false
        }
      },
      isVoid: (element: PortableTextBlock | PortableTextChild) => {
        return ![
          portableTextFeatures.types.block.name,
          portableTextFeatures.types.span.name
        ].includes(element._type)
      },
      findByPath: (
        path: Path
      ): [PortableTextBlock | PortableTextChild | undefined, Path | undefined] => {
        const slatePath = toSlateRange(
          {focus: {path, offset: 0}, anchor: {path, offset: 0}},
          editor
        )
        if (slatePath) {
          const [block, blockPath] = Editor.node(editor, slatePath.focus.path.slice(0, 1))
          if (block && blockPath && typeof block._key === 'string') {
            if (slatePath.focus.path.length === 1) {
              return [
                fromSlateValue([block], portableTextFeatures.types.block.name)[0],
                [{_key: block._key}]
              ]
            }
            const ptBlock = fromSlateValue([block], portableTextFeatures.types.block.name)[0]
            const ptChild = ptBlock.children[slatePath.focus.path[1]]
            if (ptChild) {
              return [ptChild, [{_key: block._key}, 'children', {_key: ptChild._key}]]
            }
          }
        }
        return [undefined, undefined]
      },
      findDOMNode: (element: PortableTextBlock | PortableTextChild): DOMNode => {
        const [item] = Array.from(
          Editor.nodes(editor, {at: [], match: n => n._key === element._key})
        )[0]
        let node
        try {
          node = ReactEditor.toDOMNode(editor, item)
        } catch (err) {
          // Nothing
        }
        return node
      },
      activeAnnotations: (): PortableTextBlock[] => {
        if (!editor.selection || editor.selection.focus.path.length < 2) {
          return []
        }
        try {
          const [block] = Editor.node(editor, editor.selection.focus.path.slice(0, 1))
          if (!Array.isArray(block.markDefs)) {
            return []
          }
          const [span] = Editor.node(editor, editor.selection.focus.path.slice(0, 2))
          return block.markDefs.filter(
            def => Array.isArray(span.marks) && span.marks.includes(def._key)
          )
        } catch (err) {
          return []
        }
      },
      addAnnotation: (
        type: Type,
        value?: {[prop: string]: any}
      ): {spanPath: Path; markDefPath: Path} | undefined => {
        const {selection} = editor
        if (selection) {
          const [blockElement] = Editor.node(editor, selection.focus, {depth: 1})
          if (blockElement._type === portableTextFeatures.types.block.name) {
            const annotationKey = keyGenerator()
            if (Array.isArray(blockElement.markDefs)) {
              Transforms.setNodes(
                editor,
                {
                  markDefs: [
                    ...blockElement.markDefs,
                    {_type: type.name, _key: annotationKey, ...value}
                  ]
                },
                {at: selection.focus}
              )
              if (Range.isCollapsed(selection)) {
                editor.pteExpandToWord()
              }
              const [textNode] = Editor.node(editor, selection.focus, {depth: 2})
              if (editor.selection) {
                Editor.withoutNormalizing(editor, () => {
                  // Split if needed
                  Transforms.setNodes(editor, {}, {match: Text.isText, split: true})
                  if (editor.selection) {
                    Transforms.setNodes(
                      editor,
                      {
                        marks: [...((textNode.marks || []) as string[]), annotationKey]
                      },
                      {
                        at: editor.selection,
                        match: n => n._type === portableTextFeatures.types.span.name
                      }
                    )
                  }
                })
                Editor.normalize(editor)
                editor.onChange()
                const newSelection = toPortableTextRange(editor)
                if (newSelection && typeof blockElement._key === 'string') {
                  // Insert an empty string to continue writing non-annotated text
                  Editor.withoutNormalizing(editor, () => {
                    if (editor.selection) {
                      Transforms.insertNodes(
                        editor,
                        [{_type: 'span', text: '', marks: [], _key: keyGenerator()}],
                        {
                          at: Range.end(editor.selection)
                        }
                      )
                      editor.onChange()
                    }
                  })
                  return {
                    spanPath: newSelection.focus.path,
                    markDefPath: [{_key: blockElement._key}, 'markDefs', {_key: annotationKey}]
                  }
                }
              }
            }
          }
        }
        return undefined
      },
      remove: (selection?: EditorSelection, options?: {mode?: 'block' | 'children'}): void => {
        if (selection) {
          const range = toSlateRange(selection, editor)
          if (range) {
            const ptMode: string | undefined = (options && options.mode) || undefined
            let mode
            if (ptMode) {
              mode = mode === 'block' ? 'highest' : 'lowest'
            }
            Transforms.removeNodes(editor, {at: range, mode})
          }
        }
      },
      removeAnnotation: (): void => {
        let {selection} = editor
        if (selection) {
          const [blockElement] = Editor.node(editor, selection.focus, {depth: 1})
          if (
            blockElement._type === portableTextFeatures.types.block.name &&
            SlateElement.isElement(blockElement)
          ) {
            const [span, spanPath] = Editor.node(editor, selection.focus.path.slice(0, 2))
            const spanMarks = (span.marks as string[]) || []
            if (Array.isArray(blockElement.markDefs)) {
              if (
                Range.isCollapsed(selection) &&
                Text.isText(span) &&
                blockElement.children.slice(-1)[0] === span &&
                selection.focus.offset === span.text.length
              ) {
                // Just insert an empty span
                Transforms.insertNodes(
                  editor,
                  [{_type: 'span', text: ' ', marks: [], _key: keyGenerator()}],
                  {
                    at: selection.focus
                  }
                )
                Transforms.select(editor, SlatePath.next(spanPath))
                Transforms.collapse(editor, {edge: 'end'})
                return
              }
              const annotation = blockElement.markDefs.find(def => spanMarks.includes(def._key))
              if (annotation && annotation._key) {
                if (Range.isCollapsed(selection)) {
                  editor.pteExpandToWord()
                } else {
                  Transforms.setNodes(editor, {}, {match: Text.isText, split: true})
                }
                selection = editor.selection
                if (selection) {
                  for (const [node, path] of Editor.nodes(editor, {
                    at: selection,
                    mode: 'lowest',
                    match: Text.isText
                  })) {
                    if (Array.isArray(node.marks)) {
                      Transforms.setNodes(
                        editor,
                        {
                          marks: [...node.marks.filter(mark => mark !== annotation._key)]
                        },
                        {at: path, voids: false, split: false}
                      )
                    }
                  }
                  // Merge similar adjecent spans
                  for (const [node, path] of Array.from(
                    Editor.nodes(editor, {
                      at: Editor.range(
                        editor,
                        [selection.anchor.path[0]],
                        [selection.focus.path[0]]
                      ),
                      match: Text.isText
                    })
                  ).reverse()) {
                    const [parent] = Editor.node(editor, SlatePath.parent(path))
                    if (Editor.isBlock(editor, parent)) {
                      const nextPath = [path[0], path[1] + 1]
                      const nextTextNode = parent.children[nextPath[1]]
                      if (
                        nextTextNode &&
                        nextTextNode.text &&
                        isEqual(nextTextNode.marks, node.marks)
                      ) {
                        Transforms.mergeNodes(editor, {at: nextPath, voids: true})
                      }
                    }
                  }
                  editor.onChange()
                }
              }
            }
          }
        }
      },
      getSelection: () => {
        return PTE_SELECTION.get(editor)
      }
    })
    return editor
  }
}
