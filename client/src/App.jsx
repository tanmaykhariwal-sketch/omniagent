import { Component } from 'react';
import ChatPage from './ChatPage.jsx';

// A single bad message row (e.g. a malformed API response) should not blank
// the whole app -- this catches render errors below it and offers a reload
// instead of a silent white screen.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="screen">
          <div className="auth-card">
            <p className="wordmark">OmniAgent</p>
            <p className="form-error">Something went wrong. Please reload the page.</p>
            <button className="btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <ChatPage />
    </ErrorBoundary>
  );
}
