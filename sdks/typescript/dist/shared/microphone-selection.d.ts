/**
 * Automatic microphone selection — avoids Bluetooth microphones.
 *
 * Bluetooth audio devices in HFP/SCO mode (required for mic input) force
 * stereo output to collapse to mono. This module selects the best non-Bluetooth
 * microphone available, using label heuristics and sample-rate probing.
 */
export type MicrophoneType = 'bluetooth' | 'usb' | 'builtin' | 'unknown';
export interface ClassifiedMicrophone {
    deviceId: string;
    label: string;
    type: MicrophoneType;
    sampleRate?: number;
}
export interface MicrophoneSelectionResult {
    /** The selected device ID (or undefined to use system default). */
    deviceId: string | undefined;
    /** The label of the selected device. */
    label: string;
    /** Classification of the selected device. */
    type: MicrophoneType;
    /** All devices that were evaluated. */
    allDevices: ClassifiedMicrophone[];
    /** Whether the default mic was Bluetooth and we switched away from it. */
    switchedFromBluetooth: boolean;
}
/**
 * Classify a microphone based on its label.
 */
export declare function classifyByLabel(label: string): MicrophoneType;
/**
 * Select the best non-Bluetooth microphone.
 *
 * Flow:
 * 1. Request mic permission (opens default mic briefly to populate labels).
 * 2. Enumerate all audio input devices and classify by label.
 * 3. For any "unknown" devices, probe sample rate — ≤16kHz is likely Bluetooth.
 * 4. Return the highest-ranked non-Bluetooth device, or fall back to default.
 *
 * @param debug - Enable console logging of the selection process.
 */
export declare function selectBestMicrophone(debug?: boolean): Promise<MicrophoneSelectionResult>;
//# sourceMappingURL=microphone-selection.d.ts.map