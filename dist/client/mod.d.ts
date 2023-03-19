/**
 * A client-side implementation of the ESM-HMR spec, for real.
 * See https://github.com/FredKSchott/esm-hmr
 */
declare global {
    interface ImportMeta {
        hot?: HotModuleState;
    }
}
type DisposeCallback = () => void;
type AcceptCallback = (args: {
    module: any;
    deps: any[];
}) => void;
type AcceptCallbackObject = {
    deps: string[];
    callback: AcceptCallback;
};
export declare class HotModuleState {
    #private;
    id: string;
    data: any;
    isLocked: boolean;
    isDeclined: boolean;
    isAccepted: boolean;
    acceptCallbacks: AcceptCallbackObject[];
    disposeCallbacks: DisposeCallback[];
    constructor(id: string, socket: WebSocket);
    lock(): void;
    dispose(callback: DisposeCallback): void;
    invalidate(): void;
    decline(): void;
    accept(_deps: string[], callback?: true | AcceptCallback): void;
}
export declare function useClient(importMeta: ImportMeta, socketUrl: string): void;
export {};
