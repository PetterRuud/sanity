// @todo: remove the following line when part imports has been removed from this file
///<reference types="@sanity/types/parts" />

import {uuid} from '@sanity/uuid'
import {useDocumentOperation} from '@sanity/react-hooks'
import ContentCopyIcon from 'part:@sanity/base/content-copy-icon'
import {useRouter} from 'part:@sanity/base/router'
import React, {useCallback} from 'react'
import {
  unstable_useCheckDocumentPermission as useCheckDocumentPermission,
  useCurrentUser,
} from '@sanity/base/hooks'
import {InsufficientPermissionsMessage} from '@sanity/base/components'

const DISABLED_REASON_TITLE = {
  NOTHING_TO_DUPLICATE: "This document doesn't yet exist so there's nothing to duplicate",
}

export function DuplicateAction({id, type, onComplete}) {
  const {duplicate}: any = useDocumentOperation(id, type)
  const router = useRouter()

  const [isDuplicating, setDuplicating] = React.useState(false)

  const createPermission = useCheckDocumentPermission('dummy-id', type, 'create')

  const {value: currentUser} = useCurrentUser()

  const handle = useCallback(() => {
    const dupeId = uuid()

    setDuplicating(true)
    duplicate.execute(dupeId)
    router.navigateIntent('edit', {id: dupeId, type})
    onComplete()
  }, [duplicate, onComplete, router, type])

  if (!createPermission.granted) {
    return {
      icon: ContentCopyIcon,
      disabled: true,
      label: 'Duplicate',
      title: (
        <InsufficientPermissionsMessage
          operationLabel="duplicate this document"
          currentUser={currentUser}
        />
      ),
    }
  }

  return {
    icon: ContentCopyIcon,
    disabled: Boolean(isDuplicating || duplicate.disabled),
    label: isDuplicating ? 'Duplicating…' : 'Duplicate',
    title: (duplicate.disabled && DISABLED_REASON_TITLE[duplicate.disabled]) || '',
    onHandle: handle,
  }
}
