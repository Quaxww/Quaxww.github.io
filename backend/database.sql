-- Создание базы данных и таблицы менеджеров
CREATE TABLE IF NOT EXISTS Managers (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ManagerId TEXT NOT NULL UNIQUE,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Вставка тестовых данных
INSERT OR IGNORE INTO Managers (ManagerId) VALUES 
('1234567890'),
('0987654321'), 
('1111111111'),
('2222222222'),
('3333333333');
-- Для SQLite (создаст файл users.db)

CREATE TABLE Users (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    FullName TEXT NOT NULL,
    BirthDate TEXT NOT NULL,
    CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);


-- Подключитесь к базе и выполните:
SELECT * FROM Users ORDER BY CreatedAt DESC;

-- Или с форматированием:
SELECT 
    Id,
    FullName as 'ФИО', 
    BirthDate as 'Дата рождения',
    CreatedAt as 'Дата создания'
FROM Users 
ORDER BY CreatedAt DESC;