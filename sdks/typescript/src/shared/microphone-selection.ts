/**
 * Automatic microphone selection — avoids Bluetooth microphones.
 *
 * Bluetooth audio devices in HFP/SCO mode (required for mic input) force
 * stereo output to collapse to mono. This module selects the best non-Bluetooth
 * microphone available, using label heuristics and sample-rate probing.
 */

// ── Bluetooth detection keywords ────────────────────────────────────────────

/** Keywords that strongly indicate a Bluetooth device (case-insensitive). */
const BLUETOOTH_KEYWORDS = [
  'bluetooth',
  'bt ',
  'bt-',
  // HFP/SCO profile indicators (sometimes exposed in device labels)
  'hands-free',
  'handsfree',
  'hfp',
  'sco',
  'a2dp',
];

/** Known Bluetooth product/brand names (case-insensitive). */
const BLUETOOTH_BRANDS = [
  'airpods',
  'beats ',
  'beats+',
  'beatsx',
  'powerbeats',
  'jabra',
  'galaxy buds',
  'buds pro',
  'buds live',
  'buds2',
  'buds fe',
  'sony wh-',
  'sony wf-',
  'bose qc',
  'bose quietcomfort',
  'bose noise cancelling',
  'bose soundsport',
  'bose sport',
  'jbl tune',
  'jbl live',
  'jbl reflect',
  'jbl endurance',
  'sennheiser momentum',
  'sennheiser cx',
  'marshall major',
  'marshall minor',
  'marshall motif',
  'pixel buds',
  'nothing ear',
  'huawei freebuds',
  'oppo enco',
  'oneplus buds',
  'anker soundcore',
  'soundcore liberty',
  'skullcandy',
  'tozo',
  'jlab',
];

/** Keywords indicating a USB microphone. */
const USB_KEYWORDS = [
  'usb',
  // Well-known USB mic brands
  'blue yeti',
  'blue snowball',
  'rode nt-usb',
  'rode podcaster',
  'at2020',
  'at2005',
  'samson',
  'focusrite',
  'scarlett',
  'behringer',
  'presonus',
  'elgato wave',
  'hyperx quadcast',
  'razer seiren',
  'fifine',
  'maono',
  'audio-technica',
  'shure mv',
];

/** Keywords indicating a built-in microphone. */
const BUILTIN_KEYWORDS = [
  'built-in',
  'builtin',
  'internal',
  'macbook',
  'imac',
  'integrated',
  'laptop',
  'webcam',
  'facetime',
];

// ── Classification ──────────────────────────────────────────────────────────

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
export function classifyByLabel(label: string): MicrophoneType {
  const lower = label.toLowerCase();

  // Check Bluetooth first — a device could match both BT and USB keywords
  for (const keyword of BLUETOOTH_KEYWORDS) {
    if (lower.includes(keyword)) return 'bluetooth';
  }
  for (const brand of BLUETOOTH_BRANDS) {
    if (lower.includes(brand)) return 'bluetooth';
  }

  for (const keyword of USB_KEYWORDS) {
    if (lower.includes(keyword)) return 'usb';
  }

  for (const keyword of BUILTIN_KEYWORDS) {
    if (lower.includes(keyword)) return 'builtin';
  }

  return 'unknown';
}

/**
 * Probe a microphone's sample rate by briefly opening it.
 * Returns the sample rate, or null if probing failed.
 */
async function probeSampleRate(deviceId: string): Promise<number | null> {
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } },
      video: false,
    });
    const track = stream.getAudioTracks()[0];
    if (!track) return null;
    const settings = track.getSettings();
    return settings.sampleRate ?? null;
  } catch {
    return null;
  } finally {
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
  }
}

// ── Ranking ─────────────────────────────────────────────────────────────────

/** Priority order: lower = better. */
const TYPE_PRIORITY: Record<MicrophoneType, number> = {
  usb: 0,
  builtin: 1,
  unknown: 2,
  bluetooth: 3,
};

function compareMicrophones(a: ClassifiedMicrophone, b: ClassifiedMicrophone): number {
  return TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
}

// ── Main selection function ─────────────────────────────────────────────────

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
export async function selectBestMicrophone(
  debug: boolean = false,
): Promise<MicrophoneSelectionResult> {
  const log = debug
    ? (...args: unknown[]) => console.log('[MicSelection]', ...args)
    : () => {};

  // Step 1: Get permission so labels are populated.
  // We open the default mic, then immediately close it.
  let permissionStream: MediaStream | null = null;
  try {
    permissionStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
  } finally {
    if (permissionStream) {
      for (const track of permissionStream.getTracks()) {
        track.stop();
      }
    }
  }

  // Step 2: Enumerate and classify by label.
  const allDevices = await navigator.mediaDevices.enumerateDevices();
  const mics: ClassifiedMicrophone[] = allDevices
    .filter((d) => d.kind === 'audioinput')
    .map((d) => ({
      deviceId: d.deviceId,
      label: d.label || '(unlabelled)',
      type: classifyByLabel(d.label || ''),
    }));

  log('Enumerated microphones:', mics.map((m) => `${m.label} [${m.type}]`));

  if (mics.length === 0) {
    log('No microphones found, using system default');
    return {
      deviceId: undefined,
      label: '(none)',
      type: 'unknown',
      allDevices: [],
      switchedFromBluetooth: false,
    };
  }

  // Step 3: Probe unknown devices by sample rate.
  const unknowns = mics.filter((m) => m.type === 'unknown');
  for (const mic of unknowns) {
    // Skip the "default" virtual device — it mirrors another real device
    if (mic.deviceId === 'default') continue;

    log(`Probing sample rate for: ${mic.label}`);
    const sampleRate = await probeSampleRate(mic.deviceId);
    mic.sampleRate = sampleRate ?? undefined;

    if (sampleRate !== null && sampleRate <= 16000) {
      log(`  → ${sampleRate} Hz — reclassifying as bluetooth`);
      mic.type = 'bluetooth';
    } else if (sampleRate !== null) {
      log(`  → ${sampleRate} Hz — not bluetooth`);
    } else {
      log(`  → probe failed, keeping as unknown`);
    }
  }

  // Step 4: Rank and select.
  // Determine if the default/first mic is Bluetooth.
  const defaultMic = mics[0]!;
  const defaultIsBluetooth = defaultMic.type === 'bluetooth';

  // Sort by preference
  const ranked = [...mics].sort(compareMicrophones);
  const best = ranked[0]!;

  log('Ranked microphones:', ranked.map((m) => `${m.label} [${m.type}]`));
  log(`Selected: ${best.label} [${best.type}]`);

  if (defaultIsBluetooth && best.type !== 'bluetooth') {
    log(`Switched away from Bluetooth default: ${defaultMic.label}`);
  }

  return {
    deviceId: best.deviceId === 'default' ? undefined : best.deviceId,
    label: best.label,
    type: best.type,
    allDevices: mics,
    switchedFromBluetooth: defaultIsBluetooth && best.type !== 'bluetooth',
  };
}
