import React, {ReactNode} from 'react'

type Props = {
  children: ReactNode
  onError: (error, errorInfo) => void
}

export class ErrorBoundary extends React.Component<Props> {
  state = {
    hasError: false
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return {hasError: true}
  }

  componentDidCatch(error, errorInfo) {
    this.props.onError(error, errorInfo)
  }

  render() {
    return this.props.children
  }
}
