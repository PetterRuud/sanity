import {DocumentActionComponent} from '@sanity/base'
import React, {useCallback, useState} from 'react'

export const TestSuccessDialogAction: DocumentActionComponent = (props) => {
  const {onComplete} = props
  const [dialogOpen, setDialogOpen] = useState(false)

  const handle = useCallback(() => {
    setDialogOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setDialogOpen(true)
    onComplete()
  }, [onComplete])

  return {
    color: 'success',
    label: 'Test success dialog',
    dialog: dialogOpen && {
      type: 'success',
      title: (
        <>
          This is the <code>success</code> dialog
        </>
      ),
      onClose: handleClose,
    },
    onHandle: handle,
  }
}
