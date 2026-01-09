import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { Telegraf, Markup } from 'telegraf';
import { prisma } from '@/lib/prisma';

const bot = new Telegraf(process.env.TG_BOT_TOKEN!);

// --- 1. ГЛАВНОЕ МЕНЮ И СТАРТ ---

const mainMenu = Markup.keyboard([
  ['🔥 Новые', '🛠 В работе'],
  ['📊 Статистика', '📁 Архив']
]).resize();

bot.start(async (ctx) => {
  await ctx.reply(
    '👋 <b>CRM Система запущена!</b>\n\nИспользуйте меню снизу для управления.',
    { parse_mode: 'HTML', ...mainMenu }
  );
});

// --- 2. ОБРАБОТКА ТЕКСТОВЫХ КОМАНД (МЕНЮ) ---

bot.hears('🔥 Новые', async (ctx) => getLeadsByStatus(ctx, 'new'));
bot.hears('🛠 В работе', async (ctx) => getLeadsByStatus(ctx, 'in_work'));
bot.hears('📁 Архив', async (ctx) => getLeadsByStatus(ctx, 'done'));

bot.hears('📊 Статистика', async (ctx) => {
  try {
    const total = await prisma.lead.count();
    const stats = await prisma.lead.groupBy({
      by: ['status'],
      _count: { status: true }
    });

    const counts: Record<string, number> = {};
    stats.forEach(s => counts[s.status] = s._count.status);

    await ctx.reply(
      `📊 <b>Сводка по продажам:</b>\n\n` +
      `🔥 Новые: <b>${counts['new'] || 0}</b>\n` +
      `🛠 В работе: <b>${counts['in_work'] || 0}</b>\n` +
      `✅ Завершено: <b>${counts['done'] || 0}</b>\n` +
      `🗑 Спам/Мусор: <b>${counts['spam'] || 0}</b>\n\n` +
      `Всего в базе: <b>${total}</b>`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {
    ctx.reply('Ошибка получения статистики');
  }
});

// Поиск (оставляем командой, т.к. нужно вводить данные)
bot.command('find', async (ctx) => {
  const query = ctx.message.text.split(' ')[1];
  if (!query) return ctx.reply('⚠️ Введите телефон или ID: /find 7999...');
  
  const where = !isNaN(Number(query)) ? { id: Number(query) } : { phone: { contains: query } };
  const leads = await prisma.lead.findMany({ where, take: 5 });
  
  if (leads.length === 0) return ctx.reply('Ничего не найдено 🤷‍♂️');
  for (const lead of leads) await sendLeadCard(ctx, lead);
});

// --- 3. ЛОГИКА ЗАМЕТОК (ForceReply) ---

bot.on('message', async (ctx, next) => {
  // @ts-ignore
  const reply = ctx.message.reply_to_message;
  // @ts-ignore
  const text = ctx.message.text;

  // Если это ответ на сообщение бота с просьбой ввести заметку
  if (reply && reply.text && reply.text.startsWith('✍️ Напишите заметку') && text) {
    try {
      // Извлекаем ID заявки из текста сообщения бота (формат: "...для заявки #123")
      const idMatch = reply.text.match(/#(\d+)/);
      if (!idMatch) return;
      
      const id = parseInt(idMatch[1]);
      
      // Обновляем базу
      await prisma.lead.update({
        where: { id },
        data: { notes: text }
      });

      await ctx.reply(`✅ Заметка добавлена к заявке #${id}!`);
      
      // Показываем обновленную карточку
      const lead = await prisma.lead.findUnique({ where: { id } });
      if (lead) await sendLeadCard(ctx, lead);
      
    } catch (e) {
      ctx.reply('❌ Не удалось сохранить заметку');
    }
    return;
  }
  next();
});

// --- 4. ОБРАБОТКА КНОПОК (ACTIONS) ---

bot.on('callback_query', async (ctx) => {
  // Сразу гасим часики! Это критически важно.
  // Оборачиваем в try/catch на случай, если кнопка уже "протухла" пока летел запрос
  try {
    await ctx.answerCbQuery();
  } catch (e) {
    console.log('⚠️ answerCbQuery failed (old query), but continuing logic...');
  }

  // @ts-ignore
  const data = ctx.callbackQuery.data;
  if (!data) return;

  const parts = data.split('_');
  const action = parts[0]; // status, delete, note
  const id = parseInt(parts[1]);
  const value = parts.slice(2).join('_');

  try {
    // СМЕНА СТАТУСА
    if (action === 'status') {
      await prisma.lead.update({ where: { id }, data: { status: value } });
      
      // Обновляем карточку
      const lead = await prisma.lead.findUnique({ where: { id } });
      if (lead) await updateMessage(ctx, lead);
    } 
    
    // УДАЛЕНИЕ
    else if (action === 'delete') {
      await prisma.lead.delete({ where: { id } });
      
      // Тут можно показать уведомление "всплывашкой"
      // Но так как answerCbQuery уже вызван в начале, мы просто удаляем сообщение
      await ctx.deleteMessage(); 
    }

    // ДОБАВЛЕНИЕ ЗАМЕТКИ (Запрос)
    else if (action === 'note') {
      await ctx.reply(
        `✍️ Напишите заметку для заявки #${id} в ответ на это сообщение:`, 
        { 
          reply_markup: { force_reply: true } 
        }
      );
    }

  } catch (e) {
    console.error('Ошибка в логике кнопок:', e);
    // Если что-то упало, можно попробовать сообщить юзеру, 
    // но answerCbQuery уже был вызван, поэтому просто reply
    // await ctx.reply('❌ Ошибка при выполнении операции'); 
  }
});

// --- ХЕЛПЕРЫ ---

async function getLeadsByStatus(ctx: any, status: string) {
  const leads = await prisma.lead.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  if (leads.length === 0) return ctx.reply(`В категории "${status}" пусто.`);
  for (const lead of leads) await sendLeadCard(ctx, lead);
}

// Генерация кнопок
function getButtons(lead: any) {
  const id = lead.id;
  
  // Кнопки управления статусом
  const statusBtns = [];
  if (lead.status === 'new') {
    statusBtns.push({ text: '👷‍♂️ В работу', callback_data: `status_${id}_in_work` });
    statusBtns.push({ text: '🗑 Спам', callback_data: `status_${id}_spam` });
  } else if (lead.status === 'in_work') {
    statusBtns.push({ text: '✅ Готово', callback_data: `status_${id}_done` });
    statusBtns.push({ text: '🙅‍♂️ Отказ', callback_data: `status_${id}_spam` });
  } else {
    statusBtns.push({ text: '♻️ Вернуть', callback_data: `status_${id}_new` });
    statusBtns.push({ text: '❌ Удалить', callback_data: `delete_${id}` });
  }

  // Кнопка заметок (всегда есть)
  const noteBtn = [{ text: '📝 Добавить заметку', callback_data: `note_${id}` }];

  return [statusBtns, noteBtn];
}

// Отправка новой карточки
async function sendLeadCard(ctx: any, lead: any) {
  await ctx.reply(formatLeadText(lead), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: getButtons(lead) }
  });
}

// Обновление старой карточки (при нажатии кнопок)
async function updateMessage(ctx: any, lead: any) {
  try {
    await ctx.editMessageText(formatLeadText(lead), {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: getButtons(lead) }
    });
  } catch (e) {
    // Игнорируем ошибку, если текст не изменился
  }
}

function formatLeadText(lead: any) {
  const statusMap: Record<string, string> = {
    'new': '🔥 Новая', 'in_work': '🛠 В работе', 'done': '✅ Завершена', 'spam': '🗑 Спам'
  };
  
  let text = `🚗 <b>Заявка #${lead.id}</b>\n` +
             `👤 ${lead.name || 'Не указано'}\n` +
             `📱 <code>${lead.phone}</code>\n` +
             `🚘 ${lead.car || '-'}\n` +
             `------------------\n` +
             `Статус: <b>${statusMap[lead.status] || lead.status}</b>`;

  if (lead.notes) {
    text += `\n📝 <i>${lead.notes}</i>`;
  }
  
  return text;
}

// --- WEBHOOK ENDPOINTS ---
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
  return NextResponse.json({ status: "CRM Bot Active" });
}
