import {Chunk, ChunkType} from '@sanity/field/diff'
import {
  TrashIcon,
  EditIcon,
  IconComponent,
  PublishIcon,
  UnpublishIcon,
  AddIcon,
  CloseIcon,
} from '@sanity/icons'

const LABELS: {[key: string]: string | undefined} = {
  create: 'created',
  delete: 'deleted',
  discardDraft: 'discarded draft',
  initial: 'created',
  editDraft: 'edited',
  editLive: 'live edited',
  publish: 'published',
  unpublish: 'unpublished',
}

const ICON_COMPONENTS: {[key: string]: IconComponent | undefined} = {
  create: AddIcon,
  delete: TrashIcon,
  discardDraft: CloseIcon,
  initial: AddIcon,
  editDraft: EditIcon,
  editLive: EditIcon,
  publish: PublishIcon,
  unpublish: UnpublishIcon,
}

export function formatTimelineEventLabel(type: ChunkType) {
  return LABELS[type]
}

export function getTimelineEventIconComponent(type: ChunkType): IconComponent | undefined {
  return ICON_COMPONENTS[type]
}

export function sinceTimelineProps(since: Chunk, rev: Chunk) {
  return {
    topSelection: rev,
    bottomSelection: since,
    disabledBeforeSelection: true,
  }
}

export function revTimelineProps(rev: Chunk) {
  return {
    topSelection: rev,
    bottomSelection: rev,
  }
}
