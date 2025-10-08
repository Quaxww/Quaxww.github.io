using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.IO;
using System.Net;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Telegram.Bot;
using Telegram.Bot.Exceptions;
using Telegram.Bot.Polling;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;

public class OrderData
{
    public string CustomerName { get; set; }
    public string CustomerPhone { get; set; }
    public string CustomerEmail { get; set; }
    public string CustomerCompany { get; set; }
    public string DeliveryAddress { get; set; }
    public string OrderComment { get; set; }
}

public class WebFormServer
{
    private HttpListener listener;
    private string url = "http://localhost:8080/";
    private bool isRunning = false;

    // Событие для уведомления о получении новых данных
    public event Action<OrderData> OnOrderReceived;

    public void Start()
    {
        listener = new HttpListener();
        listener.Prefixes.Add(url);
        
        try
        {
            listener.Start();
            isRunning = true;
            Console.WriteLine($"Сервер запущен на {url}");
            Console.WriteLine("Откройте браузер и перейдите по указанному адресу");
            
            // Запускаем обработку запросов в отдельном потоке
            Thread listenerThread = new Thread(ListenerLoop);
            listenerThread.IsBackground = true;
            listenerThread.Start();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Ошибка запуска сервера: {ex.Message}");
        }
    }

    public void Stop()
    {
        isRunning = false;
        listener?.Stop();
        listener?.Close();
        Console.WriteLine("Сервер остановлен");
    }

    private void ListenerLoop()
    {
        while (isRunning)
        {
            try
            {
                var context = listener.GetContext();
                ProcessRequest(context);
            }
            catch (HttpListenerException)
            {
                // Сервер был остановлен
                break;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка обработки запроса: {ex.Message}");
            }
        }
    }

    private void ProcessRequest(HttpListenerContext context)
    {
        var request = context.Request;
        var response = context.Response;

        try
        {
            if (request.HttpMethod == "POST" && request.Url.AbsolutePath == "/submit")
            {
                HandleFormSubmission(request, response);
            }
            else
            {
                ServeHtmlPage(response, "form.html");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Ошибка: {ex.Message}");
            SendError(response, "Internal Server Error");
        }
        finally
        {
            response.Close();
        }
    }

    private void HandleFormSubmission(HttpListenerRequest request, HttpListenerResponse response)
    {
        using var reader = new StreamReader(request.InputStream, request.ContentEncoding);
        var body = reader.ReadToEnd();
        
        var formData = ParseFormData(body);
        
        var order = new OrderData
        {
            CustomerName = formData.GetValueOrDefault("customerName", ""),
            CustomerPhone = formData.GetValueOrDefault("customerPhone", ""),
            CustomerEmail = formData.GetValueOrDefault("customerEmail", ""),
            CustomerCompany = formData.GetValueOrDefault("customerCompany", ""),
            DeliveryAddress = formData.GetValueOrDefault("deliveryAddress", ""),
            OrderComment = formData.GetValueOrDefault("orderComment", "")
        };

        // Сохраняем данные
        SaveOrderData(order);
        
        // Уведомляем подписчиков
        OnOrderReceived?.Invoke(order);
        
        // Отправляем успешный ответ
        ServeHtmlPage(response, "success.html");
        
        Console.WriteLine("\n=== ПОЛУЧЕН НОВЫЙ ЗАКАЗ ===");
        Console.WriteLine($"ФИО: {order.CustomerName}");
        Console.WriteLine($"Телефон: {order.CustomerPhone}");
        Console.WriteLine($"Email: {order.CustomerEmail}");
        Console.WriteLine($"Компания: {order.CustomerCompany}");
        Console.WriteLine($"Адрес: {order.DeliveryAddress}");
        Console.WriteLine($"Комментарий: {order.OrderComment}");
        Console.WriteLine("============================\n");
    }

    private Dictionary<string, string> ParseFormData(string formData)
    {
        var result = new Dictionary<string, string>();
        var pairs = formData.Split('&');
        
        foreach (var pair in pairs)
        {
            var keyValue = pair.Split('=');
            if (keyValue.Length == 2)
            {
                var key = Uri.UnescapeDataString(keyValue[0]);
                var value = Uri.UnescapeDataString(keyValue[1].Replace('+', ' '));
                result[key] = value;
            }
        }
        
        return result;
    }

    private void SaveOrderData(OrderData order)
    {
        // Сохраняем в JSON файл
        var json = JsonSerializer.Serialize(order, new JsonSerializerOptions 
        { 
            WriteIndented = true,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        });
        
        string fileName = $"order_{DateTime.Now:yyyyMMdd_HHmmss}.json";
        System.IO.File.WriteAllText(fileName, json, Encoding.UTF8);
        Console.WriteLine($"Данные сохранены в файл: {fileName}");
    }

    private void ServeHtmlPage(HttpListenerResponse response, string htmlFileName)
    {
        try
        {
            if (System.IO.File.Exists(htmlFileName))
            {
                var html = System.IO.File.ReadAllText(htmlFileName, Encoding.UTF8);
                var buffer = Encoding.UTF8.GetBytes(html);
                
                response.ContentType = "text/html; charset=utf-8";
                response.ContentLength64 = buffer.Length;
                response.OutputStream.Write(buffer, 0, buffer.Length);
            }
            else
            {
                SendError(response, $"HTML файл {htmlFileName} не найден");
            }
        }
        catch (Exception ex)
        {
            SendError(response, $"Ошибка чтения HTML файла: {ex.Message}");
        }
    }

    private void SendError(HttpListenerResponse response, string message)
    {
        var errorHtml = $@"
        <!DOCTYPE html>
        <html>
        <head><title>Ошибка</title></head>
        <body>
            <h1>Ошибка</h1>
            <p>{message}</p>
            <button onclick='window.history.back()'>Назад</button>
        </body>
        </html>";
        
        var buffer = Encoding.UTF8.GetBytes(errorHtml);
        response.StatusCode = 500;
        response.ContentType = "text/html; charset=utf-8";
        response.ContentLength64 = buffer.Length;
        response.OutputStream.Write(buffer, 0, buffer.Length);
    }
}

class Program
{
    private static ITelegramBotClient _botClient;
    private static ReceiverOptions _receiverOptions;
    private static WebFormServer _webServer;

    static async Task Main()
    {
        Console.OutputEncoding = Encoding.UTF8;
        
        // Запуск веб-сервера формы
        StartWebServer();
        
        // Запуск Telegram бота
        await StartTelegramBot();
    }

    private static void StartWebServer()
    {
        // Проверяем существование HTML файлов
        if (!System.IO.File.Exists("form.html"))
        {
            Console.WriteLine("Ошибка: файл form.html не найден!");
            Console.WriteLine("Убедитесь, что form.html находится в той же папке, что и исполняемый файл.");
            return;
        }

        if (!System.IO.File.Exists("success.html"))
        {
            Console.WriteLine("Внимание: файл success.html не найден, будет использоваться стандартная страница успеха.");
        }
        
        _webServer = new WebFormServer();
        
        // Подписываемся на событие получения заказа
        _webServer.OnOrderReceived += order =>
        {
            Console.WriteLine("Заказ передан на обработку...");
            ProcessOrder(order);
        };
        
        _webServer.Start();
        
        Console.WriteLine("\nКоманды для управления сервером:");
        Console.WriteLine("Нажмите 'q' и Enter для выхода");
        Console.WriteLine("Нажмите 'r' и Enter для перезапуска сервера");
        Console.WriteLine("Нажмите Enter для проверки статуса\n");
    }

    private static async Task StartTelegramBot()
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

        // Обработка команд консоли
        var consoleTask = Task.Run(() => HandleConsoleInput(cts));

        // Ожидаем завершения
        await consoleTask;
    }

    private static void HandleConsoleInput(CancellationTokenSource cts)
    {
        while (!cts.Token.IsCancellationRequested)
        {
            var input = Console.ReadLine();
            if (input?.ToLower() == "q")
            {
                _webServer?.Stop();
                cts.Cancel();
                break;
            }
            else if (input?.ToLower() == "r")
            {
                _webServer?.Stop();
                Thread.Sleep(1000);
                StartWebServer();
            }
            else
            {
                Console.WriteLine("Сервер работает...");
            }
        }
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
                    var inlineKeyboard = new InlineKeyboardMarkup(new[] { new[] { webAppButton } });
                    await botClient.SendTextMessageAsync(
                        chatId: chatId,
                        text: "Нажмите, чтобы перейти в приложение:",
                        replyMarkup: inlineKeyboard);
                    break;

                case "/help":
                    await botClient.SendTextMessageAsync(
                        chatId: chatId,
                        text: "Доступные команды:\n/start - начать работу\n/run - запустить приложение\n/help - помощь",
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

    static void ProcessOrder(OrderData order)
    {
        // Ваша бизнес-логика обработки заказа
        Console.WriteLine("=== НАЧАЛО ОБРАБОТКИ ЗАКАЗА ===");
        
        // Пример обработки
        if (!string.IsNullOrEmpty(order.CustomerCompany))
        {
            Console.WriteLine($"Корпоративный клиент: {order.CustomerCompany}");
        }
        
        // Здесь можно добавить сохранение в базу данных,
        // отправку email, генерацию документов и т.д.
        
        Thread.Sleep(1000); // Имитация обработки
        Console.WriteLine("=== ОБРАБОТКА ЗАКАЗА ЗАВЕРШЕНА ===\n");
    }
}
