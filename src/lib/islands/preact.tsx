import { Component, type ComponentChildren, type ComponentType } from "preact";

type BoundaryProps = { name: string; children: ComponentChildren };

/** Catches what an app throws while rendering or in its effects, so it fails alone and says so. */
class ErrorBoundary extends Component<BoundaryProps, { error: unknown }> {
  state = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    console.error(`[${this.props.name}] crashed:`, error);
  }

  render() {
    if (this.state.error === null) return this.props.children;
    return (
      <p role="alert" class="mx-auto max-w-screen-lg px-5 text-sm">
        Something went wrong in the {this.props.name}.{" "}
        <button type="button" class="underline underline-offset-2" onClick={() => location.reload()}>
          Reload
        </button>{" "}
        to try again.
      </p>
    );
  }
}

/**
 * Wraps a Preact app's top-level component before a route mounts it as an island: an error
 * boundary, inside a layout-neutral root element that carries the app's root class (a CSS module
 * class, so the app's styles stay within it).
 */
export function island<P extends object>(App: ComponentType<P>, { name, class: className }: { name: string; class?: string }) {
  const Island = (props: P) => (
    <div class={className} style={{ display: "contents" }}>
      <ErrorBoundary name={name}>
        <App {...props} />
      </ErrorBoundary>
    </div>
  );
  Island.displayName = `Island(${App.displayName ?? App.name})`;
  return Island;
}
