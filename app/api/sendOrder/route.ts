import { NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";

type Body = {
  car: string;
  name: string;
  phone: string;
};

function deriveKey(pass: string) {
  return crypto.createHash("sha256").update(pass).digest();
}

function decryptToken(encrypted: string, pass: string) {
  const sep = encrypted.indexOf(":");
  if (sep < 0) throw new Error("invalid encrypted format");
  const iv = Buffer.from(encrypted.slice(0, sep), "base64");
  const rest = encrypted.slice(sep + 1);
  const sep2 = rest.indexOf(":");
  if (sep2 < 0) throw new Error("invalid encrypted format");
  const tag = Buffer.from(rest.slice(0, sep2), "base64");
  const ct = Buffer.from(rest.slice(sep2 + 1), "base64");
  const key = deriveKey(pass);
  const dec = crypto.createDecipheriv("aes-256-gcm", key, iv);
  dec.setAuthTag(tag);
  const out = Buffer.concat([dec.update(ct), dec.final()]);
  return out.toString("utf8");
}

export async function POST(request: Request) {
  try {
    const body: Body = await request.json();

    let token = process.env.TG_BOT_TOKEN;
    const chatId = process.env.TG_CHAT_ID;

    // If no plain token, try encrypted sources
    if (!token) {
      const encryptedEnv = process.env.ENCRYPTED_TG_TOKEN;
      const pass = process.env.ENCRYPT_PW;
      let encrypted = encryptedEnv;
      if (!encrypted) {
        // try reading file encrypted.token in app folder
        try {
          const candidate = path.join(process.cwd(), "my-app", "encrypted.token");
          if (fs.existsSync(candidate)) encrypted = fs.readFileSync(candidate, "utf8").trim();
        } catch (e) {
          // ignore
        }
      }
      if (encrypted && pass) {
        try {
          token = decryptToken(encrypted, pass);
        } catch (e) {
          return NextResponse.json({ ok: false, error: "Failed to decrypt token" }, { status: 500 });
        }
      }
    }

    if (!token || !chatId) {
      return NextResponse.json({ ok: false, error: "Missing bot token or chat id" }, { status: 500 });
    }

    const text = `Новая заявка\n\nМашина: ${body.car}\nИмя: ${body.name}\nТелефон: ${body.phone}`;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ ok: false, error: txt }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
