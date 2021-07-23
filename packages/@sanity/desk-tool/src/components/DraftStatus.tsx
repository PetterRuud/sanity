import {EditIcon} from '@sanity/icons'
import {Text} from '@sanity/ui'
import React from 'react'
import styled from 'styled-components'

const Root = styled(Text)`
  opacity: 0.5;
  color: inherit;
`

export const DraftStatus = () => (
  <Root
    aria-label="There are unpublished edits"
    role="image"
    size={1}
    title="There are unpublished edits"
  >
    <EditIcon />
  </Root>
)
