import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

/**
 * The last line of defence when a page throws while rendering.
 *
 * It used to say "Something went wrong" and nothing else. That is a dead end
 * for whoever hits it: the one person who can describe the fault is looking at
 * a screen that has deliberately hidden it, and the message never reaches
 * anyone who could fix it. The error, the page it happened on and the top of
 * the component stack are now on screen and copyable in one click.
 *
 * `window.location.assign` rather than `reload` on "Go to dashboard": reloading
 * a page that throws on render just throws again, which looks like the button
 * is broken.
 */
/** Marks that this session has already tried a reload, so it happens only once. */
const RETRY_KEY = "erp_chunk_reload";

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null, componentStack: null };
  private clearRetryTimer?: ReturnType<typeof setTimeout>;

  componentDidMount() {
    // The reload guard exists to stop a loop, not to spend the whole session.
    // If the app is still standing a few seconds after it mounted, the last
    // reload worked, so a chunk that fails an hour from now gets its own retry.
    // A page that throws again does so well inside this window, with the flag
    // still set, and stops.
    this.clearRetryTimer = setTimeout(() => {
      try { sessionStorage.removeItem(RETRY_KEY); } catch { /* private mode */ }
    }, 8000);
  }

  componentWillUnmount() {
    if (this.clearRetryTimer) clearTimeout(this.clearRetryTimer);
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ componentStack: errorInfo.componentStack ?? null });

    // A route chunk that failed to download is not a broken page -- it is a
    // request that did not arrive, usually on a weak connection or right after
    // a deploy replaced the file the open tab was told to ask for. Reloading
    // fetches the current index.html and the chunks it names, which fixes both.
    // Once per session only: if the reload lands on the same error the page
    // stays put and shows it, rather than looping.
    if (ErrorBoundary.isChunkLoadError(error) && !ErrorBoundary.alreadyRetried()) {
      try { sessionStorage.setItem(RETRY_KEY, "1"); } catch { /* private mode */ }
      window.location.reload();
    }
  }

  /** The several shapes browsers give a failed dynamic import. */
  private static isChunkLoadError(error: Error): boolean {
    const text = `${error?.name ?? ""} ${error?.message ?? ""}`;
    return (
      /Failed to fetch dynamically imported module/i.test(text) ||
      /error loading dynamically imported module/i.test(text) ||
      /Importing a module script failed/i.test(text) ||
      /ChunkLoadError/i.test(text)
    );
  }

  private static alreadyRetried(): boolean {
    try { return sessionStorage.getItem(RETRY_KEY) === "1"; } catch { return false; }
  }

  /** Everything someone would otherwise have to read off the screen and retype. */
  private details(): string {
    const { error, componentStack } = this.state;
    return [
      `Page:  ${window.location.pathname}${window.location.search}`,
      `Time:  ${new Date().toISOString()}`,
      `Error: ${error?.name ?? "Error"}: ${error?.message ?? "(no message)"}`,
      "",
      error?.stack ?? "(no stack)",
      "",
      "Component stack:",
      componentStack ?? "(none captured)",
    ].join("\n");
  }

  private copy = () => {
    navigator.clipboard?.writeText(this.details()).catch(() => {
      // Clipboard is blocked outside a secure context or without permission.
      // The text is on screen either way, which is the part that matters.
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error } = this.state;

    return (
      <div className="min-h-screen w-full overflow-auto bg-background p-6">
        <div className="mx-auto max-w-2xl space-y-4 py-10">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This page failed to render. The details below say what happened — send them over and
              it can be fixed properly.
            </p>
          </div>

          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="break-words font-mono text-sm font-medium text-destructive">
              {error?.name ?? "Error"}: {error?.message ?? "(no message)"}
            </p>
            <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
              on {window.location.pathname}
              {window.location.search}
            </p>
          </div>

          {/* The stack is folded away: it matters to whoever is fixing this and
              to nobody else, and unfolded it buries the two buttons. */}
          <details className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              Technical details
            </summary>
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">
              {this.details()}
            </pre>
          </details>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={this.copy}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Copy details
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg border px-4 py-2 text-sm transition-colors hover:bg-muted"
            >
              Reload
            </button>
            <button
              onClick={() => window.location.assign("/")}
              className="rounded-lg border px-4 py-2 text-sm transition-colors hover:bg-muted"
            >
              Go to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
