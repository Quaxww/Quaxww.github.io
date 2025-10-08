using System.ComponentModel.DataAnnotations;
using System.Text.Encodings.Web;
using Telegram.Bot;
using Telegram.Bot.Exceptions;
using Telegram.Bot.Polling;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;

class Program1
{
    private static ITelegramBotClient? _botClient;
    private static ReceiverOptions? _receiverOptions;

    static async Task Main()
    {
        // Убедитесь, что токен правильный и бот создан через @BotFather
        _botClient = new TelegramBotClient("8397722379:AAHXWFHDnBH3z6xVTZGW4sp8Sly8MqdcfTw");


        _receiverOptions = new ReceiverOptions
        {
            AllowedUpdates = Array.Empty<UpdateType>(), // Получаем все типы обновлений
            ThrowPendingUpdates = true,
        };

        using var cts = new CancellationTokenSource();

        // Запускаем бота
        _botClient.StartReceiving(
            updateHandler: HandleUpdateAsync,
            pollingErrorHandler: HandlePollingErrorAsync,
            receiverOptions: _receiverOptions,
            cancellationToken: cts.Token
        );

        var me = await _botClient.GetMeAsync();
        Console.WriteLine($"Бот {me.FirstName} успешно запущен!");
        Console.WriteLine("Нажмите Ctrl+C для остановки...");

        // Ожидаем бесконечно
        await Task.Delay(-1, cts.Token);
    }

    private static async Task HandleUpdateAsync(ITelegramBotClient botClient, Update update, CancellationToken cancellationToken)
    {
        try
        {
            switch (update.Type)
            {
                case UpdateType.Message:
                    await HandleMessageAsync(botClient, update.Message, cancellationToken);
                    break;

                // Можно добавить обработку других типов обновлений
                case UpdateType.CallbackQuery:
                    Console.WriteLine("Пришел callback query");
                    break;

                default:
                    Console.WriteLine($"Получен неизвестный тип обновления: {update.Type}");
                    break;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Ошибка в обработчике обновлений: {ex}");
        }
    }

    private static async Task HandleMessageAsync(ITelegramBotClient botClient, Message message, CancellationToken cancellationToken)
    {
        if (message?.Text == null)
            return;

        var chatId = message.Chat.Id;
        var userName = message.From?.FirstName ?? "Неизвестный пользователь";
        var messageText = message.Text;

        Console.WriteLine($"Сообщение от {userName} (ID: {chatId}): {messageText}");

        // Простой эхо-бот
        if (messageText.StartsWith('/'))
        {
            // Обработка команд
            switch (messageText.ToLower())
            {
                case "/start":
                    await botClient.SendTextMessageAsync(
                        chatId: chatId,
                        text: $"Привет, {userName}! Для перехода в сервис ТМК нажмите /run",
                        cancellationToken: cancellationToken);
                    break;
                case "/run":
                    var webAppInfo = new WebAppInfo { Url = "https://quaxww.github.io/" };
                    var webAppButton = InlineKeyboardButton.WithWebApp("Запустить приложение", webAppInfo);
                    var inlineKeyboard = new InlineKeyboardMarkup(new[] {new[] {webAppButton}});
                    await botClient.SendTextMessageAsync(
                        chatId: chatId,
                        text: "Нажмите, чтобы перейти в приложение:",
                        replyMarkup: inlineKeyboard);
                    break;

                case "/help":
                    await botClient.SendTextMessageAsync(
                        chatId: chatId,
                        text: "Доступные команды:\n/start - начать работу\n/help - помощь",
                        cancellationToken: cancellationToken);
                    break;
                default:
                    await botClient.SendTextMessageAsync(
                        chatId: chatId,
                        text: "Неизвестная команда. Используйте /help для списка команд.",
                        cancellationToken: cancellationToken);
                    break;
            }
        }
        else
        {
            // Ответ на обычное сообщение
            await botClient.SendTextMessageAsync(
                chatId: chatId,
                text: "Пожалуйста, воспользуйтесь командами /start или /help.",
                cancellationToken: cancellationToken);
        }
    }

    private static Task HandlePollingErrorAsync(ITelegramBotClient botClient, Exception exception, CancellationToken cancellationToken)
    {
        var errorMessage = exception switch
        {
            ApiRequestException apiRequestException
                => $"Telegram API Error:\n[{apiRequestException.ErrorCode}]\n{apiRequestException.Message}",
            _ => exception.ToString()
        };

        Console.WriteLine($"Ошибка: {errorMessage}");
        return Task.CompletedTask;
    }
}