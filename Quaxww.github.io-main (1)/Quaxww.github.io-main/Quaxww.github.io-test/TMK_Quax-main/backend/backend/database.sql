-- �������� ���� ������ � ������� ����������
CREATE TABLE IF NOT EXISTS Managers (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ManagerId TEXT NOT NULL UNIQUE,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ������� �������� ������
INSERT OR IGNORE INTO Managers (ManagerId) VALUES 
('1234567890'),
('0987654321'), 
('1111111111'),
('2222222222'),
('3333333333');
-- ��� SQLite (������� ���� users.db)

CREATE TABLE Users (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    FullName TEXT NOT NULL,
    BirthDate TEXT NOT NULL,
    CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);


-- ������������ � ���� � ���������:
SELECT * FROM Users ORDER BY CreatedAt DESC;

-- ��� � ���������������:
SELECT 
    Id,
    FullName as '���', 
    BirthDate as '���� ��������',
    CreatedAt as '���� ��������'
FROM Users 
ORDER BY CreatedAt DESC;