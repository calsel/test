import { NextResponse } from 'next/server';
// Этот роут должен выполняться в Node.js runtime (не edge), т.к. используется Telegraf и Prisma
export const runtime = 'nodejs';
import { Telegraf, Markup } from 'telegraf';
import { prisma } from '@/lib/prisma'; // Убедись, что создал lib/prisma.ts, как мы обсуждали ранее

// Инициализация бота
const bot = new Telegraf(process.env.TG_BOT_TOKEN!);

// --- 1. Команды бота ---

// /start
bot.start(async (ctx) => {
  await ctx.reply('👋 Бот на связи!\n\nКоманды:\n/new — показать новые заявки');
});

// /new — Показать список новых заявок
bot.command('new', async (ctx) => {
  try {
    const leads = await prisma.lead.findMany({
      where: { status: 'new' },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    if (leads.length === 0) {
      return ctx.reply('📭 Новых заявок пока нет');
    }

    for (const lead of leads) {
      const text = `
🚗 <b>Заявка #${lead.id}</b>
👤 ${lead.name || 'Без имени'}
📱 ${lead.phone}
🚘 ${lead.car || '-'}
`;
      await ctx.reply(text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ В работу', `status_${lead.id}_in_work`)]
        ])
      });
    }
  } catch (e) {
    console.error('Error fetching leads:', e);
    ctx.reply('❌ Ошибка при получении данных');
  }
});

// --- 2. Обработка кнопок (Смена статуса) ---

bot.on('callback_query', async (ctx) => {
  // @ts-ignore: Telegraf types workaround
  const data = ctx.callbackQuery.data; 
  if (!data || !data.startsWith('status_')) return;

  // Парсим данные: "status_123_in_work"
  const parts = data.split('_');
  const id = parseInt(parts[1]);
  const newStatus = parts.slice(2).join('_'); // in_work, spam, done

  try {
    // 1. Обновляем статус в БД
    await prisma.lead.update({
      where: { id },
      data: { status: newStatus }
    });

    const statusMap: Record<string, string> = { 
      'in_work': 'В работе 🛠', 
      'spam': 'Спам 🗑', 
      'done': 'Готово ✅' 
    };
    const statusText = statusMap[newStatus] || newStatus;

    // 2. Отвечаем Телеграму (скрываем часики загрузки)
    await ctx.answerCbQuery(`Статус обновлен: ${statusText}`);

    // 3. Безопасно получаем текст старого сообщения (Fix TS Error)
    const message = ctx.callbackQuery.message;
    let oldText = 'Заявка';

    // Проверяем, что сообщение доступно и содержит текст
    if (message && 'text' in message) {
      oldText = message.text;
    }

    // 4. Редактируем сообщение: убираем кнопки и добавляем статус
    await ctx.editMessageText(
      `${oldText}\n\n✅ <b>Статус: ${statusText}</b>`,
      { 
        parse_mode: 'HTML', 
        reply_markup: { inline_keyboard: [] } // Пустой массив удаляет кнопки
      }
    );

  } catch (e) {
    console.error('Error updating lead:', e);
    await ctx.answerCbQuery('Ошибка обновления базы данных');
  }
});

// --- 3. Webhook Handler для Next.js ---

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await bot.handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Bot webhook error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
