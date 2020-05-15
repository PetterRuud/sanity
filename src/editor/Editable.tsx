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
import React, {useCallback, useMemo, useState, useEffect, useLayoutEffect} from 'react'
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
  EditableAPI
} from '../types/editor'
import {HotkeyOptions} from '../types/options'
import {toSlateValue, fromSlateValue, isEqualToEmptyEditor} from '../utils/values'
import {hasEditableTarget, setFragmentData} from '../utils/copyPaste'
import {createWithInsertData} from './plugins'
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
  renderBlock?: (
    value: PortableTextBlock,
    type: SchemaType,
    ref: React.RefObject<HTMLDivElement>,
    attributes: RenderAttributes,
    defaultRender: (block: PortableTextBlock) => JSX.Element
  ) => JSX.Element
  renderChild?: (
    value: PortableTextChild,
    type: SchemaType,
    ref: React.RefObject<HTMLSpanElement>,
    attributes: RenderAttributes,
    defaultRender: (child: PortableTextChild) => JSX.Element
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

  // Init Editor
  const editor = useMemo(
    () =>
      withInsertData(
        withReact(
          withPortableText(createEditor(), {
            portableTextFeatures,
            keyGenerator,
            change$,
            setMustAdjustSelection: (arg0: boolean) => setMustAdjustSelection(arg0),
            maxBlocks,
            hotkeys,
            incomingPatche$,
            readOnly: props.readOnly || false
          })
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

  const [mustAdjustSelection, setMustAdjustSelection] = useState(false)

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
    isMarkActive: (mark: string): boolean => editor.pteIsMarkActive(mark),
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
        const [block] = Array.from(
          Editor.nodes(editor, {at: editor.selection.focus, match: n => Editor.isBlock(editor, n)})
        )[0]
        if (block) {
          return fromSlateValue([block], portableTextFeatures.types.block.name)[0]
        }
      }
      return undefined
    }, [selection]),
    focusChild: useCallback((): PortableTextChild | undefined => {
      if (editor.selection) {
        const [node] = Array.from(
          Editor.nodes(editor, {
            mode: 'lowest',
            at: editor.selection.focus,
            match: n => n._type !== undefined,
            voids: true
          })
        )[0]
        if (node && !Editor.isBlock(editor, node)) {
          return fromSlateValue([node], portableTextFeatures.types.block.name)[0]
        }
      }
      return undefined
    }, [selection]),
    insertChild: (type: Type, value?: {[prop: string]: any}): void => {
      // TODO: test selection if inline is applicable
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
    },
    insertBlock: (type: Type, value?: {[prop: string]: any}): void => {
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
                  ...blockElement.markDefs.filter(def => def._type !== type.name),
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
        if (blockElement._type === portableTextFeatures.types.block.name) {
          if (Array.isArray(blockElement.markDefs)) {
            const annotation = blockElement.markDefs.find(def => def._type === type.name)
            if (annotation && annotation._key) {
              Transforms.setNodes(
                editor,
                {
                  markDefs: [...blockElement.markDefs.filter(def => def._type !== type.name)]
                },
                {voids: false, match: n => Array.isArray(n.markDefs)}
              )
              editor.pteExpandToWord()
              for (const [node, path] of Editor.nodes(editor, {
                at: selection,
                match: Text.isText
              })) {
                if (Array.isArray(node.marks)) {
                  Transforms.setNodes(
                    editor,
                    {
                      marks: [...node.marks.filter(mark => mark !== annotation._key)]
                    },
                    {at: path, voids: false, split: false, match: Text.isText}
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
          renderChild={props.renderChild}
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
      // debug('Updated state selection', mustAdjustSelection)
    } else {
      // debug('Not updating selection because it is not changed')
    }
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
    if (!props.isThrottling && mustAdjustSelection === false) {
      const slateValueFromProps = toSlateValue(props.value, portableTextFeatures.types.block.name)
      debug('Setting value from props')
      // TODO: figure out what is changed and only update that?
      setStateValue(slateValueFromProps)
    }
  }, [props.value, props.isThrottling])

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

  // When the selection state changes, emit that to change$
  // Note: since the selection is coupled to DOM selections,
  // we must useLayoutEffect for this, or the DOM selection will lag behind.
  useLayoutEffect(() => {
    try {
      const newSelection = toPortableTextRange(editor)
      change$.next({type: 'selection', selection: newSelection})
      // debug('Set new selection state', JSON.stringify(newSelection))
    } catch (err) {
      debug('Invalid selection', editor.selection)
    }
  }, [selection])

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
