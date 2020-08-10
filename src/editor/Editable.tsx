import {Text, Range, Transforms, createEditor} from 'slate'
import {isEqual} from 'lodash'
import React, {useCallback, useMemo, useState, useEffect} from 'react'
import {Editable as SlateEditable, Slate, withReact, ReactEditor} from '@sanity/slate-react'
import {
  RenderChildFunction,
  RenderAnnotationFunction,
  RenderDecoratorFunction
} from '../types/editor'
import {
  EditorSelection,
  OnPasteFn,
  OnCopyFn,
  PatchObservable,
  RenderBlockFunction
} from '../types/editor'
import {createWithEditableAPI} from './plugins/createWithEditableAPI'
import {HotkeyOptions} from '../types/options'
import {toSlateValue, isEqualToEmptyEditor} from '../utils/values'
import {hasEditableTarget, setFragmentData} from '../utils/copyPaste'
import {createWithInsertData, createWithHotkeys} from './plugins'
import {Leaf} from './Leaf'
import {Element} from './Element'
import {withPortableText} from './withPortableText'
import {normalizeSelection, toPortableTextRange, toSlateRange} from '../utils/selection'
import {debugWithName} from '../utils/debug'
import {usePortableTextEditor} from './hooks/usePortableTextEditor'
import {usePortableTextEditorValue} from './hooks/usePortableTextEditorValue'

const debug = debugWithName('component:Editable')

type Props = {
  hotkeys?: HotkeyOptions
  incomingPatche$: PatchObservable
  onPaste?: OnPasteFn
  onCopy?: OnCopyFn
  placeholderText?: string
  renderAnnotation?: RenderAnnotationFunction
  renderBlock?: RenderBlockFunction
  renderChild?: RenderChildFunction
  renderDecorator?: RenderDecoratorFunction
  selection?: EditorSelection
  spellCheck?: boolean
}

const SELECT_TOP_DOCUMENT = {anchor: {path: [0, 0], offset: 0}, focus: {path: [0, 0], offset: 0}}

export const PortableTextEditable = (props: Props) => {
  const {hotkeys, incomingPatche$, placeholderText, spellCheck} = props

  const portableTextEditor = usePortableTextEditor()
  const value = usePortableTextEditorValue()

  if (!portableTextEditor) {
    return null
  }
  const {
    change$,
    isThrottling,
    keyGenerator,
    maxBlocks,
    portableTextFeatures,
    readOnly
  } = portableTextEditor

  const createPlaceHolderBlock = () => ({
    _type: portableTextFeatures.types.block.name,
    _key: keyGenerator(),
    style: 'normal',
    markDefs: [],
    children: [
      {
        _type: 'span',
        _key: keyGenerator(),
        text: '',
        marks: []
      }
    ]
  })

  // React/UI-spesific plugins
  const withInsertData = useMemo(
    () => createWithInsertData(change$, portableTextFeatures, keyGenerator),
    []
  )
  const withHotKeys = useMemo(
    () => createWithHotkeys(portableTextFeatures, keyGenerator, hotkeys),
    []
  )

  // Create the PortableTextEditor API
  const withEditableAPI = useMemo(
    () => createWithEditableAPI(portableTextEditor, portableTextFeatures, keyGenerator),
    []
  )

  // Init the Slate Editor
  const editor = useMemo(
    () =>
      withHotKeys(
        withInsertData(
          withEditableAPI(
            withReact(
              withPortableText(createEditor(), {
                portableTextFeatures: portableTextFeatures,
                keyGenerator,
                change$,
                maxBlocks,
                incomingPatche$,
                readOnly: readOnly
              })
            )
          )
        )
      ),
    []
  )

  // Track editor value
  const [stateValue, setStateValue] = useState(
    // Default value
    toSlateValue(
      getValueOrIntitialValue(value, [createPlaceHolderBlock()]),
      portableTextFeatures.types.block.name
    )
  )

  // Track selection state
  const [selection, setSelection] = useState(editor.selection)

  const renderElement = useCallback(
    eProps => {
      if (isEqualToEmptyEditor(editor.children, portableTextFeatures)) {
        return <div {...eProps.attributes}>{eProps.children}</div>
      }
      return (
        <Element
          {...eProps}
          keyGenerator={keyGenerator}
          portableTextFeatures={portableTextFeatures}
          readOnly={readOnly}
          renderBlock={props.renderBlock}
          renderChild={props.renderChild}
        />
      )
    },
    [value]
  )

  const renderLeaf = useCallback(
    lProps => {
      if (isEqualToEmptyEditor(editor.children, portableTextFeatures)) {
        return <span {...lProps.attributes}>{lProps.children}</span>
      }
      return (
        <Leaf
          {...lProps}
          keyGenerator={keyGenerator}
          portableTextFeatures={portableTextFeatures}
          renderAnnotation={props.renderAnnotation}
          renderChild={props.renderChild}
          renderDecorator={props.renderDecorator}
          readOnly={readOnly}
        />
      )
    },
    [value]
  )

  const handleChange = val => {
    if (val !== stateValue) {
      setStateValue(val)
    }
    if (editor.selection !== selection) {
      setSelection(editor.selection)
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
    if (isThrottling) {
      debug('Not setting value from props (throttling)')
      return
    }
    debug('Setting value from props')
    const slateValueFromProps = toSlateValue(value, portableTextFeatures.types.block.name)
    setStateValue(slateValueFromProps)
    change$.next({type: 'value', value: value})
  }, [value])

  // Restore selection from props
  useEffect(() => {
    const pSelection = props.selection
    if (pSelection && !isThrottling && !isEqual(pSelection, toPortableTextRange(editor))) {
      debug('Selection from props', pSelection)
      const normalizedSelection = normalizeSelection(pSelection, value)
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
      Transforms.collapse(editor)
      editor.onChange()
    }
    return editor
  }

  const handleSelect = () => {
    if (isThrottling) {
      return
    }
    // Do this on next tick
    setTimeout(() => {
      try {
        const newSelection = toPortableTextRange(editor)
        // debug('Emitting new selection', JSON.stringify(newSelection))
        change$.next({type: 'selection', selection: newSelection})
      } catch (err) {
        change$.next({type: 'selection', selection: null})
      }
    }, 0)
  }

  return (
    <Slate
      onChange={handleChange}
      editor={editor}
      selection={selection}
      value={getValueOrIntitialValue(stateValue, [createPlaceHolderBlock()])}
    >
      <SlateEditable
        className={'pt-editable'}
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

function getValueOrIntitialValue(value, initialValue) {
  if (Array.isArray(value) && value.length > 0) {
    return value
  }
  return initialValue
}
