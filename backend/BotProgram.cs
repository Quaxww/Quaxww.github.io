using Telegram.Bot;
using Telegram.Bot.Exceptions;
using Telegram.Bot.Polling;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;
using System.Text.Json;
using System.Globalization;
using System.IO; // Добавлено для устранения неоднозначности File

class Program
{
    private static ITelegramBotClient? _botClient;
    private static ReceiverOptions? _receiverOptions;
    private static string _dataFile = "managers.json";

    // Словарь для хранения состояния пользователей
    private static Dictionary<long, UserState> _userStates = new Dictionary<long, UserState>();

    // Словарь для временного хранения вводимых данных
    private static Dictionary<long, UserData> _userInputData = new Dictionary<long, UserData>();

    // Коллекция менеджеров
    private static HashSet<string> _managers = new HashSet<string>();

    // Временное хранилище пользователей (вместо базы данных)
    private static List<UserData> _users = new List<UserData>();

    enum UserState
    {
        Start,
        CustomerMode,
        WaitingForManagerCode,
        ManagerAuthenticated,
        WaitingForFullName,
        WaitingForBirthDate
    }

    class UserData
    {
        public string? FullName { get; set; }
        public DateTime? BirthDate { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }

    static async Task Main()
    {
        // Загружаем данные менеджеров
        LoadManagers();

        // Убедитесь, что токен правильный и бот создан через @BotFather
        _botClient = new TelegramBotClient("8397722379:AAHXWFHDnBH3z6xVTZGW4sp8Sly8MqdcfTw");

        _receiverOptions = new ReceiverOptions
        {
            AllowedUpdates = Array.Empty<UpdateType>(),
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
        Console.WriteLine($"Загружено менеджеров: {_managers.Count}");
        Console.WriteLine("Нажмите Ctrl+C для остановки...");
        

        // Ожидаем бесконечно
        await Task.Delay(-1, cts.Token);
    }

    // Сохранение пользователя (вместо базы данных)
    private static bool SaveUserToDatabase(string fullName, DateTime birthDate)
    {
        try
        {
            _users.Add(new UserData
            {
                FullName = fullName,
                BirthDate = birthDate,
                CreatedAt = DateTime.Now
            });

            Console.WriteLine($"✅ Пользователь сохранен: {fullName}, {birthDate:dd.MM.yyyy}");
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Ошибка сохранения пользователя: {ex}");
            return false;
        }
    }

    // Получение всех пользователей (вместо базы данных)
    private static List<string> GetUsersFromDatabase()
    {
        return _users
            .OrderByDescending(u => u.CreatedAt)
            .Take(10)
            .Select(u => $"👤 {u.FullName} | 🎂 {u.BirthDate:dd.MM.yyyy} | 📅 {u.CreatedAt:dd.MM.yyyy}")
            .ToList();
    }

    // Загрузка менеджеров из JSON файла
    private static void LoadManagers()
    {
        try
        {
            if (System.IO.File.Exists(_dataFile)) // Явное указание System.IO.File
            {
                var json = System.IO.File.ReadAllText(_dataFile); // Явное указание System.IO.File
                var managersList = JsonSerializer.Deserialize<List<string>>(json);
                if (managersList != null)
                {
                    _managers = new HashSet<string>(managersList);
                    Console.WriteLine($"Загружено {_managers.Count} менеджеров из файла");
                    return;
                }
            }

            // Если файла нет, создаем тестовые данные
            _managers = new HashSet<string>
            {
                "1234567890",
                "0987654321",
                "1111111111",
                "2222222222",
                "3333333333"
            };
            SaveManagers();
            Console.WriteLine("Созданы тестовые данные менеджеров");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Ошибка загрузки менеджеров: {ex}");
            _managers = new HashSet<string> { "1234567890", "0987654321" };
        }
    }

    // Сохранение менеджеров в JSON файл
    private static void SaveManagers()
    {
        try
        {
            var json = JsonSerializer.Serialize(_managers.ToList(), new JsonSerializerOptions { WriteIndented = true });
            System.IO.File.WriteAllText(_dataFile, json); // Явное указание System.IO.File
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Ошибка сохранения менеджеров: {ex}");
        }
    }

    // Добавление нового менеджера
    private static void AddManager(string managerId)
    {
        if (_managers.Add(managerId))
        {
            SaveManagers();
            Console.WriteLine($"Добавлен менеджер: {managerId}");
        }
    }

    // Создание главной клавиатуры с кнопкой "Старт"
    private static ReplyKeyboardMarkup GetMainKeyboard()
    {
        return new ReplyKeyboardMarkup(new[]
        {
            new[]
            {
                new KeyboardButton("🚀 Старт")
            }
        })
        {
            ResizeKeyboard = true,
            OneTimeKeyboard = false
        };
    }

    // Создание клавиатуры с выбором роли после нажатия "Старт"
    private static ReplyKeyboardMarkup GetRoleSelectionKeyboard()
    {
        return new ReplyKeyboardMarkup(new[]
        {
            new[]
            {
                new KeyboardButton("👨‍💼 Войти как менеджер"),
                new KeyboardButton("👤 Войти как заказчик")
            }
        })
        {
            ResizeKeyboard = true,
            OneTimeKeyboard = false
        };
    }

    // Создание клавиатуры с опциями для заказчика
    private static ReplyKeyboardMarkup GetCustomerKeyboard()
    {
        return new ReplyKeyboardMarkup(new[]
        {
            new[]
            {
                new KeyboardButton("📊 Информация о заказе"),
                new KeyboardButton("📱 Запустить приложение")
            },
            new[]
            {
                new KeyboardButton("🔙 Назад")
            }
        })
        {
            ResizeKeyboard = true,
            OneTimeKeyboard = false
        };
    }

    // Создание клавиатуры для менеджера
    private static ReplyKeyboardMarkup GetManagerKeyboard()
    {
        return new ReplyKeyboardMarkup(new[]
        {
            new[]
            {
                new KeyboardButton("📝 Ввести данные пользователя"),
                new KeyboardButton("📊 Показать всех пользователей")
            },
            new[]
            {
                new KeyboardButton("📋 Проверить данные заказов"),
                new KeyboardButton("🚪 Выйти из режима менеджера")
            }
        })
        {
            ResizeKeyboard = true,
            OneTimeKeyboard = false
        };
    }

    // Удаление клавиатуры
    private static ReplyKeyboardRemove RemoveKeyboard()
    {
        return new ReplyKeyboardRemove();
    }

    // Создание inline кнопки для веб-приложения
    private static InlineKeyboardMarkup GetWebAppInlineKeyboard()
    {
        var webAppInfo = new WebAppInfo { Url = "https://quaxww.github.io/" };
        var webAppButton = InlineKeyboardButton.WithWebApp("✨ Открыть приложение ТМК", webAppInfo);
        return new InlineKeyboardMarkup(webAppButton);
    }

    // Обработка команды администратора для добавления менеджера
    private static async Task HandleAdminCommand(ITelegramBotClient botClient, Message message, string[] parts, CancellationToken cancellationToken)
    {
        if (parts.Length < 2)
        {
            await botClient.SendTextMessageAsync(
                chatId: message.Chat.Id,
                text: "Использование: /addmanager 1234567890",
                cancellationToken: cancellationToken);
            return;
        }

        var managerId = parts[1].Trim();
        if (managerId.Length != 10 || !long.TryParse(managerId, out _))
        {
            await botClient.SendTextMessageAsync(
                chatId: message.Chat.Id,
                text: "❌ Неверный формат ID. Должно быть 10 цифр.",
                cancellationToken: cancellationToken);
            return;
        }

        AddManager(managerId);
        await botClient.SendTextMessageAsync(
            chatId: message.Chat.Id,
            text: $"✅ Менеджер {managerId} добавлен в базу",
            cancellationToken: cancellationToken);
    }

    // Обработка ввода кода менеджера
    private static async Task HandleManagerCodeInput(ITelegramBotClient botClient, Message message, CancellationToken cancellationToken)
    {
        var chatId = message.Chat.Id;
        var managerCode = message.Text?.Trim() ?? string.Empty;

        if (_managers.Contains(managerCode))
        {
            _userStates[chatId] = UserState.ManagerAuthenticated;
            await botClient.SendTextMessageAsync(
                chatId: chatId,
                text: "✅ Код принят! Вы успешно авторизовались как менеджер.",
                replyMarkup: GetManagerKeyboard(),
                cancellationToken: cancellationToken);
        }
        else
        {
            _userStates[chatId] = UserState.Start;
            await botClient.SendTextMessageAsync(
                chatId: chatId,
                text: "❌ Неверный код доступа",
                replyMarkup: GetMainKeyboard(),
                cancellationToken: cancellationToken);
        }
    }

    // Начало ввода данных пользователя
    private static async Task StartUserDataInput(ITelegramBotClient botClient, long chatId, CancellationToken cancellationToken)
    {
        _userStates[chatId] = UserState.WaitingForFullName;
        _userInputData[chatId] = new UserData();

        await botClient.SendTextMessageAsync(
            chatId: chatId,
            text: "👤 Введите ФИО пользователя:",
            replyMarkup: RemoveKeyboard(),
            cancellationToken: cancellationToken);
    }

    // Обработка ввода ФИО
    private static async Task HandleFullNameInput(ITelegramBotClient botClient, Message message, CancellationToken cancellationToken)
    {
        var chatId = message.Chat.Id;

        if (_userInputData.ContainsKey(chatId))
        {
            _userInputData[chatId].FullName = message.Text?.Trim() ?? string.Empty;
            _userStates[chatId] = UserState.WaitingForBirthDate;

            await botClient.SendTextMessageAsync(
                chatId: chatId,
                text: "🎂 Введите дату рождения пользователя (в формате ДД.ММ.ГГГГ, например: 15.05.1990):",
                cancellationToken: cancellationToken);
        }
    }

    // Обработка ввода даты рождения
    private static async Task HandleBirthDateInput(ITelegramBotClient botClient, Message message, CancellationToken cancellationToken)
    {
        var chatId = message.Chat.Id;

        if (_userInputData.ContainsKey(chatId) && _userInputData[chatId].FullName != null)
        {
            var inputText = message.Text?.Trim() ?? string.Empty;
            if (DateTime.TryParseExact(inputText,
                new[] { "dd.MM.yyyy", "d.M.yyyy", "dd.MM.yy", "d.M.yy" },
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out DateTime birthDate))
            {
                if (birthDate > DateTime.Now)
                {
                    await botClient.SendTextMessageAsync(
                        chatId: chatId,
                        text: "❌ Дата рождения не может быть в будущем. Введите корректную дату:",
                        cancellationToken: cancellationToken);
                    return;
                }

                _userInputData[chatId].BirthDate = birthDate;

                var success = SaveUserToDatabase(
                    _userInputData[chatId].FullName!,
                    _userInputData[chatId].BirthDate.Value);

                if (success)
                {
                    await botClient.SendTextMessageAsync(
                        chatId: chatId,
                        text: $"✅ Данные успешно сохранены!\n\n👤 ФИО: {_userInputData[chatId].FullName}\n🎂 Дата рождения: {birthDate:dd.MM.yyyy}",
                        replyMarkup: GetManagerKeyboard(),
                        cancellationToken: cancellationToken);
                }
                else
                {
                    await botClient.SendTextMessageAsync(
                        chatId: chatId,
                        text: "❌ Ошибка сохранения данных. Попробуйте еще раз.",
                        replyMarkup: GetManagerKeyboard(),
                        cancellationToken: cancellationToken);
                }

                _userInputData.Remove(chatId);
                _userStates[chatId] = UserState.ManagerAuthenticated;
            }
            else
            {
                await botClient.SendTextMessageAsync(
                    chatId: chatId,
                    text: "❌ Неверный формат даты. Введите дату в формате ДД.ММ.ГГГГ (например: 15.05.1990):",
                    cancellationToken: cancellationToken);
            }
        }
    }

    // Показать всех пользователей
    private static async Task ShowAllUsers(ITelegramBotClient botClient, long chatId, CancellationToken cancellationToken)
    {
        var users = GetUsersFromDatabase();

        if (users.Count == 0)
        {
            await botClient.SendTextMessageAsync(
                chatId: chatId,
                text: "📭 В базе данных пока нет пользователей.",
                replyMarkup: GetManagerKeyboard(),
                cancellationToken: cancellationToken);
            return;
        }

        var usersText = "📋 **Список пользователей:**\n\n" + string.Join("\n", users.Take(10));

        if (users.Count > 10)
        {
            usersText += $"\n\n... и еще {users.Count - 10} пользователей";
        }

        await botClient.SendTextMessageAsync(
            chatId: chatId,
            text: usersText,
            parseMode: ParseMode.Markdown,
            replyMarkup: GetManagerKeyboard(),
            cancellationToken: cancellationToken);
    }

    // Обработка команды "Проверить данные заказов"
    private static async Task HandleCheckOrders(ITelegramBotClient botClient, long chatId, CancellationToken cancellationToken)
    {
        var ordersInfo = @"📊 **Данные заказов:**

🆕 Новые заказы: 5
⚙️ В обработке: 3
✅ Подтвержденные: 8
🚚 Отправленные: 6
📦 Доставленные: 12

💰 Общая сумма: 1,250,000 ₽
📅 За сегодня: 3 заказа на 150,000 ₽";

        await botClient.SendTextMessageAsync(
            chatId: chatId,
            text: ordersInfo,
            parseMode: ParseMode.Markdown,
            replyMarkup: GetManagerKeyboard(),
            cancellationToken: cancellationToken);
    }

    // Выход из режима менеджера
    private static async Task HandleManagerLogout(ITelegramBotClient botClient, long chatId, CancellationToken cancellationToken)
    {
        _userStates[chatId] = UserState.Start;

        if (_userInputData.ContainsKey(chatId))
        {
            _userInputData.Remove(chatId);
        }

        await botClient.SendTextMessageAsync(
            chatId: chatId,
            text: "👋 Вы вышли из режима менеджера.",
            replyMarkup: GetMainKeyboard(),
            cancellationToken: cancellationToken);
    }

    private static async Task HandleUpdateAsync(ITelegramBotClient botClient, Update update, CancellationToken cancellationToken)
    {
        try
        {
            switch (update.Type)
            {
                case UpdateType.Message:
                    if (update.Message != null)
                    {
                        await HandleMessageAsync(botClient, update.Message, cancellationToken);
                    }
                    break;
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
        var chatId = message.Chat.Id;
        if (message.Document != null)
        {
            await botClient.SendTextMessageAsync(
                chatId: chatId,
                text: "Файл успешно загружен! Теперь вы можете отследить статус вашего заказа.",
                cancellationToken: cancellationToken);
        }
        if (message?.Text == null)
            return;

        var userName = message.From?.FirstName ?? "Неизвестный пользователь";
        var messageText = message.Text;

        Console.WriteLine($"Сообщение от {userName} (ID: {chatId}): {messageText}");
        

        if (!_userStates.ContainsKey(chatId))
        {
            _userStates[chatId] = UserState.Start;
        }

        var currentState = _userStates[chatId];
        if (messageText.StartsWith('/'))
        {
            var parts = messageText.Split(' ');
            var command = parts[0].ToLower();

            switch (command)
            {
                case "/start":
                    await ShowStartMenu(botClient, chatId, userName, cancellationToken);
                    break;
                case "/run":
                    await LaunchApplication(botClient, chatId, cancellationToken);
                    break;
                case "/help":
                    await ShowHelp(botClient, chatId, currentState, cancellationToken);
                    break;
                case "/addmanager":
                    await HandleAdminCommand(botClient, message, parts, cancellationToken);
                    break;
                case "/test":
                    await botClient.SendTextMessageAsync(
                        chatId: chatId,
                        text: "Бот работает корректно! ✅",
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
            switch (currentState)
            {
                case UserState.Start:
                    await HandleStartState(botClient, message, chatId, userName, cancellationToken);
                    break;
                case UserState.CustomerMode:
                    await HandleCustomerState(botClient, message, chatId, userName, cancellationToken);
                    break;
                case UserState.WaitingForManagerCode:
                    await HandleManagerCodeInput(botClient, message, cancellationToken);
                    break;
                case UserState.WaitingForFullName:
                    await HandleFullNameInput(botClient, message, cancellationToken);
                    break;
                case UserState.WaitingForBirthDate:
                    await HandleBirthDateInput(botClient, message, cancellationToken);
                    break;
                case UserState.ManagerAuthenticated:
                    await HandleManagerState(botClient, message, chatId, cancellationToken);
                    break;
            }
        }
    }

    // Обработка состояния Start
    private static async Task HandleStartState(ITelegramBotClient botClient, Message message, long chatId, string userName, CancellationToken cancellationToken)
    {
        switch (message.Text)
        {
            case "🚀 Старт":
                await ShowRoleSelectionMenu(botClient, chatId, userName, cancellationToken);
                break;
            case "👨‍💼 Войти как менеджер":
                await HandleManagerLogin(botClient, chatId, cancellationToken);
                break;
            case "👤 Войти как заказчик":
                await HandleCustomerLogin(botClient, chatId, userName, cancellationToken);
                break;
            default:
                await ShowStartMenu(botClient, chatId, userName, cancellationToken);
                break;
        }
    }

    // Обработка состояния CustomerMode
    private static async Task HandleCustomerState(ITelegramBotClient botClient, Message message, long chatId, string userName, CancellationToken cancellationToken)
    {
        switch (message.Text)
        {
            case "📊 Информация о заказе":
                await ShowOrderInfo(botClient, chatId, cancellationToken);
                break;
            case "📱 Запустить приложение":
                await LaunchApplication(botClient, chatId, cancellationToken);
                break;
            case "🔙 Назад":
                _userStates[chatId] = UserState.Start;
                await ShowStartMenu(botClient, chatId, userName, cancellationToken);
                break;
            default:
                await botClient.SendTextMessageAsync(
                    chatId: chatId,
                    text: "Используйте кнопки ниже для работы:",
                    replyMarkup: GetCustomerKeyboard(),
                    cancellationToken: cancellationToken);
                break;
        }
    }

    // Обработка состояния ManagerAuthenticated
    private static async Task HandleManagerState(ITelegramBotClient botClient, Message message, long chatId, CancellationToken cancellationToken)
    {
        switch (message.Text)
        {
            case "📝 Ввести данные пользователя":
                await StartUserDataInput(botClient, chatId, cancellationToken);
                break;
            case "📊 Показать всех пользователей":
                await ShowAllUsers(botClient, chatId, cancellationToken);
                break;
            case "📋 Проверить данные заказов":
                await HandleCheckOrders(botClient, chatId, cancellationToken);
                break;
            case "🚪 Выйти из режима менеджера":
                await HandleManagerLogout(botClient, chatId, cancellationToken);
                break;
            default:
                await botClient.SendTextMessageAsync(
                    chatId: chatId,
                    text: "Используйте кнопки ниже для работы:",
                    replyMarkup: GetManagerKeyboard(),
                    cancellationToken: cancellationToken);
                break;
        }
    }

    // Показать стартовое меню с кнопкой "Старт"
    private static async Task ShowStartMenu(ITelegramBotClient botClient, long chatId, string userName, CancellationToken cancellationToken)
    {
        _userStates[chatId] = UserState.Start;

        await botClient.SendTextMessageAsync(
            chatId: chatId,
            text: $"👋 Привет, {userName}!\n\nДобро пожаловать в сервис ТМК! Нажмите кнопку ниже, чтобы начать работу.",
            replyMarkup: GetMainKeyboard(),
            cancellationToken: cancellationToken);
    }

    // Показать меню выбора роли
    private static async Task ShowRoleSelectionMenu(ITelegramBotClient botClient, long chatId, string userName, CancellationToken cancellationToken)
    {
        await botClient.SendTextMessageAsync(
            chatId: chatId,
            text: $"🎯 {userName}, выберите режим работы:",
            replyMarkup: GetRoleSelectionKeyboard(),
            cancellationToken: cancellationToken);
    }

    // Обработка входа как менеджер
    private static async Task HandleManagerLogin(ITelegramBotClient botClient, long chatId, CancellationToken cancellationToken)
    {
        _userStates[chatId] = UserState.WaitingForManagerCode;

        await botClient.SendTextMessageAsync(
            chatId: chatId,
            text: "🔐 Введите код менеджера (10 цифр):",
            replyMarkup: RemoveKeyboard(),
            cancellationToken: cancellationToken);
    }

    // Обработка входа как заказчик
    private static async Task HandleCustomerLogin(ITelegramBotClient botClient, long chatId, string userName, CancellationToken cancellationToken)
    {
        _userStates[chatId] = UserState.CustomerMode;

        await botClient.SendTextMessageAsync(
            chatId: chatId,
            text: $"👤 {userName}, выберите нужную опцию:",
            replyMarkup: GetCustomerKeyboard(),
            cancellationToken: cancellationToken);
    }

    // Показать информацию о заказе
    private static async Task ShowOrderInfo(ITelegramBotClient botClient, long chatId, CancellationToken cancellationToken)
    {
        var orderInfo = @"📊 **Информация о текущем заказе**

🆔 Номер заказа: TMK-20240115-0001
📅 Дата создания: 15.01.2024
💰 Сумма: 150 000 ₽
📦 Статус: В обработке

📋 **Состав заказа:**
• Труба стальная 57x3.5 - 100 м
• Труба стальная 89x4 - 50 м
• Труба стальная 108x4.5 - 25 м

⏳ Ожидаемая дата отгрузки: 20.11.2025";

        await botClient.SendTextMessageAsync(
            chatId: chatId,
            text: orderInfo,
            parseMode: ParseMode.Markdown,
            replyMarkup: GetCustomerKeyboard(),
            cancellationToken: cancellationToken);
    }

    // Запуск приложения
    private static async Task LaunchApplication(ITelegramBotClient botClient, long chatId, CancellationToken cancellationToken)
    {
        await botClient.SendTextMessageAsync(
            chatId: chatId,
            text: "📱 **Приложение ТМК**\n\nНажмите кнопку ниже, чтобы открыть веб-приложение:",
            parseMode: ParseMode.Markdown,
            replyMarkup: GetWebAppInlineKeyboard(),
            cancellationToken: cancellationToken);
    }

    // Показать справку
    private static async Task ShowHelp(ITelegramBotClient botClient, long chatId, UserState currentState, CancellationToken cancellationToken)
    {
        var helpText = currentState switch
        {
            UserState.ManagerAuthenticated =>
                "📋 **Помощь для менеджера:**\n\n" +
                "• 'Ввести данные пользователя' - добавить нового пользователя\n" +
                "• 'Показать всех пользователей' - просмотр списка пользователей\n" +
                "• 'Проверить данные заказов' - просмотр статистики заказов\n" +
                "• 'Выйти из режима менеджера' - завершить сеанс менеджера\n" +
                "• /help - показать эту справку",

            UserState.CustomerMode =>
                "📋 **Помощь для заказчика:**\n\n" +
                "• 'Информация о заказе' - посмотреть статус текущего заказа\n" +
                "• 'Запустить приложение' - открыть веб-приложение ТМК\n" +
                "• 'Назад' - вернуться к выбору режима\n" +
                "• /help - показать эту справку",

            _ =>
                "📋 **Доступные команды:**\n\n" +
                "/start - начать работу\n" +
                "/help - помощь\n" +
                "/addmanager [код] - добавить менеджера (админ)\n" +
                "/test - тест работы бота\n\n" +
                "Для доступа к функциям менеджера нажмите кнопку 'Войти как менеджер'"
        };

        await botClient.SendTextMessageAsync(
            chatId: chatId,
            text: helpText,
            parseMode: ParseMode.Markdown,
            cancellationToken: cancellationToken);
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
