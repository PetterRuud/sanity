import React, {useState, useRef} from 'react'
import {PortableTextEditor} from '../../lib'
import {PatchEvent} from '../../lib/patch/PatchEvent'
import {PortableTextBlock} from '../../lib/types/portableText'
import {EditorSelection} from '../../lib/types/editor'
import {ValueContainer, EditorContainer} from '../components/containers'
import {applyAll} from '../../src/patch/applyPatch'
import {keyGenerator} from '../keyGenerator'
import {createHelloFromPropsValue} from '../fixtures/values'
import {portableTextType} from '../schema'

const HOTKEYS = {
  marks: {
    'mod+b': 'strong',
    'mod+i': 'em',
    'mod+´': 'code'
  }
}

/**
 * A basic standalone editor with hotkeys and value inspection
 */
const Standalone = () => {
  const [patches, setPatches] = useState([])
  const [value, setValue] = useState()
  const [selection, setSelection] = useState(null)
  const editor: React.Ref<PortableTextEditor> = useRef()
  const handleChange = (event: PatchEvent, editorValue: PortableTextBlock[]) => {
    setPatches(event.patches)
    const appliedValue = applyAll(value, event.patches)
    setValue(appliedValue)
  }
  const handleSelectionChange = (selection: EditorSelection) => {
    setSelection(selection)
  }
  const setValueFromProps = () => {
    const ed = editor && editor.current
    const val = createHelloFromPropsValue()
    setValue(val)
    if (val && val[0]) {
      const path = [{_key: val[2]._key}, 'children', {_key: val[2].children[0]._key}]
      const sel: EditorSelection = {
        anchor: {path, offset: 0},
        focus: {path, offset: 0}
      }
      setSelection(sel)
      const ed = editor && editor.current
      if (ed) {
        ed.focus()
      }
    }
  }
  return (
    <div>
      <h2>Portable Text Editor</h2>
      <p>
        This editor is completely controlled by outside props. When something changes in the editor,
        a patch is received here, and applied to the local value state. This state is then sent down
        as the value prop to the editor, making it a fully controlled component.
      </p>
      <button onClick={() => setValueFromProps()}>Set value from props</button>
      <p>
        <strong>Registered hotkeys:</strong> {JSON.stringify(HOTKEYS)}
      </p>
      <EditorContainer>
        <PortableTextEditor
          ref={editor}
          placeholderText="Type here!"
          type={portableTextType}
          onChange={handleChange}
          selection={selection}
          onSelectionChange={handleSelectionChange}
          hotkeys={HOTKEYS}
          value={value}
          keyGenerator={keyGenerator}
          maxBlocks={-1}
          spellCheck
          readOnly={false}
        />
      </EditorContainer>
      <h3>Editor value:</h3>
      <ValueContainer>{value ? JSON.stringify(value, null, 2) : 'Not set'}</ValueContainer>
      <h3>Editor patches:</h3>
      <ValueContainer style="small">
        {patches ? JSON.stringify(patches, null, 2) : 'None'}
      </ValueContainer>
    </div>
  )
}

export default Standalone
