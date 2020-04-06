import styled from 'styled-components'

function getHeaderSize(type: string) {
  switch (type) {
    case 'h1':
      return '4em'
    default:
      return `1em`
  }
}

function getContentForListLevelAndStyle(level, style) {
  const index = (level - 1) % 3
  const bullets = ['●', '○', '■']
  if (style === 'bullet') {
    return bullets[index]
  }
  return '*'
}

function getLeftForListLevel(level: number) {
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

export const TextBlock = styled.div`
  font-size: 1em;
  font-weight: 400;
  width: 100%;
  line-height: 1.5em;
  padding-bottom: 0.5em;
`

export const ListItem = styled.div`
  font-size: inherit;
  word-break: break-word;
`

export const ListItemInner = styled.div`
  font-size: inherit;
  position: relative;
  left: ${props => getLeftForListLevel(props.level)};
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

export const Normal = styled.div`
  font-size: inherit;
`
export const Header = styled.div`
  font-size: ${props => getHeaderSize(props.type)};
`

export const Strong = styled.span`
  font-weight: 700;
`
export const Em = styled.span`
  font-style: italic;
`

export const Code = styled.code``

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
    if (props.focused) {
      return '1px solid red'
    }
    if (props.selected) {
      return '1px solid red'
    }
    return 'none'
  }};
`
