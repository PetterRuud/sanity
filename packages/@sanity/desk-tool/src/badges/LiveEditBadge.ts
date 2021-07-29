import {DocumentBadgeComponent} from '@sanity/base'

export const LiveEditBadge: DocumentBadgeComponent = (props) => {
  return props.liveEdit
    ? {
        label: 'Live document',
        color: 'success',
      }
    : null
}
