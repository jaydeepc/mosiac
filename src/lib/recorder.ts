"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice capture built for long sessions (an hour or two is fine):
 *  - raw PCM from the microphone, downsampled to 16 kHz mono, cut into WAV chunks every N seconds
 *    (or sooner on a natural pause) and handed to `onChunk` for server transcription;
 *  - the browser's own speech recogniser, when present, for instant interim captions.
 */

export interface RecorderOptions {
  chunkSeconds?: number; // target chunk length
  minChunkSeconds?: number; // don't cut before this
  silenceMs?: number; // a pause this long closes a chunk early
  language?: string; // BCP-47 hint for the browser recogniser
  onChunk: (wavBase64: string, seconds: number, index: number) => void;
}

export interface RecorderState {
  recording: boolean;
  seconds: number;
  level: number; // 0..1 smoothed
  interim: string; // live caption from the browser recogniser (may be empty)
  error: string | null;
  supported: boolean;
}

const TARGET_RATE = 16000;

function downsample(input: Float32Array, inRate: number, outRate: number): Float32Array {
  if (inRate === outRate) return input;
  const ratio = inRate / outRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  let o = 0;
  let i = 0;
  while (o < outLen) {
    const next = Math.round((o + 1) * ratio);
    let sum = 0;
    let n = 0;
    for (; i < next && i < input.length; i++) {
      sum += input[i];
      n++;
    }
    out[o++] = n ? sum / n : 0;
  }
  return out;
}

export function encodeWav(samples: Float32Array, rate = TARGET_RATE): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(bin);
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
};

export function useRecorder(opts: RecorderOptions) {
  const [state, setState] = useState<RecorderState>({ recording: false, seconds: 0, level: 0, interim: "", error: null, supported: true });
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const bufRef = useRef<Float32Array[]>([]);
  const bufLenRef = useRef(0);
  const chunkStartRef = useRef(0);
  const lastVoiceRef = useRef(0);
  const indexRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const optsRef = useRef(opts);
  const levelRef = useRef(0);

  useEffect(() => {
    optsRef.current = opts;
  });
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const id = window.setTimeout(() => setState((s) => ({ ...s, supported: false })), 0);
      return () => window.clearTimeout(id);
    }
  }, []);

  const flush = useCallback((force = false) => {
    const o = optsRef.current;
    const secs = bufLenRef.current / TARGET_RATE;
    const min = o.minChunkSeconds ?? 4;
    if (bufLenRef.current === 0) return;
    if (!force && secs < min) return;
    const all = new Float32Array(bufLenRef.current);
    let off = 0;
    for (const b of bufRef.current) {
      all.set(b, off);
      off += b.length;
    }
    bufRef.current = [];
    bufLenRef.current = 0;
    chunkStartRef.current = performance.now();
    // skip near-silent chunks
    let energy = 0;
    for (let i = 0; i < all.length; i += 16) energy += all[i] * all[i];
    const rms = Math.sqrt(energy / (all.length / 16));
    if (rms < 0.004 && !force) return;
    if (rms < 0.002) return;
    o.onChunk(toBase64(encodeWav(all)), secs, indexRef.current++);
  }, []);

  const stop = useCallback(() => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    procRef.current?.disconnect();
    procRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    flush(true);
    setState((s) => ({ ...s, recording: false, level: 0, interim: "" }));
  }, [flush]);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, error: null }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      procRef.current = proc;
      bufRef.current = [];
      bufLenRef.current = 0;
      indexRef.current = 0;
      startedAtRef.current = performance.now();
      chunkStartRef.current = performance.now();
      lastVoiceRef.current = performance.now();
      proc.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < input.length; i += 8) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / (input.length / 8));
        levelRef.current = levelRef.current * 0.7 + Math.min(1, rms * 6) * 0.3;
        if (rms > 0.015) lastVoiceRef.current = performance.now();
        const ds = downsample(input, ctx.sampleRate, TARGET_RATE);
        bufRef.current.push(new Float32Array(ds));
        bufLenRef.current += ds.length;
        const o = optsRef.current;
        const elapsed = (performance.now() - chunkStartRef.current) / 1000;
        const silentFor = performance.now() - lastVoiceRef.current;
        if (elapsed >= (o.chunkSeconds ?? 12) || (elapsed >= (o.minChunkSeconds ?? 4) && silentFor > (o.silenceMs ?? 1200))) flush(false);
      };
      source.connect(proc);
      proc.connect(ctx.destination); // required by some browsers for onaudioprocess to fire; output is silent (gain 0)
      const gain = ctx.createGain();
      gain.gain.value = 0;
      proc.disconnect();
      proc.connect(gain);
      gain.connect(ctx.destination);

      // Interim captions via the browser recogniser (best effort)
      const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
      if (SR) {
        try {
          const rec = new SR();
          rec.lang = optsRef.current.language || navigator.language || "en-US";
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (ev) => {
            let text = "";
            for (let i = ev.resultIndex; i < ev.results.length; i++) text += ev.results[i][0].transcript;
            setState((s) => ({ ...s, interim: text.slice(-220) }));
          };
          rec.onerror = () => {
            /* captions are optional */
          };
          rec.onend = () => {
            if (recRef.current === rec && streamRef.current) {
              try {
                rec.start();
              } catch {
                /* ignore */
              }
            }
          };
          rec.start();
          recRef.current = rec;
        } catch {
          /* ignore */
        }
      }

      tickRef.current = window.setInterval(() => {
        setState((s) => ({ ...s, seconds: Math.floor((performance.now() - startedAtRef.current) / 1000), level: levelRef.current }));
      }, 200);
      setState((s) => ({ ...s, recording: true, seconds: 0 }));
    } catch (e) {
      const msg = (e as Error).name === "NotAllowedError" ? "Microphone access was blocked. Allow it in your browser, or type instead." : (e as Error).message;
      setState((s) => ({ ...s, error: msg, recording: false }));
    }
  }, [flush]);

  useEffect(() => () => stop(), [stop]);

  return { ...state, start, stop };
}
