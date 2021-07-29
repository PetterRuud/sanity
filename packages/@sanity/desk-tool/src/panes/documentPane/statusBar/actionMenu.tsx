import {useId} from '@reach/auto-id'
import {DocumentActionDescription} from '@sanity/base'
import {ChevronDownIcon} from '@sanity/icons'
import {
  Box,
  Button,
  Flex,
  Hotkeys,
  Menu,
  MenuItem,
  Popover,
  Text,
  Tooltip,
  useClickOutside,
  useGlobalKeyDown,
  useLayer,
} from '@sanity/ui'
import React, {createElement, isValidElement, useCallback, useRef, useState} from 'react'
import {isValidElementType} from 'react-is'
import {ActionStateDialog} from './actionStateDialog'
import {LEGACY_BUTTON_COLOR_TO_TONE} from './constants'

export interface ActionMenuProps {
  actionStates: DocumentActionDescription[]
  onOpen: () => void
  onClose: () => void
  isOpen: boolean
  disabled: boolean
}

export function ActionMenuButton({
  actionStates,
  onOpen,
  onClose,
  disabled,
  isOpen,
}: ActionMenuProps) {
  const idPrefix = useId()
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [popoverElement, setPopoverElement] = useState<HTMLDivElement | null>(null)

  const handleCloseMenu = useCallback(() => {
    if (!isOpen) {
      return
    }

    const hasOpenDialog = actionStates.some((state) => state.dialog)

    // this is a bit hacky, but if there is a modal open, we should not close
    if (hasOpenDialog) return

    onClose()

    buttonRef.current?.focus()
  }, [actionStates, isOpen, onClose])

  return (
    <Popover
      id={`${idPrefix}-menu`}
      open={isOpen}
      placement="top-end"
      portal
      ref={setPopoverElement}
      content={
        <ActionMenu
          actionStates={actionStates}
          disabled={disabled}
          onClose={handleCloseMenu}
          popoverElement={popoverElement}
        />
      }
    >
      <Button
        aria-controls={`${idPrefix}-menu`}
        aria-haspopup="true"
        aria-label="Actions"
        disabled={disabled}
        icon={ChevronDownIcon}
        id={`${idPrefix}-button`}
        mode="ghost"
        onClick={isOpen ? onClose : onOpen}
        ref={buttonRef}
        selected={isOpen}
      />
    </Popover>
  )
}

function ActionMenu(props: {
  actionStates: DocumentActionDescription[]
  disabled: boolean
  onClose: () => void
  popoverElement: HTMLDivElement | null
}) {
  const {actionStates, disabled, onClose, popoverElement} = props
  const {isTopLayer} = useLayer()

  const handleClickOutside = useCallback(() => {
    if (!isTopLayer) return

    onClose()
  }, [isTopLayer, onClose])

  const handleGlobalKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isTopLayer) return

      if (event.key === 'Escape') {
        onClose()
      }
    },
    [isTopLayer, onClose]
  )

  useClickOutside(handleClickOutside, [popoverElement])
  useGlobalKeyDown(handleGlobalKeyDown)

  return (
    <Menu padding={1} shouldFocus="last">
      {actionStates.map((actionState, idx) => (
        <ActionMenuListItem
          actionState={actionState}
          disabled={disabled}
          // eslint-disable-next-line react/no-array-index-key
          key={idx}
        />
      ))}
    </Menu>
  )
}

function ActionMenuListItem({
  actionState,
  disabled,
}: {
  actionState: DocumentActionDescription
  disabled: boolean
}) {
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null)

  const tooltipContent = actionState.title && (
    <Box padding={2}>
      <Text size={1} muted>
        {actionState.title}
      </Text>
    </Box>
  )

  return (
    <>
      <MenuItem
        disabled={disabled || Boolean(actionState.disabled)}
        onClick={actionState.onHandle}
        padding={0}
        ref={setRootElement}
        tone={actionState.color && LEGACY_BUTTON_COLOR_TO_TONE[actionState.color]}
      >
        <Tooltip
          content={tooltipContent}
          disabled={!tooltipContent}
          fallbackPlacements={['left', 'bottom']}
          placement="top"
          portal
        >
          <Flex align="center" paddingX={3}>
            <Flex flex={1} paddingY={3}>
              {actionState.icon && (
                <Box marginRight={3}>
                  <Text>
                    {isValidElement(actionState.icon) && actionState.icon}
                    {isValidElementType(actionState.icon) && createElement(actionState.icon)}
                  </Text>
                </Box>
              )}

              <Text>{actionState.label}</Text>
            </Flex>

            {actionState.shortcut && (
              <Box marginLeft={3}>
                <Hotkeys keys={String(actionState.shortcut).split('+')} />
              </Box>
            )}
          </Flex>
        </Tooltip>
      </MenuItem>

      {/* Rendered outside MenuItem so "click" events won't trigger the `onHandle` callback */}
      {actionState.dialog && (
        <ActionStateDialog dialog={actionState.dialog} referenceElement={rootElement} />
      )}
    </>
  )
}
