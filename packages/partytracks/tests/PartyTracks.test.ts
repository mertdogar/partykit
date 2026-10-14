import { firstValueFrom, of, timeout } from "rxjs";
import { afterEach, expect, test, vi } from "vitest";

import { PartyTracks } from "../src/client/PartyTracks";

// Just enough RTCPeerConnection for one pull: applying the SFU's offer adds
// the pulled transceiver and fires "track".
class FakePeerConnection extends EventTarget {
  connectionState = "new";
  signalingState = "stable";
  currentLocalDescription = { type: "answer", sdp: "" };
  transceivers: { mid: string; receiver: { track: { id: string } } }[] = [];
  getTransceivers() {
    return this.transceivers;
  }
  async setRemoteDescription() {
    this.transceivers.push({ mid: "0", receiver: { track: { id: "pulled" } } });
    this.dispatchEvent(new Event("track"));
  }
  async createAnswer() {
    return { type: "answer", sdp: "" };
  }
  async setLocalDescription() {}
  close() {}
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("pull retries when its bulk request fails", async () => {
  let pulls = 0;
  const json = (body: unknown) => new Response(JSON.stringify(body));
  vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
  vi.stubGlobal("RTCSessionDescription", class {});
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.includes("/sessions/new")) return json({ sessionId: "me" });
    if (url.includes("/generate-ice-servers")) return json({ iceServers: [] });
    if (url.includes("/renegotiate")) return json({});
    if (++pulls === 1) return new Response("boom", { status: 500 });
    return json({
      requiresImmediateRenegotiation: true,
      sessionDescription: { type: "offer", sdp: "" },
      tracks: [{ sessionId: "peer", trackName: "mic", mid: "0" }]
    });
  });

  const pulled = new PartyTracks().pull(
    of({ sessionId: "peer", trackName: "mic", location: "remote" as const })
  );

  expect(await firstValueFrom(pulled.pipe(timeout(3000)))).toEqual({
    id: "pulled"
  });
  expect(pulls).toBe(2);
});
