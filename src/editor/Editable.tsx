import {Text, Range, Transforms, Editor} from 'slate'
import {isEqual} from 'lodash'
import React, {useCallback, useMemo, useState, useEffect, useLayoutEffect} from 'react'
import {Editable as SlateEditable, Slate, withReact, ReactEditor} from 'slate-react'
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
import {toSlateValue, fromSlateValue} from '../utils/values'
import {hasEditableTarget, setFragmentData} from '../utils/copyPaste'
import {createWithInsertData} from './plugins'
import {Leaf} from './Leaf'
import {Element} from './Element'
import {createPortableTextEditor} from './createPortableTextEditor'
import {
  normalizeSelection,
  toPortableTextRange,
  toSlateRange,
  createKeyedPath
} from '../utils/selection'
import {Type as SchemaType} from 'src/types/schema'
import {debugWithName} from '../utils/debug'

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

  // Init Editor
  const editor = useMemo(
    () =>
      createWithInsertData(
        change$,
        portableTextFeatures,
        keyGenerator
      )(
        withReact(
          createPortableTextEditor({
            portableTextFeatures,
            keyGenerator,
            change$,
            maxBlocks,
            hotkeys,
            incomingPatche$
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
      Transforms.deselect(editor)
    },
    focusBlock: (): PortableTextBlock | undefined => {
      if (editor.selection) {
        const [node] = Editor.node(editor, editor.selection.focus, {depth: 1})
        if (node) {
          return fromSlateValue([node], portableTextFeatures.types.block.name)[0]
        }
      }
      return undefined
    },
    focusChild: (): PortableTextChild | undefined => {
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
    },
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
      )[0]
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
    hasBlockStyle: (style: string): boolean => {
      return editor.pteHasBlockStyle(style)
    },
    isVoid: (element: PortableTextBlock | PortableTextChild) => {
      return ![
        portableTextFeatures.types.block.name,
        portableTextFeatures.types.span.name
      ].includes(element._type)
    },
    findByPath: (path: Path): [PortableTextBlock | PortableTextChild | undefined, Path | undefined] => {
      const slatePath = toSlateRange({focus: {path, offset: 0}, anchor: {path, offset: 0}}, editor)
      if (slatePath) {
        const [node] = Editor.node(editor, slatePath.focus.path.slice(0, 2), {})
        if (node) {
          return [
            fromSlateValue([node], portableTextFeatures.types.block.name)[0],
            createKeyedPath(slatePath.focus, editor) || []
          ]
        }
      }
      return [undefined, undefined]
    },
    findDOMNode: (element: PortableTextBlock | PortableTextChild) => {
      const [item] = Array.from(
        Editor.nodes(editor, {at: [], match: n => n._key === element._key})
      )[0]
      return ReactEditor.toDOMNode(editor, item)
    }
  })

  const renderElement = useCallback(
    eProps => {
      const value = fromSlateValue([eProps.element], portableTextFeatures.types.block.name)[0]
      if (value) {
        return (
          <Element
            {...eProps}
            value={value}
            portableTextFeatures={portableTextFeatures}
            renderBlock={props.renderBlock}
            renderChild={props.renderChild}
          />
        )
      }
      throw new Error('Could not resolve block')
    },
    [props.value]
  )

  const renderLeaf = useCallback(
    lProps => {
      const block = lProps.children.props.parent
      return (
        <Leaf
          {...lProps}
          block={block}
          portableTextFeatures={portableTextFeatures}
          renderChild={props.renderChild}
        ></Leaf>
      )
    },
    [props.value]
  )

  const handleChange = val => {
    setStateValue(val)
    setSelection(editor.selection)
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
              highlight: true
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
    const slateValueFromProps = toSlateValue(props.value, portableTextFeatures.types.block.name)
    if (!props.isThrottling) {
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
    const newSelection = toPortableTextRange(editor)
    change$.next({type: 'selection', selection: newSelection})
    // debug('Set new selection state', JSON.stringify(newSelection))
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
        autoFocus={true}
        decorate={decorate}
        onCopy={handleCopy}
        onFocus={() => change$.next({type: 'focus'})}
        onBlur={() => change$.next({type: 'blur'})}
        onKeyDown={event => editor.pteWithHotKeys(editor, event)}
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
