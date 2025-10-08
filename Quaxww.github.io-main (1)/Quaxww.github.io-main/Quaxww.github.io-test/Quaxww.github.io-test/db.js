// database.js
class OrdersDatabase {
    constructor() {
        this.db = null;
        this.init();
    }

    // Инициализация базы данных
    async init() {
        return new Promise((resolve, reject) => {
            try {
                // В реальном приложении здесь будет работа с SQLite
                // Для демонстрации используем localStorage как временное хранилище
                console.log('Database initialized');
                this.db = {
                    storage: localStorage,
                    prefix: 'tmk_orders_'
                };
                resolve(true);
            } catch (error) {
                console.error('Database initialization failed:', error);
                reject(error);
            }
        });
    }

    // Генерация номера заказа
    generateOrderNumber() {
        const timestamp = new Date().getTime();
        const random = Math.floor(Math.random() * 1000);
        return `TMK-${timestamp}-${random}`;
    }

    // Сохранение заказа
    async saveOrder(orderData) {
        return new Promise((resolve, reject) => {
            try {
                const orderNumber = this.generateOrderNumber();
                const order = {
                    ...orderData,
                    order_number: orderNumber,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                // Сохраняем в localStorage (в реальном приложении - в SQLite)
                const orders = this.getOrdersFromStorage();
                orders.push(order);
                this.saveOrdersToStorage(orders);

                console.log('Order saved successfully:', orderNumber);
                resolve(orderNumber);
            } catch (error) {
                console.error('Error saving order:', error);
                reject(error);
            }
        });
    }

    // Получение всех заказов
    async getOrders() {
        return new Promise((resolve) => {
            const orders = this.getOrdersFromStorage();
            resolve(orders);
        });
    }

    // Получение заказа по номеру
    async getOrderByNumber(orderNumber) {
        return new Promise((resolve) => {
            const orders = this.getOrdersFromStorage();
            const order = orders.find(o => o.order_number === orderNumber);
            resolve(order || null);
        });
    }

    // Обновление статуса заказа
    async updateOrderStatus(orderNumber, newStatus, reason = '') {
        return new Promise((resolve, reject) => {
            try {
                const orders = this.getOrdersFromStorage();
                const orderIndex = orders.findIndex(o => o.order_number === orderNumber);
                
                if (orderIndex !== -1) {
                    const oldStatus = orders[orderIndex].order_status;
                    orders[orderIndex].order_status = newStatus;
                    orders[orderIndex].updated_at = new Date().toISOString();
                    
                    // Логируем изменение статуса
                    this.logStatusChange(orderNumber, oldStatus, newStatus, reason);
                    
                    this.saveOrdersToStorage(orders);
                    console.log(`Order ${orderNumber} status updated from ${oldStatus} to ${newStatus}`);
                    resolve(true);
                } else {
                    reject(new Error('Order not found'));
                }
            } catch (error) {
                console.error('Error updating order status:', error);
                reject(error);
            }
        });
    }

    // Вспомогательные методы для работы с localStorage
    getOrdersFromStorage() {
        const stored = this.db.storage.getItem(this.db.prefix + 'orders');
        return stored ? JSON.parse(stored) : [];
    }

    saveOrdersToStorage(orders) {
        this.db.storage.setItem(this.db.prefix + 'orders', JSON.stringify(orders));
    }

    logStatusChange(orderNumber, oldStatus, newStatus, reason) {
        const logs = this.getStatusLogsFromStorage();
        logs.push({
            order_number: orderNumber,
            old_status: oldStatus,
            new_status: newStatus,
            change_reason: reason,
            changed_at: new Date().toISOString(),
            changed_by: 'system'
        });
        this.db.storage.setItem(this.db.prefix + 'status_logs', JSON.stringify(logs));
    }

    getStatusLogsFromStorage() {
        const stored = this.db.storage.getItem(this.db.prefix + 'status_logs');
        return stored ? JSON.parse(stored) : [];
    }

    // Получение статистики по заказам
    async getOrderStats() {
        return new Promise((resolve) => {
            const orders = this.getOrdersFromStorage();
            const stats = {
                total: orders.length,
                by_status: {},
                today: 0,
                this_week: 0,
                this_month: 0
            };

            const today = new Date();
            const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

            orders.forEach(order => {
                // Статистика по статусам
                stats.by_status[order.order_status] = (stats.by_status[order.order_status] || 0) + 1;

                // Статистика по времени
                const orderDate = new Date(order.created_at);
                if (orderDate.toDateString() === new Date().toDateString()) {
                    stats.today++;
                }
                if (orderDate >= weekStart) {
                    stats.this_week++;
                }
                if (orderDate >= monthStart) {
                    stats.this_month++;
                }
            });

            resolve(stats);
        });
    }

    // Поиск заказов
    async searchOrders(query) {
        return new Promise((resolve) => {
            const orders = this.getOrdersFromStorage();
            const results = orders.filter(order => 
                order.order_number.toLowerCase().includes(query.toLowerCase()) ||
                order.customer_name.toLowerCase().includes(query.toLowerCase()) ||
                order.customer_email.toLowerCase().includes(query.toLowerCase()) ||
                order.customer_phone.includes(query)
            );
            resolve(results);
        });
    }

    // Экспорт заказов в CSV
    async exportOrdersToCSV() {
        return new Promise((resolve) => {
            const orders = this.getOrdersFromStorage();
            const headers = ['Номер заказа', 'ФИО', 'Телефон', 'Email', 'Компания', 'Адрес', 'Статус', 'Сумма', 'Дата создания'];
            
            let csv = headers.join(';') + '\n';
            
            orders.forEach(order => {
                const row = [
                    order.order_number,
                    order.customer_name,
                    order.customer_phone,
                    order.customer_email,
                    order.customer_company || '',
                    order.delivery_address || '',
                    order.order_status,
                    order.total_amount,
                    new Date(order.created_at).toLocaleDateString('ru-RU')
                ];
                csv += row.join(';') + '\n';
            });

            resolve(csv);
        });
    }
}

// Создаем глобальный экземпляр базы данных
window.ordersDB = new OrdersDatabase();