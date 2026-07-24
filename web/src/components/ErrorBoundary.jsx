import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', margin: '2rem', background: '#fff3f3', border: '1px solid #fcc', borderRadius: '12px', color: '#c00' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>⚠ 渲染错误</h2>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{String(this.state.error)}</p>
          {this.state.errorInfo && (
            <details style={{ marginTop: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 500 }}>错误详情</summary>
              <pre style={{ marginTop: '0.5rem', fontSize: '0.75rem', overflow: 'auto', maxHeight: '300px', padding: '0.5rem', background: '#fff', border: '1px solid #fcc', borderRadius: '8px' }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button onClick={() => window.location.reload()} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#c00', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>重新加载</button>
        </div>
      );
    }
    return this.props.children;
  }
}