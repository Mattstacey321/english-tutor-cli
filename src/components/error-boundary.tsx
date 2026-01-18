import { Box, Text } from "ink";
import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    console.error("TUI Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box flexDirection="column" padding={2} borderStyle="round" borderColor="red">
          <Text color="red" bold>
            ⚠️  An unexpected error occurred
          </Text>
          <Box marginTop={1}>
            <Text color="gray">
              The application encountered an error and needs to restart.
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray">
              Error: {this.state.error?.message || "Unknown error"}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="yellow">
              Press Ctrl+C to exit and restart the application.
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray">
              Details have been logged to the console for debugging.
            </Text>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}