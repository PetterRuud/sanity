import {Flex, rem, Text, Theme} from '@sanity/ui'
import {IconComponent, RestoreIcon} from '@sanity/icons'
import {ChunkType} from '@sanity/field/lib/diff'
import React, {createElement, isValidElement, useMemo} from 'react'
import {isValidElementType} from 'react-is'
import styled, {css, keyframes} from 'styled-components'
import {getTimelineEventIconComponent} from '../timeline/helpers'

export interface SessionBadgeProps {
  type: 'live' | ChunkType
  icon?: IconComponent
  style?: React.CSSProperties
  title?: string
}

const rotateAnimation = keyframes`
  0% {
    transform: rotate(0);
  }

  100% {
    transform: rotate(360deg);
  }
`

const Root = styled(Flex)(({theme}: {theme: Theme}) => {
  return css`
    --session-badge-size: ${rem(theme.sanity.avatar.sizes[0].size)};
    --session-badge-bg-color: var(--card-fg-color);
    --session-badge-fg-color: var(--card-bg-color);

    background-color: var(--session-badge-bg-color);
    color: var(--session-badge-fg-color);
    border-radius: calc(var(--session-badge-size) / 2);
    width: var(--session-badge-size);
    height: var(--session-badge-size);
    box-shadow: 0 0 0 1px var(--card-bg-color);

    [data-badge-icon-hover] {
      display: none;
    }

    @media (hover: hover) {
      button:not([data-disabled='true']):hover & {
        &[data-type] [data-badge-icon] {
          display: none;
        }

        &[data-type]:last-of-type [data-badge-icon-hover] {
          display: block;
        }
      }
    }

    button:not([data-disabled='true'])[data-selected] & {
      &[data-type] [data-badge-icon] {
        display: none;
      }

      &[data-type]:last-of-type [data-badge-icon-hover] {
        display: block;
      }
    }

    // Only show icon inside a badge if it's the last one/on the top
    &:not([data-type='publish']):not([data-type='live']):not(:last-of-type) [data-badge-icon] {
      display: none;
    }

    &[data-syncing='true']:last-of-type [data-sanity-icon] {
      animation-name: ${rotateAnimation};
      animation-duration: 1500ms;
      animation-timing-function: linear;
      animation-iteration-count: infinite;
    }

    /* Modify variables */

    &[data-type='publish'],
    &[data-type='live'] {
      --session-badge-bg-color: ${theme.sanity.color.solid.positive.enabled.bg};
    }

    &[data-type='editDraft'],
    &[data-type='unpublish'] {
      --session-badge-bg-color: ${theme.sanity.color.solid.caution.enabled.bg};
    }

    @media (hover: hover) {
      button:not([data-disabled='true']):hover & {
        --session-badge-bg-color: var(--card-fg-color);
        --session-badge-fg-color: var(--card-bg-color);
      }
    }

    button:not([data-disabled='true'])[data-selected] & {
      --session-badge-bg-color: var(--card-fg-color) !important;
    }

    [data-ui='DocumentSparkline'][data-disabled='true'] & {
      opacity: 0.2;
    }
  `
})

const IconText = styled(Text)`
  color: inherit;
`

export const SessionBadge = (props: SessionBadgeProps) => {
  const {type, title, icon: iconProp, ...restProps} = props

  const icon = useMemo(() => {
    if (iconProp) {
      return iconProp
    }

    if (type && type !== 'live') {
      return getTimelineEventIconComponent(type) || <code>{type}</code>
    }

    return null
  }, [iconProp, type])

  return (
    <Root
      data-type={type}
      data-ui="SessionBadge"
      align="center"
      justify="center"
      title={title}
      {...restProps}
    >
      <IconText size={1} data-badge-icon>
        {isValidElement(icon) && icon}
        {isValidElementType(icon) && createElement(icon)}
      </IconText>

      <IconText size={1} data-badge-icon-hover>
        <RestoreIcon />
      </IconText>
    </Root>
  )
}
