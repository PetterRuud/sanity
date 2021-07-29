import React from 'react'
import {EditStateFor} from '@sanity/base/lib/datastores/document/document-pair/editState'
import {useEditState} from '@sanity/react-hooks'
import resolveDocumentBadges from 'part:@sanity/base/document-badges/resolver'
import styled from 'styled-components'
import {Box, Card, Flex} from '@sanity/ui'
import {useDocumentHistory} from '../documentHistory'
import {DocumentStatusBarActions, HistoryStatusBarActions} from './documentStatusBarActions'
import {DocumentSparkline} from './documentSparkline'

export interface DocumentStatusBarProps {
  id: string
  type: string
  lastUpdated?: string | null
}

const DocumentActionsBox = styled(Box)`
  min-width: 10em;
  max-width: 16em;
`

export function DocumentStatusBar(props: DocumentStatusBarProps) {
  const {historyController} = useDocumentHistory()
  const editState: EditStateFor | null = useEditState(props.id, props.type) as any
  const badges = editState ? resolveDocumentBadges(editState) : []
  const showingRevision = historyController.onOlderRevision()
  const revision = historyController.revTime?.id || ''

  return (
    <Card paddingX={[3, 4]} paddingY={[3, 3]}>
      <Flex align="center">
        <Box flex={[1, 2]}>
          <DocumentSparkline
            badges={badges}
            editState={editState}
            lastUpdated={props.lastUpdated}
          />
        </Box>

        <DocumentActionsBox flex={1} marginLeft={[1, 3]}>
          {showingRevision ? (
            <HistoryStatusBarActions id={props.id} type={props.type} revision={revision} />
          ) : (
            <DocumentStatusBarActions id={props.id} type={props.type} />
          )}
        </DocumentActionsBox>
      </Flex>
    </Card>
  )
}
