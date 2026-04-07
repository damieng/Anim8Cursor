import { render, Component, type ComponentChildren } from 'preact'
import './index.css'
import { App } from './app.tsx'

class ErrorBoundary extends Component<{ children: ComponentChildren }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Unhandled render error:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div style="padding:2rem;font-family:system-ui;max-width:600px;margin:2rem auto">
          <h1 style="color:#b91c1c;margin:0 0 1rem">Something went wrong</h1>
          <pre style="background:#f3f4f6;padding:1rem;border-radius:0.5rem;overflow:auto;font-size:0.875rem;color:#991b1b">{this.state.error.message}</pre>
          <button
            onClick={() => this.setState({ error: null })}
            style="margin-top:1rem;padding:0.5rem 1rem;background:#2563eb;color:white;border:none;border-radius:0.375rem;cursor:pointer"
          >Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}

render(<ErrorBoundary><App /></ErrorBoundary>, document.getElementById('app')!)
