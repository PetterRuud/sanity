import {Text, Range} from 'slate'
import React, {useCallback, useMemo, useState, useEffect, useLayoutEffect} from 'react'
import {Editable as SlateEditable, Slate, withReact, ReactEditor} from 'slate-react'
import {toSlateRange} from '../utils/selection'
import {PortableTextFeatures, PortableTextBlock, PortableTextChild} from '../types/portableText'
import {
  EditorSelection,
  EditorChanges,
  OnPasteFn,
  OnCopyFn,
  PatchObservable,
  EditableAPI
} from '../types/editor'
import {toSlateValue, fromSlateValue} from '../utils/values'
import {hasEditableTarget, setFragmentData} from '../utils/copyPaste'
import {createWithInsertData} from './plugins'
import {Leaf} from './Leaf'
import {Element} from './Element'
import {createPortableTextEditor} from './createPortableTextEditor'
import {normalizeSelection, toPortableTextRange} from '../utils/selection'
import {Type as SchemaType} from 'src/types/schema'
import {debugWithName} from '../utils/debug'

const debug = debugWithName('component:Editable')

type Props = {
  change$: EditorChanges
  editable: (args0) => EditableAPI
  hotkeys?: {marks: {}}
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
    attributes: {
      focused: boolean
      selected: boolean
    },
    defaultRender: (block: PortableTextBlock) => JSX.Element
  ) => JSX.Element
  renderChild?: (
    value: PortableTextChild,
    type: SchemaType,
    ref: React.RefObject<HTMLSpanElement>,
    attributes: {
      focused: boolean
      selected: boolean
    },
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
    focus: () => {
      setSelection(editor.selection || SELECT_TOP_DOCUMENT)
      ReactEditor.focus(editor)
    },
    toggleMark: (mark: string, selection?: EditorSelection) => {
      editor.pteToggleMark(mark)
      ReactEditor.focus(editor)
    },
    isMarkActive: (mark: string) => editor.pteIsMarkActive(mark),
    undo: () => editor.undo(),
    redo: () => editor.redo
  })

  const renderElement = useCallback(
    eProps => {
      const value = fromSlateValue([eProps.element], portableTextFeatures.types.block.name)[0]
      if (value && portableTextFeatures.types.blockContent.of) {
        const type = portableTextFeatures.types.blockContent.of.find(
          type => type.name === value._type
        )
        return (
          <Element
            {...eProps}
            value={value}
            type={type}
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
    if (pSelection && !props.isThrottling) {
      debug('Selection from props', pSelection)
      const normalizedSelection = normalizeSelection(pSelection, props.value)
      if (normalizedSelection !== null) {
        debug('Normalized selection from props', normalizedSelection)
        const slateRange = toSlateRange(normalizedSelection, props.value)
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
        autoFocus={false}
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
