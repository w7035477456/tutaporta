/**
 * ICE servers for in-site 1:1 speed dating (WebRTC).
 *
 * Default: public Google STUN only. Media still goes peer-to-peer, so R630 web
 * servers do not carry the 25 video feeds. Optional TURN (coturn on one R630)
 * relays the minority of callers behind symmetric NAT.
 *
 * ~/.ssh/be/.env:
 *   SPEED_DATE_STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
 *   SPEED_DATE_TURN_URLS=turn:YOUR_UBUNTU_HOST:3478?transport=udp
 *   SPEED_DATE_TURN_USERNAME=speeddate
 *   SPEED_DATE_TURN_CREDENTIAL=****
 */

const DEFAULT_STUN = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'];

function parseUrlList(raw, fallback = []) {
  const text = String(raw ?? '').trim();
  if (!text) return fallback;
  return text
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getSpeedDateIceServers() {
  const stunUrls = parseUrlList(process.env.SPEED_DATE_STUN_URLS, DEFAULT_STUN);
  const turnUrls = parseUrlList(process.env.SPEED_DATE_TURN_URLS);
  const username = String(process.env.SPEED_DATE_TURN_USERNAME ?? '').trim();
  const credential = String(process.env.SPEED_DATE_TURN_CREDENTIAL ?? '').trim();

  const servers = [];
  if (stunUrls.length) servers.push({ urls: stunUrls });
  if (turnUrls.length && username && credential) {
    servers.push({ urls: turnUrls, username, credential });
  }
  return servers;
}
