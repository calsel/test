import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { Telegraf } from 'telegraf';
import { prisma } from '@/lib/prisma';

const bot = new Telegraf(process.env.TG_BOT_TOKEN!);

// --- 1. МЕНЮ И СТАРТ ---

bot.start(async (ctx) => {
  await ctx.reply(
    '👋 <b>CRM Бот на связи!</b>\n\n' +
    '📌 <b>Команды:</b>\n' +
    '/new — Список новых (до 5 шт)\n' +
    '/stats — Статистика за сегодня\n' +
    '/find <code>&lt;id или телефон&gt;</code> — Поиск заявки',
    { parse_mode: 'HTML' }
  );
});

// --- 2. НОВЫЕ ЗАЯВКИ (/new) ---

bot.command('new', async (ctx) => {
  try {
    const leads = await prisma.lead.findMany({
      where: { status: 'new' },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    if (leads.length === 0) return ctx.reply('🎉 Новых заявок нет! Отдыхаем.');

    for (const lead of leads) {
      await sendLeadCard(ctx, lead);
    }
  } catch (e: any) {
    console.error(e);
    ctx.reply('❌ Ошибка базы данных');
  }
});

// --- 3. ПОИСК (/find) ---

bot.command('find', async (ctx) => {
  const query = ctx.message.text.split(' ')[1];
  if (!query) return ctx.reply('⚠️ Введите ID или телефон после команды.\nПример: /find 42');

  try {
    // Пробуем найти по ID (если число) или по телефону
    const whereCondition = !isNaN(Number(query)) 
      ? { id: Number(query) } 
      : { phone: { contains: query } };

    const leads = await prisma.lead.findMany({
      where: whereCondition,
      take: 5
    });

    if (leads.length === 0) return ctx.reply('🔍 Ничего не найдено.');

    for (const lead of leads) {
      await sendLeadCard(ctx, lead);
    }
  } catch (e) {
    ctx.reply('❌ Ошибка поиска');
  }
});

// --- 4. СТАТИСТИКА (/stats) ---

bot.command('stats', async (ctx) => {
  try {
    const total = await prisma.lead.count();
    const newLeads = await prisma.lead.count({ where: { status: 'new' } });
    const inWork = await prisma.lead.count({ where: { status: 'in_work' } });
    const done = await prisma.lead.count({ where: { status: 'done' } });

    await ctx.reply(
      `📊 <b>Статистика:</b>\n\n` +
      `🔥 Новые: <b>${newLeads}</b>\n` +
      `🛠 В работе: <b>${inWork}</b>\n` +
      `✅ Выполнено: <b>${done}</b>\n` +
      `📦 Всего: <b>${total}</b>`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {
    ctx.reply('❌ Ошибка статистики');
  }
});

// --- 5. ОБРАБОТКА КНОПОК ---

bot.on('callback_query', async (ctx) => {
  // @ts-ignore
  const data = ctx.callbackQuery.data;
  if (!data || !data.startsWith('status_')) return;

  const parts = data.split('_');
  const id = parseInt(parts[1]);
  const newStatus = parts.slice(2).join('_');

  try {
    await prisma.lead.update({ where: { id }, data: { status: newStatus } });
    
    // Карта статусов для текста
    const statusNames: Record<string, string> = {
      'new': 'Новая 🔥',
      'in_work': 'В работе 🛠',
      'done': 'Завершено ✅',
      'spam': 'Спам 🗑'
    };

    const statusText = statusNames[newStatus] || newStatus;
    await ctx.answerCbQuery(`Статус: ${statusText}`);

    // Получаем старый текст сообщения
    // @ts-ignore
    const oldText = ctx.callbackQuery.message?.text || `Заявка #${id}`;

    // Генерируем новые кнопки в зависимости от статуса
    let newButtons = [];
    
    if (newStatus === 'new') {
       newButtons = [[{ text: 'В работу 🛠', callback_data: `status_${id}_in_work` }, { text: 'Спам 🗑', callback_data: `status_${id}_spam` }]];
    } else if (newStatus === 'in_work') {
       newButtons = [[{ text: '✅ Завершить', callback_data: `status_${id}_done` }, { text: '🔙 Отложить', callback_data: `status_${id}_new` }]];
    } else {
       // Если статус "done" или "spam" — убираем кнопки (или даем кнопку "Вернуть")
       newButtons = [[{ text: '♻️ Вернуть в работу', callback_data: `status_${id}_in_work` }]];
    }

    // Обновляем сообщение: меняем текст и клавиатуру
    await ctx.editMessageText(
      oldText.split('\n\nСтатус:')[0] + `\n\nСтатус: <b>${statusText}</b>`,
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: newButtons }
      }
    );

  } catch (e) {
    console.error(e);
    await ctx.answerCbQuery('Ошибка обновления');
  }
});

// --- ХЕЛПЕР: ОТПРАВКА КАРТОЧКИ ---
async function sendLeadCard(ctx: any, lead: any) {
  const statusNames: Record<string, string> = {
    'new': 'Новая 🔥',
    'in_work': 'В работе 🛠',
    'done': 'Завершено ✅',
    'spam': 'Спам 🗑'
  };

  const text = 
    `🚗 <b>Заявка #${lead.id}</b>\n` +
    `👤 ${lead.name || '-'}\n` +
    `📱 ${lead.phone}\n` +
    `🚘 ${lead.car || '-'}\n` +
    `📅 ${new Date(lead.createdAt).toLocaleDateString('ru-RU')}\n\n` +
    `Статус: <b>${statusNames[lead.status] || lead.status}</b>`;

  // Кнопки зависят от текущего статуса
  let buttons = [];
  if (lead.status === 'new') {
    buttons = [[{ text: '🛠 В работу', callback_data: `status_${lead.id}_in_work` }, { text: '🗑 Спам', callback_data: `status_${lead.id}_spam` }]];
  } else if (lead.status === 'in_work') {
    buttons = [[{ text: '✅ Завершить', callback_data: `status_${lead.id}_done` }]];
  } else {
    buttons = [[{ text: '♻️ Вернуть', callback_data: `status_${lead.id}_new` }]];
  }

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons }
  });
}

// --- WEBHOOK ---
export async function POST(req: Request) {
  try {
    const body = await req.json();
    await bot.handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Bot is alive v2" });
}
