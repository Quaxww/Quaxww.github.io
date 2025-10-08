using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

public class JsonOrderProcessor
{
    
    private string _ordersDirectory;

    public JsonOrderProcessor(string ordersDirectory = "Orders")
    {
        _ordersDirectory = ordersDirectory;
        
        // Создаем директорию для заказов, если не существует
        if (!Directory.Exists(_ordersDirectory))
        {
            Directory.CreateDirectory(_ordersDirectory);
        }
    }
    

    // Модели для десериализации JSON
    public class JsonOrderData
    {
        public CustomerData Customer { get; set; }
        public OrderInfo Order { get; set; }
        public CartData Cart { get; set; }
        public Metadata Metadata { get; set; }
    }

    public class CustomerData
    {
        public string FullName { get; set; }
        public string Phone { get; set; }
        public string Email { get; set; }
        public string Company { get; set; }
        public string DeliveryAddress { get; set; }
    }

    public class OrderInfo
    {
        public decimal SubtotalAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public string CustomerNotes { get; set; }
        public string PaymentMethod { get; set; }
    }

    public class CartData
    {
        public List<CartItem> CartItems { get; set; }
        public decimal TotalAmount { get; set; }
        public int ItemCount { get; set; }
        public string ExportDate { get; set; }
    }

    public class CartItem
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; }
        public decimal Quantity { get; set; }
        public string UnitType { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal TotalPrice { get; set; }
        public ProductData ProductData { get; set; }
        public string AddedAt { get; set; }
    }

    public class ProductData
    {
        public string Gost { get; set; }
        public string SteelGrade { get; set; }
        public decimal Diameter { get; set; }
        public decimal WallThickness { get; set; }
        public string Warehouse { get; set; }
    }

    public class Metadata
    {
        public string OrderDate { get; set; }
        public string UserAgent { get; set; }
        public string Source { get; set; }
    }

    // Метод для обработки JSON файла заказа
    public bool ProcessOrderFromJson(string jsonFilePath)
    {
        try
        {
            // Читаем JSON файл
            string jsonContent = File.ReadAllText(jsonFilePath);

            // Десериализуем JSON
            var orderData = JsonSerializer.Deserialize<JsonOrderData>(
                jsonContent,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            );

            if (orderData == null)
            {
                throw new Exception("Не удалось десериализовать JSON файл");
            }

            // Сохраняем заказ в базу данных
            var database = new TMKOrderDatabase();

            var customer = new Customer
            {
                FullName = orderData.Customer.FullName,
                Phone = orderData.Customer.Phone,
                Email = orderData.Customer.Email,
                Company = orderData.Customer.Company,
                DeliveryAddress = orderData.Customer.DeliveryAddress
            };

            var order = new Order
            {
                Customer = customer,
                SubtotalAmount = orderData.Order.SubtotalAmount,
                DiscountAmount = orderData.Order.DiscountAmount,
                TotalAmount = orderData.Order.TotalAmount,
                ShippingAddress = orderData.Customer.DeliveryAddress,
                CustomerNotes = orderData.Order.CustomerNotes,
                PaymentMethod = orderData.Order.PaymentMethod
            };

            // Добавляем товары из корзины
            foreach (var jsonItem in orderData.Cart.CartItems)
            {
                order.OrderItems.Add(new OrderItem
                {
                    ProductId = jsonItem.ProductId,
                    ProductName = jsonItem.ProductName,
                    Quantity = jsonItem.Quantity,
                    UnitType = jsonItem.UnitType,
                    UnitPrice = jsonItem.UnitPrice,
                    DiscountPercent = 0, // Можно рассчитать на основе данных
                    LineTotal = jsonItem.TotalPrice
                });
            }
            // Обработка JSON заказов
            var jsonProcessor = new JsonOrderProcessor();

            // Обработать все JSON файлы в директории
            jsonProcessor.ProcessAllJsonOrders();

            // Создать шаблон заказа
            string template = jsonProcessor.CreateOrderTemplate();
            File.WriteAllText("order_template.json", template);
            Console.WriteLine("Шаблон заказа создан: order_template.json");

            // Сохраняем в базу данных
            int orderId = database.CreateCompleteOrder(order);

            Console.WriteLine($"Заказ #{orderId} успешно обработан из JSON файла");


            // Архивируем обработанный файл
            ArchiveProcessedFile(jsonFilePath, orderId);

            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Ошибка обработки JSON заказа: {ex.Message}");
            return false;
        }
        
    }
    

    private void ArchiveProcessedFile(string originalFilePath, int orderId)
    {
        try
        {
            string fileName = Path.GetFileName(originalFilePath);
            string archivePath = Path.Combine(_ordersDirectory, "Processed", $"order_{orderId}_{fileName}");

            // Создаем директорию для обработанных файлов
            Directory.CreateDirectory(Path.GetDirectoryName(archivePath));

            File.Move(originalFilePath, archivePath);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Ошибка архивации файла: {ex.Message}");
        }
    }

    // Метод для автоматической обработки всех JSON файлов в директории
    public void ProcessAllJsonOrders()
    {
        var jsonFiles = Directory.GetFiles(_ordersDirectory, "*.json");
        
        Console.WriteLine($"Найдено {jsonFiles.Length} JSON файлов для обработки");

        foreach (var jsonFile in jsonFiles)
        {
            try
            {
                Console.WriteLine($"Обработка файла: {Path.GetFileName(jsonFile)}");
                bool success = ProcessOrderFromJson(jsonFile);
                
                if (success)
                {
                    Console.WriteLine($"Файл {Path.GetFileName(jsonFile)} успешно обработан");
                }
                else
                {
                    Console.WriteLine($"Не удалось обработать файл {Path.GetFileName(jsonFile)}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка при обработке файла {jsonFile}: {ex.Message}");
            }
        }
    }
    

    // Метод для создания JSON шаблона заказа
    public string CreateOrderTemplate()
    {
        var template = new JsonOrderData
        {
            Customer = new CustomerData
            {
                FullName = "Иванов Иван Иванович",
                Phone = "+7 (999) 999-99-99",
                Email = "ivanov@example.com",
                Company = "ООО Ромашка",
                DeliveryAddress = "г. Москва, ул. Примерная, д. 1"
            },
            Order = new OrderInfo
            {
                SubtotalAmount = 10000.00m,
                DiscountAmount = 1000.00m,
                TotalAmount = 9000.00m,
                CustomerNotes = "Комментарий к заказу",
                PaymentMethod = "bank_transfer"
            },
            Cart = new CartData
            {
                CartItems = new List<CartItem>
                {
                    new CartItem
                    {
                        ProductId = 1,
                        ProductName = "Труба стальная электросварная 57x3.5мм",
                        Quantity = 20.0m,
                        UnitType = "meters",
                        UnitPrice = 450.00m,
                        TotalPrice = 9000.00m,
                        ProductData = new ProductData
                        {
                            Gost = "ГОСТ 10704-91",
                            SteelGrade = "Ст3сп",
                            Diameter = 57.0m,
                            WallThickness = 3.5m,
                            Warehouse = "Склад Москва"
                        }
                    }
                },
                TotalAmount = 9000.00m,
                ItemCount = 1,
                ExportDate = DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss")
            },
            Metadata = new Metadata
            {
                OrderDate = DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss"),
                UserAgent = "TMK Web App",
                Source = "web"
            }
        };

        return JsonSerializer.Serialize(template, new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
    }
}