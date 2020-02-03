import React, {useState} from 'react'
import {PortableTextEditor} from '../../lib'
import {PatchEvent} from '../../lib/PatchEvent'
import {PortableTextBlock} from '../../lib/types/portableText'
import {ValueContainer, EditorContainer} from '../components/containers'
import {applyAll} from '../../src/patch/applyPatch'
import {isEqual} from 'lodash'
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
  const handleChange = (event: PatchEvent, editorValue: PortableTextBlock[]) => {
    setPatches(event.patches)
    const appliedValue = applyAll(value, event.patches)
    setValue(appliedValue)
  }
  return (
    <div>
      <h2>Portable Text Editor</h2>
      <p>
        This editor is completely controlled by outside props. When something changes in the editor,
        a patch is received here, and applied to the local value state. This state is then sent down
        as the value prop to the editor, making it a fully controlled component.
      </p>
      <button onClick={() => setValue(createHelloFromPropsValue())}>Set value from props</button>
      <p>
        <strong>Registered hotkeys:</strong> {JSON.stringify(HOTKEYS)}
      </p>
      <EditorContainer>
        <PortableTextEditor
          placeholderText="Type here!"
          type={portableTextType}
          onChange={handleChange}
          hotkeys={HOTKEYS}
          value={value}
          keyGenerator={keyGenerator}
        />
      </EditorContainer>
      <h3>Editor value:</h3>
      <ValueContainer>{value ? JSON.stringify(value, null, 2) : 'Not set'}</ValueContainer>
      <h3>Editor patches:</h3>
      <ValueContainer style="small">
        {value ? JSON.stringify(patches, null, 2) : 'None'}
      </ValueContainer>
    </div>
  )
}

export default Standalone
