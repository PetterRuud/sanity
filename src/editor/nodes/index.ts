import styled from 'styled-components'
import TextComponent from './Text'

// Text components
export const Text = TextComponent

export const TextBlock = styled.div`
  font-size: 1em;
  font-weight: 400;
  width: 100%;
  line-height: 1.5em;
  padding-bottom: 0.5em;
`

export const TextNormal = styled.div`
  font-size: inherit;
`
export const TextHeader = styled.div`
  line-height: 1.2em;
  padding-bottom: ${({headerStyle}) => getHeaderPaddingSize(headerStyle)};
  padding-top: ${({headerStyle}) => getHeaderPaddingSize(headerStyle)};
  font-size: ${({headerStyle}) => getHeaderSize(headerStyle)};
`

export const TextStrong = styled.span`
  font-weight: 700;
`
export const TextEmphasis = styled.span`
  font-style: italic;
`
export const TextCode = styled.code``

export const TextUnderline = styled.span`
  text-decoration: underline;
`
export const TextStrikeThrough = styled.span`
  text-decoration: line-through;
`

export const BlockObject = styled.div`
  user-select: none;
  border: ${props => {
    if (props.selected) {
      return '1px solid blue'
    }
    return '1px solid transparent'
  }};
`

export const InlineObject = styled.span`
  background: #999;
  border: ${props => {
    if (props.selected) {
      return '1px solid blue'
    }
    return '1px solid transparent'
  }};
`

// List items

const bullets = ['●', '○', '■']

export const TextListItem = styled.div`
  font-size: inherit;
  word-break: inherit;
`

export const TextListItemInner = styled.div`
  font-size: inherit;
  position: relative;
  left: ${props => getLeftPositionForListLevel(props.level)};
  display: flex;
  margin: 0;
  padding: 0;
  width: 100%;
  line-height: 1.5rem;
  &:before {
    content: '${props => getContentForListLevelAndStyle(props.level, props.listStyle)}';
    font-size: 0.4375rem;
    line-height: 1.5rem;
    position: relative;
    top: 1px;
    justify-content: flex-start;
    vertical-align: top;
    margin-right: 1em;
    margin-left: 1em;
  }
`

function getHeaderSize(style: string) {
  switch (style) {
    case 'h1':
      return '2.625rem'
    case 'h2':
      return '2rem'
    case 'h3':
      return '1.75rem'
    case 'h4':
      return '1.25rem'
    case 'h5':
      return '1rem'
    case 'h6':
      return '0.875rem'
    default:
      return `1rem`
  }
}

function getHeaderPaddingSize(style: string) {
  switch (style) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
      return '1rem'
    default:
      return `0.5rem`
  }
}

function getContentForListLevelAndStyle(level, style) {
  const normalizedLevel = (level - 1) % 3
  if (style === 'bullet') {
    return bullets[normalizedLevel]
  }
  return '*'
}

function getLeftPositionForListLevel(level: number) {
  switch (Number(level)) {
    case 1:
      return '1.5em'
    case 2:
      return '3em'
    case 3:
      return '4.5em'
    case 4:
      return '6em'
    case 5:
      return '7.5em'
    case 6:
      return '9em'
    case 7:
      return '10.5em'
    case 8:
      return '12em'
    case 9:
      return '13.5em'
    case 10:
      return '15em'
    default:
      return '0em'
  }
}
