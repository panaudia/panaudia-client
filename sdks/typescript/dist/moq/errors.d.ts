/**
 * Custom error types for the Panaudia MOQ client
 */
/**
 * Base error class for all MOQ client errors
 */
export declare class MoqClientError extends Error {
    readonly code: string;
    readonly details?: unknown | undefined;
    constructor(message: string, code: string, details?: unknown | undefined);
}
/**
 * Error thrown when WebTransport is not supported
 */
export declare class WebTransportNotSupportedError extends MoqClientError {
    constructor();
}
/**
 * Error thrown when connection fails
 */
export declare class ConnectionError extends MoqClientError {
    constructor(message: string, details?: unknown);
}
/**
 * Error thrown when authentication fails
 */
export declare class AuthenticationError extends MoqClientError {
    readonly moqErrorCode?: number | undefined;
    constructor(message: string, moqErrorCode?: number | undefined, details?: unknown);
    /**
     * Check if this is an invalid token error
     */
    isInvalidToken(): boolean;
    /**
     * Check if this is an expired token error
     */
    isExpiredToken(): boolean;
}
/**
 * Error thrown when JWT parsing fails
 */
export declare class JwtParseError extends MoqClientError {
    constructor(message: string, details?: unknown);
}
/**
 * Error thrown when MOQ protocol error occurs
 */
export declare class ProtocolError extends MoqClientError {
    readonly moqErrorCode?: number | undefined;
    constructor(message: string, moqErrorCode?: number | undefined, details?: unknown);
}
/**
 * Error thrown when subscription fails
 */
export declare class SubscriptionError extends MoqClientError {
    readonly moqErrorCode?: number | undefined;
    readonly trackNamespace?: string[] | undefined;
    constructor(message: string, moqErrorCode?: number | undefined, trackNamespace?: string[] | undefined, details?: unknown);
}
/**
 * Error thrown when announcement fails
 */
export declare class AnnouncementError extends MoqClientError {
    readonly moqErrorCode?: number | undefined;
    readonly namespace?: string[] | undefined;
    constructor(message: string, moqErrorCode?: number | undefined, namespace?: string[] | undefined, details?: unknown);
}
/**
 * Error thrown when the client is in an invalid state for an operation
 */
export declare class InvalidStateError extends MoqClientError {
    constructor(expectedState: string, actualState: string);
}
/**
 * Error thrown when a timeout occurs
 */
export declare class TimeoutError extends MoqClientError {
    constructor(operation: string, timeoutMs: number);
}
/**
 * Maps MOQ error codes to human-readable messages
 */
export declare function getMoqErrorMessage(code: number): string;
/**
 * Wraps an unknown error into a MoqClientError
 */
export declare function wrapError(error: unknown, defaultCode?: string): MoqClientError;
//# sourceMappingURL=errors.d.ts.map