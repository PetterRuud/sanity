import React, {useState, useMemo, useCallback} from 'react'
import isHotkey from 'is-hotkey'
import {createEditor, Editor} from 'slate'
import {Slate, Editable, withReact} from 'slate-react'
import {withHistory} from 'slate-history'
import {EditorNode, EditorOperation} from '../types/editor'
import {PortableTextFeatures, PortableTextBlock} from '../types/portableText'
import {
  createWithNormalizeBlockPlugin,
  createWithKeysPlugin,
  createWithPortableTextMarkModel
} from './slate-plugins'
import {keyGenerator} from './PortableTextEditor'
import {Leaf} from './Leaf'
import {Element} from './Element'

const HOTKEYS = {
  'mod+b': 'strong',
  'mod+i': 'em',
  'mod+u': 'underline',
  'mod+`': 'code'
}

export type Props = {
  keyGenerator: () => string
  value?: PortableTextBlock[]
  onChange: (operations: EditorOperation[], value: EditorNode[]) => void
  placeholderText?: string
  portableTextFeatures: PortableTextFeatures
}

export const SlateEditor = (props: Props) => {
  const {portableTextFeatures} = props
  const initialValue = [
    {
      _type: portableTextFeatures.types.block.name,
      _key: props.keyGenerator(),
      __placeHolderBlock: true,
      style: 'normal',
      markDefs: [],
      children: [
        {
          _type: 'span',
          _key: props.keyGenerator(),
          text: '',
          marks: ['strong']
        }
      ]
    }
  ]
  const renderElement = useCallback(
    cProps => <Element {...cProps} portableTextFeatures={portableTextFeatures} />,
    []
  )
  const renderLeaf = useCallback(
    cProps => <Leaf {...cProps} portableTextFeatures={portableTextFeatures} />,
    []
  )
  // Track editor value
  const [value, setValue] = useState(getValue(props.value, initialValue))
  // Plugins
  const withNormalizeBlock = createWithNormalizeBlockPlugin(portableTextFeatures, keyGenerator)
  const withKeys = createWithKeysPlugin(keyGenerator)
  const withPortableTextMarkModel = createWithPortableTextMarkModel()
  // Init editor
  const editor = useMemo(
    () =>
      withKeys(
        withPortableTextMarkModel(withNormalizeBlock(withHistory(withReact(createEditor()))))
      ),
    []
  )
  const handleOnChange = (value: any[]) => {
    setValue(value)
    props.onChange(editor.operations, value)
  }
  return (
    <Slate editor={editor} value={value} onChange={handleOnChange}>
      <Editable
        placeholder={props.placeholderText}
        renderElement={renderElement}
        renderLeaf={renderLeaf}
        onKeyDown={event => {
          for (const hotkey in HOTKEYS) {
            if (isHotkey(hotkey, event.nativeEvent)) {
              event.preventDefault()
              const mark = HOTKEYS[hotkey]
              toggleMark(editor, mark)
            }
          }
        }}
      />
    </Slate>
  )
}

function getValue(propsValue, initialValue) {
  if (Array.isArray(propsValue) && propsValue.length > 0) {
    return propsValue
  }
  return initialValue
}

function isMarkActive(editor: Editor, mark: string) {
  const existingMarks =
  {
    ...(Editor.marks(editor) || {})
  }.marks || []
  return existingMarks ? existingMarks.includes(mark) : false
}

function toggleMark(editor: Editor, format: string) {
  const isActive = isMarkActive(editor, format)
  if (isActive) {
    Editor.removeMark(editor, format)
  } else {
    Editor.addMark(editor, format, true)
  }
}
