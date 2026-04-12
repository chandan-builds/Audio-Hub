/**
 * Ultra-low-latency Opus SDP configuration optimized for Bluetooth audio devices.
 *
 * Key parameters:
 * - stereo=0; sprop-stereo=0  → Mono (halves codec latency vs stereo)
 * - maxaveragebitrate=64000    → 64kbps, good quality mono (higher wastes BT bandwidth)
 * - useinbandfec=1             → Forward error correction inside the Opus stream
 * - usedtx=0                   → Disable Discontinuous Transmission (DTX adds jitter on resume)
 * - ptime=10; minptime=10      → 10ms audio frames (default 20ms; halves packetization latency)
 * - maxptime=20                → Never allow >20ms frames (caps worst-case BT latency)
 * - cbr=1                      → Constant bitrate (prevents BT buffer size fluctuations)
 */
export function setOpusLowLatency(sdp: string): string {
  // Replace existing Opus fmtp line
  let modified = sdp.replace(
    /a=fmtp:111 [^\r\n]*/g,
    "a=fmtp:111 stereo=0;sprop-stereo=0;maxaveragebitrate=64000;useinbandfec=1;usedtx=0;ptime=10;minptime=10;maxptime=20;cbr=1",
  );

  // If no fmtp:111 line existed, insert one after the Opus rtpmap line
  if (!modified.includes("a=fmtp:111")) {
    modified = modified.replace(
      /(a=rtpmap:111 opus\/48000\/2\r?\n)/g,
      "$1a=fmtp:111 stereo=0;sprop-stereo=0;maxaveragebitrate=64000;useinbandfec=1;usedtx=0;ptime=10;minptime=10;maxptime=20;cbr=1\r\n",
    );
  }

  // Force ptime attribute at session level for extra compatibility
  if (!modified.includes("a=ptime:")) {
    modified = modified.replace(
      /(a=rtpmap:111 opus\/48000\/2\r?\n)/g,
      "$1a=ptime:10\r\n",
    );
  }

  return modified;
}

/**
 * Bluetooth-optimized audio constraints for getUserMedia.
 *
 * Design decisions for BT low latency:
 * - echoCancellation: true     → Essential to avoid feedback loops with BT speakers
 * - noiseSuppression: false    → Adds ~10-20ms processing latency, bad for BT
 * - autoGainControl: false     → Adds variable latency, BT devices handle gain internally
 * - channelCount: 1            → Mono reduces BT codec processing time (especially SBC/AAC)
 * - sampleRate: 48000          → Opus native rate, avoids resampling latency
 * - latency: 0.01              → Request minimum 10ms buffer from browser
 * - sampleSize: 16             → 16-bit audio, sufficient for voice, lighter on BT bandwidth
 */
export const BLUETOOTH_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
  sampleRate: 48000,
  sampleSize: 16,
} as MediaTrackConstraints;

// Applied at runtime — TS doesn't type `latency` on MediaTrackConstraints
(BLUETOOTH_AUDIO_CONSTRAINTS as any).latency = 0.01;

/**
 * Creates an AudioContext tuned for ultra-low latency.
 * latencyHint: "interactive" tells the browser to use the smallest safe buffer size.
 * sampleRate: 48000 matches Opus native rate, eliminating resampling overhead.
 */
export function createLowLatencyAudioContext(): AudioContext {
  return new AudioContext({
    latencyHint: "interactive",
    sampleRate: 48000,
  });
}
