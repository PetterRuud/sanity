import React, {useCallback, useMemo, useState, useEffect} from 'react'
import {Editable as SlateEditable, Slate, withReact, ReactEditor} from 'slate-react'
import {toSlateRange} from '../utils/selection'
import {PortableTextFeatures, PortableTextBlock, PortableTextChild} from '../types/portableText'
import {EditorSelection, EditorChanges, OnPasteFn, OnCopyFn} from '../types/editor'
import {toSlateValue, fromSlateValue} from '../utils/values'
import {hasEditableTarget, setFragmentData} from '../utils/copyPaste'
import {createWithInsertData} from './plugins'

import {Leaf} from './Leaf'
import {Element} from './Element'
import {createPortableTextEditor} from './createPortableTextEditor'
import {toPortableTextRange, normalizeSelection} from '../utils/selection'

type Props = {
  change$: EditorChanges
  editorRef: any
  hotkeys?: {marks: {}}
  keyGenerator: () => string
  maxBlocks?: number
  onPaste?: OnPasteFn
  onCopy?: OnCopyFn
  placeholderText?: string
  portableTextFeatures: PortableTextFeatures
  readOnly?: boolean
  renderBlock?: (
    block: PortableTextBlock,
    attributes: {focused: boolean; selected: boolean}
  ) => JSX.Element
  renderChild?: (
    child: PortableTextChild,
    attributes: {focused: boolean; selected: boolean}
  ) => JSX.Element
  searchAndReplace?: boolean
  selection: EditorSelection
  singleUserUndoRedo?: boolean
  spellCheck?: boolean
  value?: PortableTextBlock[] | undefined
}

const SELECT_TOP_DOCUMENT = {anchor: {path: [0, 0], offset: 0}, focus: {path: [0, 0], offset: 0}}

export const Editable = (props: Props) => {
  const {
    change$,
    editorRef,
    hotkeys,
    keyGenerator,
    maxBlocks,
    placeholderText,
    portableTextFeatures,
    readOnly,
    searchAndReplace,
    singleUserUndoRedo,
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
            searchAndReplace,
            singleUserUndoRedo,
            createPlaceHolderBlock
          })
        )
      ),
    []
  )

  // Track editor value
  const [stateValue, setStateValue] = useState(
    toSlateValue(
      getValue(props.value, [createPlaceHolderBlock()]),
      portableTextFeatures.types.block.name
    )
  )

  // Track selection
  const [selection, setSelection] = useState(editor.selection)

  editorRef({editor, focus: () => ReactEditor.focus(editor)})

  const renderElement = useCallback(
    eProps => {
      const block = fromSlateValue([eProps.element], portableTextFeatures.types.block.name)[0]
      if (block) {
        const child = block.children && block.children.find(child => child._key === eProps._key)
        return (
          <Element
            {...eProps}
            block={block}
            child={child}
            portableTextFeatures={portableTextFeatures}
            renderBlock={props.renderBlock}
          />
        )
      }
      throw new Error('Could not resolve block')
    },
    [props.value, props.selection]
  )

  const renderLeaf = useCallback(
    lProps => {
      let block
      const blockNode =
        editor.children &&
        editor.children.find(blk => blk.children.find(child => child._key === lProps.leaf._key))
      if (blockNode) {
        block = fromSlateValue([blockNode], portableTextFeatures.types.block.name)[0]
      }
      return (
        <Leaf
          {...lProps}
          block={block}
          portableTextFeatures={portableTextFeatures}
          renderChild={props.renderChild}
        ></Leaf>
      )
    },
    [props.value, props.selection]
  )

  const handleChange = val => {
    setStateValue(val)
    setSelection(editor.selection)
    change$.next({type: 'selection', selection: toPortableTextRange(editor)})
  }

  // Test Slate decorations. Highlight the word 'banan'
  // TODO: remove this
  // const banan = 'banan'
  // const decorate = useCallback(
  //   ([node, path]) => {
  //     const ranges: Range[] = []

  //     if (banan && Text.isText(node)) {
  //       const {text} = node
  //       const parts = text.split(banan)
  //       let offset = 0

  //       parts.forEach((part, i) => {
  //         if (i !== 0) {
  //           ranges.push({
  //             anchor: {path, offset: offset - banan.length},
  //             focus: {path, offset},
  //             highlight: true
  //           })
  //         }

  //         offset = offset + part.length + banan.length
  //       })
  //     }
  //     return ranges
  //   },
  //   [banan]
  // )

  // Restore value from props
  useEffect(() => {
    const slateValueFromProps = toSlateValue(props.value, portableTextFeatures.types.block.name)
    setStateValue(slateValueFromProps)
  }, [props.value])

  // Restore selection from props
  useEffect(() => {
    const pSelection = props.selection
    if (props.selection) {
      const normalizedSelection = normalizeSelection(pSelection, props.value)
      if (normalizedSelection) {
        const slateRange = toSlateRange(normalizedSelection, props.value)
        setSelection(slateRange)
      } else if (stateValue) {
        setSelection(SELECT_TOP_DOCUMENT)
      }
    }
  }, [props.value])

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
        // decorate={decorate}
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
