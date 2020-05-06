
import {PortableTextFeatures} from '../types/portableText'
import {Subject} from 'rxjs'
import {EditorChange, PatchObservable} from 'src/types/editor'

export type Options = {
  portableTextFeatures: PortableTextFeatures
  keyGenerator: () => string
  change$: Subject<EditorChange>
  maxBlocks?: number
  hotkeys?: HotkeyOptions
  incomingPatche$?: PatchObservable
}

export type HotkeyOptions = {
  marks?: Record<string, string>
  custom?: Record<string, ((event: React.BaseSyntheticEvent) => void)>
}
