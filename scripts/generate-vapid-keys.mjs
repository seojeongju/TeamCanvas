#!/usr/bin/env node
/**
 * VAPID 키 쌍 생성 (Web Push — applicationServerKey 호환)
 * 사용: node scripts/generate-vapid-keys.mjs
 */
import { generateKeyPairSync } from "node:crypto";

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });

const jwk = publicKey.export({ format: "jwk" });
const x = Buffer.from(jwk.x, "base64url");
const y = Buffer.from(jwk.y, "base64url");
const rawPublic = Buffer.concat([Buffer.from([0x04]), x, y]);

const publicKeyB64 = b64url(rawPublic);
const privateKeyB64 = b64url(privateKey.export({ type: "pkcs8", format: "der" }));

console.log(JSON.stringify({ publicKey: publicKeyB64, privateKey: privateKeyB64 }, null, 2));
