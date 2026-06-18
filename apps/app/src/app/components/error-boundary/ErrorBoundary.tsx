import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorFallback } from './ErrorFallback';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 'app' wraps the whole shell; 'route' wraps a single routed page. */
  level?: 'app' | 'route';
  /** Optional custom fallback. Receives the error + a reset callback. */
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render/lifecycle errors in its subtree and shows a recoverable
 * fallback instead of a blank screen (React unmounts the whole tree on an
 * uncaught render error). Used at two levels:
 *  - app: around the entire shell (last line of defence).
 *  - route: around each routed page, remounted per route via a `key` so
 *    navigating away clears a page-local error automatically.
 *
 * Must be a class component — there is no hook equivalent for error boundaries.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to the console for now; a telemetry sink can hook in here later.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback({ error, reset: this.reset });
      }
      return (
        <ErrorFallback
          error={error}
          reset={this.reset}
          level={this.props.level ?? 'route'}
        />
      );
    }
    return this.props.children;
  }
}
