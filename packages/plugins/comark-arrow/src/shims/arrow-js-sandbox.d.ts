declare module '@arrow-js/sandbox' {
  export type HostBridgeFn = (...args: unknown[]) => unknown | Promise<unknown>
  export type HostBridgeModule = Record<string, HostBridgeFn>
  export type HostBridge = Record<string, HostBridgeModule>

  export interface SandboxEvents {
    output?: (payload: unknown) => void
  }

  export function sandbox(
    props: {
      source: Record<string, string>
      shadowDOM?: boolean
      debug?: boolean
      onError?: (error: Error | string) => void
    },
    events?: SandboxEvents,
    hostBridge?: HostBridge,
  ): ((el: HTMLElement | Element) => unknown) & Record<string, unknown>
}
