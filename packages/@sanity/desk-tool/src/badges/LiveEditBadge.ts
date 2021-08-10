import {DocumentBadgeComponent} from '@sanity/base'

export const LiveEditBadge: DocumentBadgeComponent = (props) => {
  return props.liveEdit
    ? {
        label: 'Live',
        color: 'danger',
      }
    : null
}
