import type { ComponentType } from "preact";
import { island } from "@lib/islands/preact";
import theme from "./theme.module.css";

/** Wraps a top-level component that a route mounts: error boundary plus the map's colors. */
export function mapIsland<P extends object>(App: ComponentType<P>) {
  return island(App, { name: "travel map", class: theme.root });
}
