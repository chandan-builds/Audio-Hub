/**
 * Sets the SDP to use Opus codec in mono, with low latency parameters.
 */
export function setOpusLowLatency(sdp: string): string {
  return sdp.replace(
    /a=fmtp:111 /g,
    "a=fmtp:111 stereo=0;sprop-stereo=0;maxaveragebitrate=64000;useinbandfec=1;ptime=10;"
  );
}
