import { NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";
// Исправленный импорт
import { prisma } from "@/lib/prisma";

type Body = {
  car: string;
  name: string;
  phone: string;
};

// --- Вспомогательные функции шифрования (оставляем как было) ---
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

// --- Основная функция ---
export async function POST(request: Request) {
  try {
    const body: Body = await request.json();

    // 1. ЛОГИРУЕМ И СОХРАНЯЕМ В БАЗУ (ТЕПЕРЬ ВНУТРИ ФУНКЦИИ)
    console.log("Saving lead:", body);

    const lead = await prisma.lead.create({
      data: {
        car: body.car,
        name: body.name,
        phone: body.phone,
        status: "new"
      }
    });

    console.log("Lead saved with ID:", lead.id);

    // 2. ПОЛУЧАЕМ ТОКЕН (Твоя логика)
    let token = process.env.TG_BOT_TOKEN;
    const chatId = process.env.TG_CHAT_ID;

    if (!token) {
      const encryptedEnv = process.env.ENCRYPTED_TG_TOKEN;
      const pass = process.env.ENCRYPT_PW;
      let encrypted = encryptedEnv;
      if (!encrypted) {
        try {
          const candidate = path.join(process.cwd(), "my-app", "encrypted.token");
          if (fs.existsSync(candidate)) encrypted = fs.readFileSync(candidate, "utf8").trim();
        } catch (e) { /* ignore */ }
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

    // 3. ОТПРАВЛЯЕМ В ТЕЛЕГРАМ (С КНОПКАМИ!)
    const text = `🔥 <b>Новая заявка #${lead.id}</b>\n\n🚗 <b>Авто:</b> ${body.car}\n👤 <b>Имя:</b> ${body.name}\n📱 <b>Телефон:</b> ${body.phone}`;
    
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    // Добавляем кнопки, чтобы работали команды в боте
    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '✅ В работу', callback_data: `status_${lead.id}_in_work` },
          { text: '🗑 Спам', callback_data: `status_${lead.id}_spam` }
        ]
      ]
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup 
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ ok: false, error: txt }, { status: 502 });
    }

    return NextResponse.json({ ok: true, id: lead.id });

  } catch (err: any) {
    console.error("Handler error:", err);
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
