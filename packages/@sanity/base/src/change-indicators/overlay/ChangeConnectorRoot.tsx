import React from 'react'
import {Path} from '@sanity/types'
import {ScrollContainer} from '../../components/scroll'
import {Tracker, ConnectorContext} from '../'
import {ENABLED} from '../constants'
import {ConnectorsOverlay} from './ConnectorsOverlay'

interface DisabledProps {
  className?: string
  children: React.ReactNode
}

interface EnabledProps {
  className?: string
  children: React.ReactNode
  isReviewChangesOpen: boolean
  onOpenReviewChanges: () => void
  onSetFocus: (path: Path) => void
}

function EnabledChangeConnectorRoot({
  children,
  className,
  onSetFocus,
  isReviewChangesOpen,
  onOpenReviewChanges,
}: EnabledProps) {
  const [rootRef, setRootRef] = React.useState<HTMLDivElement | null>()
  return (
    <ConnectorContext.Provider value={{isReviewChangesOpen, onOpenReviewChanges, onSetFocus}}>
      <Tracker>
        <ScrollContainer ref={setRootRef} className={className}>
          {children}
          {rootRef && <ConnectorsOverlay rootRef={rootRef} onSetFocus={onSetFocus} />}
        </ScrollContainer>
      </Tracker>
    </ConnectorContext.Provider>
  )
}

function DisabledChangeConnectorRoot({children, className}: DisabledProps) {
  return <ScrollContainer className={className}>{children}</ScrollContainer>
}

export const ChangeConnectorRoot = ENABLED
  ? EnabledChangeConnectorRoot
  : DisabledChangeConnectorRoot
