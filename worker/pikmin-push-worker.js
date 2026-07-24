var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var enc = new TextEncoder();
function fromB64u(s) {
  const pad = "=".repeat((4 - s.length % 4) % 4);
  return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad), (c) => c.charCodeAt(0));
}
__name(fromB64u, "fromB64u");
function toB64u(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(toB64u, "toB64u");
function concat(...arrs) {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let i = 0;
  for (const a of arrs) {
    out.set(a, i);
    i += a.length;
  }
  return out;
}
__name(concat, "concat");
async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    len * 8
  ));
}
__name(hkdf, "hkdf");
async function buildVapidAuth(endpoint, publicKeyB64u, privateKeyB64u) {
  const aud = new URL(endpoint).origin;
  const header = toB64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = toB64u(enc.encode(JSON.stringify({
    aud,
    sub: "mailto:sss840127@gmail.com",
    exp: Math.floor(Date.now() / 1e3) + 43200
  })));
  const unsigned = `${header}.${payload}`;
  const pub = fromB64u(publicKeyB64u);
  const sigKey = await crypto.subtle.importKey("jwk", {
    kty: "EC",
    crv: "P-256",
    ext: true,
    x: toB64u(pub.slice(1, 33)),
    y: toB64u(pub.slice(33, 65)),
    d: privateKeyB64u
  }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    sigKey,
    enc.encode(unsigned)
  );
  return `vapid t=${unsigned}.${toB64u(sig)}, k=${publicKeyB64u}`;
}
__name(buildVapidAuth, "buildVapidAuth");
async function encryptPayload(subscription, payloadStr) {
  const { endpoint, keys: { p256dh, auth } } = subscription;
  const authSecret = fromB64u(auth);
  const receiverPub = fromB64u(p256dh);
  const epk = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const senderPub = new Uint8Array(await crypto.subtle.exportKey("raw", epk.publicKey));
  const receiverKey = await crypto.subtle.importKey("raw", receiverPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: receiverKey }, epk.privateKey, 256));
  const ikm = await hkdf(authSecret, ecdhSecret, concat(enc.encode("WebPush: info\0"), receiverPub, senderPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const cekKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    cekKey,
    concat(enc.encode(payloadStr), new Uint8Array([2]))
  ));
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const body = concat(salt, rs, new Uint8Array([senderPub.length]), senderPub, ciphertext);
  return { body, endpoint };
}
__name(encryptPayload, "encryptPayload");
async function sendPush(subscription, payload, env) {
  const { body, endpoint } = await encryptPayload(subscription, JSON.stringify(payload));
  const auth = await buildVapidAuth(endpoint, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": auth,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400"
    },
    body
  });
  if (!res.ok && res.status !== 201) {
    throw new Error(`Push failed ${res.status}: ${await res.text()}`);
  }
}
__name(sendPush, "sendPush");
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
function resp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" }
  });
}
__name(resp, "resp");
var index_default = {
  // API 端點：接收前端傳來的訂閱與排程
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    if (url.pathname === "/api/time") {
      return resp({ now: Date.now() });
    }
    if (request.method === "POST" && url.pathname === "/api/subscribe") {
      const { clientId, subscription } = await request.json();
      if (!clientId || !subscription) return resp({ error: "missing fields" }, 400);
      await env.MUSHROOM_KV.put(`sub:${clientId}`, JSON.stringify(subscription), { expirationTtl: 86400 * 30 });
      return resp({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/api/schedule") {
      const { clientId, rowId, name, respawnTimestamp, leadTimestamp } = await request.json();
      if (!clientId || !rowId) return resp({ error: "missing fields" }, 400);
      await env.MUSHROOM_KV.put(
        `sched:${clientId}:${rowId}`,
        JSON.stringify({ clientId, rowId, name, respawnTimestamp, leadTimestamp, leadSent: false, respawnSent: false }),
        { expirationTtl: 86400 }
      );
      return resp({ ok: true });
    }
    if (request.method === "DELETE" && url.pathname.startsWith("/api/schedule/")) {
      const [clientId, rowId] = url.pathname.slice("/api/schedule/".length).split("/");
      if (clientId && rowId) await env.MUSHROOM_KV.delete(`sched:${clientId}:${rowId}`);
      return resp({ ok: true });
    }
    return resp({ error: "not found" }, 404);
  },
  // Cron：每分鐘檢查是否有到期的排程，有就推播
  async scheduled(event, env) {
    const now = Date.now();
    const list = await env.MUSHROOM_KV.list({ prefix: "sched:" });
    for (const { name: key } of list.keys) {
      const sched = await env.MUSHROOM_KV.get(key, { type: "json" });
      if (!sched) continue;
      const sub = await env.MUSHROOM_KV.get(`sub:${sched.clientId}`, { type: "json" });
      if (!sub) continue;
      let changed = false;
      if (!sched.leadSent && sched.leadTimestamp && sched.leadTimestamp <= now) {
        const secsLeft = Math.max(0, Math.round((sched.respawnTimestamp - now) / 1e3));
        const timeStr = new Intl.DateTimeFormat("zh-TW", {
          timeZone: "Asia/Taipei",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        }).format(new Date(sched.respawnTimestamp));
        try {
          await sendPush(sub, {
            title: `\u9084\u6709 ${secsLeft} \u79D2\uFF1A${sched.name}`,
            body: `\u9810\u8A08 ${timeStr} \u91CD\u751F\u3002`,
            tag: `pikmin-lead-${sched.rowId}`
          }, env);
        } catch (e) {
          console.error("lead push error:", e.message);
        }
        sched.leadSent = true;
        changed = true;
      }
      if (!sched.respawnSent && sched.respawnTimestamp && sched.respawnTimestamp <= now) {
        try {
          await sendPush(sub, {
            title: `${sched.name} \u5DF2\u91CD\u751F`,
            body: "\u53EF\u4EE5\u6E96\u5099\u91CD\u65B0\u6311\u6230\u9019\u6735\u8611\u83C7\u4E86\u3002",
            tag: `pikmin-respawn-${sched.rowId}`
          }, env);
        } catch (e) {
          console.error("respawn push error:", e.message);
        }
        sched.respawnSent = true;
        changed = true;
      }
      if (changed) {
        if (sched.leadSent && sched.respawnSent) {
          await env.MUSHROOM_KV.delete(key);
        } else {
          await env.MUSHROOM_KV.put(key, JSON.stringify(sched), { expirationTtl: 86400 });
        }
      }
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
