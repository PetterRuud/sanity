import {DocumentActionComponent} from '@sanity/base'
import {TrashIcon} from '@sanity/icons'
import {useDocumentOperation} from '@sanity/react-hooks'
import React, {useCallback, useState} from 'react'
import {
  unstable_useCheckDocumentPermission as useCheckDocumentPermission,
  useCurrentUser,
} from '@sanity/base/hooks'
import {InsufficientPermissionsMessage} from '@sanity/base/components'
import {ConfirmDelete} from '../components/ConfirmDelete'

const DISABLED_REASON_TITLE = {
  NOTHING_TO_DELETE: "This document doesn't yet exist or is already deleted",
}

export const DeleteAction: DocumentActionComponent = ({id, type, draft, published, onComplete}) => {
  const {delete: deleteOp}: any = useDocumentOperation(id, type)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isConfirmDialogOpen, setConfirmDialogOpen] = useState(false)

  const handleCancel = useCallback(() => {
    setConfirmDialogOpen(false)
    onComplete()
  }, [onComplete])

  const handleConfirm = useCallback(() => {
    setIsDeleting(true)
    setConfirmDialogOpen(false)
    deleteOp.execute()
    onComplete()
  }, [deleteOp, onComplete])

  const handle = useCallback(() => {
    setConfirmDialogOpen(true)
  }, [])

  const deletePermission = useCheckDocumentPermission(id, type, 'delete')

  const {value: currentUser} = useCurrentUser()

  if (!deletePermission.granted) {
    return {
      color: 'danger',
      icon: TrashIcon,
      disabled: true,
      label: 'Delete',
      title: (
        <InsufficientPermissionsMessage
          operationLabel="delete this document"
          currentUser={currentUser}
        />
      ),
    }
  }

  return {
    color: 'danger',
    dialog: isConfirmDialogOpen && {
      type: 'legacy',
      onClose: onComplete,
      content: (
        <ConfirmDelete
          draft={draft}
          published={published}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
        />
      ),
    },
    disabled: isDeleting || Boolean(deleteOp.disabled),
    icon: TrashIcon,
    label: isDeleting ? 'Deleting…' : 'Delete',
    onHandle: handle,
    shortcut: 'Ctrl+Alt+D',
    title: (deleteOp.disabled && DISABLED_REASON_TITLE[deleteOp.disabled]) || '',
  }
}
