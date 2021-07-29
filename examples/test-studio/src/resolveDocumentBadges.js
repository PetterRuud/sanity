import defaultResolve from 'part:@sanity/base/document-badges'
import {SuccessBadge} from './badges/CustomBadge'
import {DangerBadge} from './badges/DangerBadge'

export default function resolveDocumentBadges(props) {
  if (props.type === 'documentActionsTest') {
    return [DangerBadge, SuccessBadge]
  }

  return defaultResolve(props)
}
