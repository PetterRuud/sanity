import {
  Text,
  Range,
  Transforms,
  Editor,
  Path as SlatePath,
  createEditor,
  Element as SlateElement
} from 'slate'
import {isEqual} from 'lodash'
import React, {useCallback, useMemo, useState, useEffect} from 'react'
import {Editable as SlateEditable, Slate, withReact, ReactEditor} from '@sanity/slate-react'
import {PortableTextFeatures, PortableTextBlock, PortableTextChild} from '../types/portableText'
import {Type} from '../types/schema'
import {Path} from '../types/path'
import {RenderAttributes} from '../types/editor'
import {
  EditorSelection,
  EditorChanges,
  OnPasteFn,
  OnCopyFn,
  PatchObservable,
  EditableAPI,
  RenderBlockFunction
} from '../types/editor'
import {HotkeyOptions} from '../types/options'
import {toSlateValue, fromSlateValue, isEqualToEmptyEditor} from '../utils/values'
import {hasEditableTarget, setFragmentData} from '../utils/copyPaste'
import {createWithInsertData, createWithHotkeys} from './plugins'
import {Leaf} from './Leaf'
import {Element} from './Element'
import {withPortableText} from './withPortableText'
import {normalizeSelection, toPortableTextRange, toSlateRange} from '../utils/selection'
import {Type as SchemaType} from 'src/types/schema'
import {debugWithName} from '../utils/debug'
import {DOMNode} from '@sanity/slate-react/dist/utils/dom'
import {IS_DRAGGING} from '../utils/weakMaps'

const debug = debugWithName('component:Editable')

type Props = {
  change$: EditorChanges
  editable: (args0) => EditableAPI
  hotkeys?: HotkeyOptions
  incomingPatche$?: PatchObservable
  isThrottling: boolean
  keyGenerator: () => string
  maxBlocks?: number
  onPaste?: OnPasteFn
  onCopy?: OnCopyFn
  placeholderText?: string
  portableTextFeatures: PortableTextFeatures
  readOnly?: boolean
  renderAnnotation?: (
    value: PortableTextBlock,
    type: SchemaType,
    ref: React.RefObject<HTMLSpanElement>,
    attributes: RenderAttributes,
    defaultRender: () => JSX.Element
  ) => JSX.Element
  renderBlock?: RenderBlockFunction
  renderChild?: (
    value: PortableTextChild,
    type: SchemaType,
    ref: React.RefObject<HTMLSpanElement>,
    attributes: RenderAttributes,
    defaultRender: (child: PortableTextChild) => JSX.Element
  ) => JSX.Element
  renderDecorator?: (
    value: string,
    type: {title: string},
    ref: React.RefObject<HTMLSpanElement>,
    attributes: RenderAttributes,
    defaultRender: () => JSX.Element
  ) => JSX.Element
  searchAndReplace?: boolean
  selection?: EditorSelection
  singleUserUndoRedo?: boolean
  spellCheck?: boolean
  value?: PortableTextBlock[] | undefined
}

const SELECT_TOP_DOCUMENT = {anchor: {path: [0, 0], offset: 0}, focus: {path: [0, 0], offset: 0}}

export const Editable = (props: Props) => {
  const {
    change$,
    editable,
    hotkeys,
    incomingPatche$,
    keyGenerator,
    maxBlocks,
    placeholderText,
    portableTextFeatures,
    readOnly,
    spellCheck
  } = props

  const createPlaceHolderBlock = () => ({
    _type: portableTextFeatures.types.block.name,
    _key: props.keyGenerator(),
    style: 'normal',
    markDefs: [],
    children: [
      {
        _type: 'span',
        _key: props.keyGenerator(),
        text: '',
        marks: []
      }
    ]
  })

  const withInsertData = createWithInsertData(change$, portableTextFeatures, keyGenerator)
  const withHotKeys = createWithHotkeys(portableTextFeatures, keyGenerator, hotkeys)

  // Init Editor
  const editor = useMemo(
    () =>
      withHotKeys(
        withInsertData(
          withReact(
            withPortableText(createEditor(), {
              portableTextFeatures,
              keyGenerator,
              change$,
              maxBlocks,
              incomingPatche$,
              readOnly: props.readOnly || false
            })
          )
        )
      ),
    []
  )

  // Track editor value
  const [stateValue, setStateValue] = useState(
    // Default value
    toSlateValue(
      getValue(props.value, [createPlaceHolderBlock()]),
      portableTextFeatures.types.block.name
    )
  )

  // Track selection state
  const [selection, setSelection] = useState(editor.selection)

  editable({
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
      if (!props.value || selection === null) {
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
    focusBlock: useCallback((): PortableTextBlock | undefined => {
      if (editor.selection) {
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
    }, [selection]),
    focusChild: useCallback((): PortableTextChild | undefined => {
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
    }, [selection]),
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
    hasBlockStyle: useCallback(
      (style: string): boolean => {
        return editor.pteHasBlockStyle(style)
      },
      [selection]
    ),
    isDragging: () => {
      return IS_DRAGGING.get(editor)
    },
    isVoid: useCallback(
      (element: PortableTextBlock | PortableTextChild) => {
        return ![
          portableTextFeatures.types.block.name,
          portableTextFeatures.types.span.name
        ].includes(element._type)
      },
      [selection]
    ),
    findByPath: (
      path: Path
    ): [PortableTextBlock | PortableTextChild | undefined, Path | undefined] => {
      const slatePath = toSlateRange({focus: {path, offset: 0}, anchor: {path, offset: 0}}, editor)
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
      return ReactEditor.toDOMNode(editor, item)
    },
    activeAnnotations: useCallback((): PortableTextBlock[] => {
      if (!editor.selection || editor.selection.focus.path.length < 2) {
        return []
      }
      const [block] = Editor.node(editor, editor.selection.focus.path.slice(0, 1))
      if (!Array.isArray(block.markDefs)) {
        return []
      }
      const [span] = Editor.node(editor, editor.selection.focus.path.slice(0, 2))
      return block.markDefs.filter(
        def => Array.isArray(span.marks) && span.marks.includes(def._key)
      )
    }, [selection]),
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
            editor.pteExpandToWord()
            const [textNode] = Editor.node(editor, selection.focus, {depth: 2})
            if (Array.isArray(textNode.marks) && editor.selection) {
              Editor.withoutNormalizing(editor, () => {
                // Split if needed
                Transforms.setNodes(editor, {}, {match: Text.isText, split: true})
                if (editor.selection) {
                  Transforms.setNodes(
                    editor,
                    {
                      marks: [...(textNode.marks as string[]), annotationKey]
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
    remove: (selection: EditorSelection, options?: {mode?: 'block' | 'children'}): void => {
      const range = toSlateRange(selection, editor)
      if (range) {
        const ptMode: string | undefined = (options && options.mode) || undefined
        let mode
        if (ptMode) {
          mode = mode === 'block' ? 'highest' : 'lowest'
        }
        Transforms.removeNodes(editor, {at: range, mode})
      }
    },
    removeAnnotation: (type: Type): void => {
      const {selection} = editor
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
              Transforms.setNodes(
                editor,
                {
                  markDefs: [...blockElement.markDefs.filter(def => def._key !== annotation._key)]
                },
                {mode: 'highest', voids: false, match: n => Array.isArray(n.markDefs)}
              )
              if (Range.isCollapsed(selection)) {
                editor.pteExpandToWord()
              }
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
                  at: Editor.range(editor, [selection.anchor.path[0]], [selection.focus.path[0]]),
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
    },
    getSelection: useCallback(() => {
      return toPortableTextRange(editor)
    }, [selection])
  })

  const renderElement = useCallback(
    eProps => {
      if (isEqualToEmptyEditor(editor.children, portableTextFeatures)) {
        return <div {...eProps.attributes}>{eProps.children}</div>
      }
      return (
        <Element
          {...eProps}
          portableTextFeatures={portableTextFeatures}
          readOnly={readOnly}
          renderBlock={props.renderBlock}
          renderChild={props.renderChild}
        />
      )
    },
    [props.value]
  )

  const renderLeaf = useCallback(
    lProps => {
      if (isEqualToEmptyEditor(editor.children, portableTextFeatures)) {
        return <span {...lProps.attributes}>{lProps.children}</span>
      }
      return (
        <Leaf
          {...lProps}
          portableTextFeatures={portableTextFeatures}
          renderAnnotation={props.renderAnnotation}
          renderChild={props.renderChild}
          renderDecorator={props.renderDecorator}
          readOnly={readOnly}
        />
      )
    },
    [props.value]
  )

  const handleChange = val => {
    if (val !== stateValue) {
      setStateValue(val)
      // debug('Updated state value')
    } else {
      // debug('Not updating value because it is not changed')
    }
    if (editor.selection !== selection) {
      setSelection(editor.selection)
      // debug('Updated state selection', JSON.stringify(editor.selection))
    }
    // else {
    //   debug('Not updating selection because it is not changed')
    // }
  }

  // Test Slate decorations. Highlight the word 'w00t'
  // TODO: remove this and make something useful.
  const woot = 'w00t'
  const decorate = useCallback(
    ([node, path]) => {
      const ranges: Range[] = []

      if (woot && Text.isText(node)) {
        const {text} = node
        const parts = text.split(woot)
        let offset = 0

        parts.forEach((part, i) => {
          if (i !== 0) {
            ranges.push({
              anchor: {path, offset: offset - woot.length},
              focus: {path, offset},
              __highlight: true
            })
          }

          offset = offset + part.length + woot.length
        })
      }
      return ranges
    },
    [woot]
  )

  // Restore value from props
  useEffect(() => {
    if (props.isThrottling) {
      debug('Not setting value from props (throttling)')
      return
    }
    debug('Setting value from props')
    const slateValueFromProps = toSlateValue(props.value, portableTextFeatures.types.block.name)
    setStateValue(slateValueFromProps)
    change$.next({type: 'value', value: props.value})
  }, [props.value])

  // Restore selection from props
  useEffect(() => {
    const pSelection = props.selection
    if (
      pSelection &&
      !props.isThrottling &&
      ReactEditor.isFocused(editor) &&
      !isEqual(pSelection, toPortableTextRange(editor))
    ) {
      debug('Selection from props', pSelection)
      const normalizedSelection = normalizeSelection(pSelection, props.value)
      if (normalizedSelection !== null) {
        debug('Normalized selection from props', normalizedSelection)
        const slateRange = toSlateRange(normalizedSelection, editor)
        setSelection(slateRange)
      } else if (stateValue) {
        debug('Selecting top document')
        setSelection(SELECT_TOP_DOCUMENT)
      }
    }
  }, [props.selection])

  // Handle copy in the editor
  const handleCopy = (event: React.ClipboardEvent<HTMLDivElement>): void | ReactEditor => {
    if (props.onCopy) {
      const result = props.onCopy(event)
      // CopyFn may return something to avoid doing default stuff
      if (result !== undefined) {
        event.preventDefault()
        return
      }
    }
    if (hasEditableTarget(editor, event.target)) {
      // Set Portable Text on the clipboard
      setFragmentData(event.clipboardData, editor, portableTextFeatures)
      return editor
    }
  }

  // There's a bug in Slate atm regarding void nodes not being deleted. Seems related
  // to 'hanging: true' and 'voids: false'. 2020/05/26
  const handleCut = (event: React.ClipboardEvent<HTMLDivElement>): void | ReactEditor => {
    event.preventDefault()
    event.stopPropagation()
    if (editor.selection) {
      ReactEditor.setFragmentData(editor, event.clipboardData)
      Transforms.delete(editor, {at: editor.selection, voids: false, hanging: true})
      editor.onChange()
    }
    return editor
  }

  const handleSelect = useCallback(() => {
    // Do this on next tick
    setTimeout(() => {
      const newSelection = toPortableTextRange(editor)
      // debug('Emitting new selection', JSON.stringify(newSelection))
      change$.next({type: 'selection', selection: newSelection})
    }, 0)
  }, [selection])

  return (
    <Slate
      onChange={handleChange}
      editor={editor}
      selection={selection}
      value={getValue(stateValue, [createPlaceHolderBlock()])}
    >
      <SlateEditable
        autoFocus={false}
        decorate={decorate}
        onCopy={handleCopy}
        onCut={handleCut}
        onSelect={handleSelect}
        onFocus={() => change$.next({type: 'focus'})}
        onBlur={() => change$.next({type: 'blur'})}
        onKeyDown={editor.pteWithHotKeys}
        placeholder={placeholderText}
        readOnly={readOnly}
        renderElement={renderElement}
        renderLeaf={renderLeaf}
        spellCheck={spellCheck}
      />
    </Slate>
  )
}

function getValue(value, initialValue) {
  if (Array.isArray(value) && value.length > 0) {
    return value
  }
  return initialValue
}
