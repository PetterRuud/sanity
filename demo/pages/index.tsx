import React, {useState, useRef} from 'react'
import {PortableTextEditor} from '../../lib'
import {PatchEvent} from '../../lib/patch/PatchEvent'
import {PortableTextBlock} from '../../lib/types/portableText'
import {EditorSelection, EditorChange} from '../../lib/types/editor'
import {Patch} from '../../lib/types/patch'
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

const intialValue = [
  {
    "_type": "block",
    "_key": "1586367983014-14",
    "style": "normal",
    "markDefs": [],
    "children": [
      {
        "_type": "span",
        "_key": "1586367983014-15",
        "text": "1234",
        "marks": []
      }
    ]
  }
]

/**
 * A basic standalone editor with hotkeys and value inspection
 */
const Standalone = () => {
  const [patches, setPatches] = useState([])
  const [value, setValue] = useState(intialValue)
  const [selection, setSelection] = useState(null)
  const editor: React.Ref<PortableTextEditor> = useRef()
  const handleChange = (change: EditorChange): void => {
    switch (change.type) {
      case 'patch':
        const appliedValue = applyAll(value, [change.patch])
        setValue(appliedValue)
        setPatches(patches.concat([change.patch]))
        break
      case 'selection':
        setSelection(change.selection)
        break
      case 'undo':
        // TODO:
        // const undoPatches: Patch[] = change.patches.map((undoPatch: Patch) => {
        //   let patch: Patch | false = false
        //   this.mutations
        //     .filter(mut => mut.timestamp > change.timestamp)
        //     .forEach((mutation: PatchWithOrigin) => {
        //       patch = transformOperation(mutation, {
        //         ...undoPatch,
        //         origin: 'local',
        //         timestamp: change.timestamp
        //       })
        //     })
        //   return patch || undoPatch
        // })
        if (change.selection) {
          setSelection(change.selection)
        }
        const undoedValue = applyAll(value || [], change.patches)
        setValue(undoedValue)
        setPatches(patches.concat(change.patches))
        break
      case 'mutation':
        setPatches(change.patches)
        break
      case 'blur':
      case 'mutation':
      case 'focus':
      case 'loading':
      case 'invalidValue':
      case 'value':
      case 'unset':
        break
      default:
        throw new Error(`Unhandled editor change ${JSON.stringify(change)}`)
    }
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
          hotkeys={HOTKEYS}
          value={value}
          keyGenerator={keyGenerator}
          maxBlocks={-1}
          spellCheck
          throttle={false}
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
