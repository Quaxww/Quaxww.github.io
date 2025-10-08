// Функции для работы с корзиной в JSON формате
class CartManager {
    constructor() {
        this.cart = this.loadCart();
    }

    // Загрузка корзины из localStorage
    loadCart() {
        try {
            const cartData = localStorage.getItem('tmk_cart');
            if (cartData) {
                return JSON.parse(cartData);
            }
        } catch (e) {
            console.error('Ошибка загрузки корзины:', e);
        }
        return [];
    }

    // Сохранение корзины в localStorage
    saveCart() {
        try {
            localStorage.setItem('tmk_cart', JSON.stringify(this.cart));
            this.updateCartCount();
            return true;
        } catch (e) {
            console.error('Ошибка сохранения корзины:', e);
            return false;
        }
    }

    // Добавление товара в корзину
    addToCart(product, quantity, unitType) {
        const cartItem = {
            productId: product.id,
            productName: product.name,
            quantity: parseFloat(quantity),
            unitType: unitType,
            unitPrice: unitType === 'meters' ? product.pricePerMeter : product.pricePerTon,
            totalPrice: parseFloat(quantity) * (unitType === 'meters' ? product.pricePerMeter : product.pricePerTon),
            productData: {
                gost: product.gost,
                steelGrade: product.steelGrade,
                diameter: product.diameter,
                wallThickness: product.wallThickness,
                warehouse: product.warehouse
            },
            addedAt: new Date().toISOString()
        };

        // Проверяем, есть ли уже такой товар в корзине
        const existingItemIndex = this.cart.findIndex(item => 
            item.productId === cartItem.productId && item.unitType === cartItem.unitType
        );

        if (existingItemIndex !== -1) {
            // Обновляем существующий товар
            this.cart[existingItemIndex].quantity += cartItem.quantity;
            this.cart[existingItemIndex].totalPrice += cartItem.totalPrice;
        } else {
            // Добавляем новый товар
            this.cart.push(cartItem);
        }

        return this.saveCart();
    }

    // Удаление товара из корзины
    removeFromCart(productId, unitType) {
        this.cart = this.cart.filter(item => 
            !(item.productId === productId && item.unitType === unitType)
        );
        return this.saveCart();
    }

    // Очистка корзины
    clearCart() {
        this.cart = [];
        return this.saveCart();
    }

    // Получение общей суммы
    getTotalAmount() {
        return this.cart.reduce((total, item) => total + item.totalPrice, 0);
    }

    // Получение количества товаров
    getCartCount() {
        return this.cart.reduce((count, item) => count + item.quantity, 0);
    }

    // Обновление счетчика в интерфейсе
    updateCartCount() {
        const cartCountElement = document.getElementById('cartCount');
        if (cartCountElement) {
            cartCountElement.textContent = this.getCartCount().toFixed(2);
        }
    }

    // Экспорт корзины в JSON
    exportToJSON() {
        return JSON.stringify({
            cartItems: this.cart,
            totalAmount: this.getTotalAmount(),
            itemCount: this.cart.length,
            exportDate: new Date().toISOString()
        }, null, 2);
    }

    // Импорт корзины из JSON
    importFromJSON(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (data.cartItems && Array.isArray(data.cartItems)) {
                this.cart = data.cartItems;
                return this.saveCart();
            }
        } catch (e) {
            console.error('Ошибка импорта корзины:', e);
        }
        return false;
    }
}

// Функция оформления заказа с экспортом в JSON
async function submitOrder() {
    const orderData = {
        customer: {
            fullName: document.getElementById('customerName').value,
            phone: document.getElementById('customerPhone').value,
            email: document.getElementById('customerEmail').value,
            company: document.getElementById('customerCompany').value,
            deliveryAddress: document.getElementById('deliveryAddress').value
        },
        order: {
            subtotalAmount: cartManager.getTotalAmount(),
            discountAmount: calculateDiscount(cartManager.getTotalAmount()),
            totalAmount: cartManager.getTotalAmount() - calculateDiscount(cartManager.getTotalAmount()),
            customerNotes: document.getElementById('orderComment').value,
            paymentMethod: 'bank_transfer'
        },
        cart: JSON.parse(cartManager.exportToJSON()),
        metadata: {
            orderDate: new Date().toISOString(),
            userAgent: navigator.userAgent,
            source: 'tmk_web_app'
        }
    };

    try {
        // 1. Сохраняем заказ в JSON файл
        await saveOrderAsJSON(orderData);
        
        // 2. Отправляем данные на сервер (если нужно)
        await sendOrderToServer(orderData);
        
        // 3. Очищаем корзину
        cartManager.clearCart();
        
        // 4. Показываем успех
        showOrderSuccess(orderData);
        
    } catch (error) {
        console.error('Ошибка оформления заказа:', error);
        showOrderError(error.message);
    }
}

// Функция сохранения заказа как JSON файл
function saveOrderAsJSON(orderData) {
    return new Promise((resolve, reject) => {
        try {
            // Создаем красивый JSON с отступами
            const jsonData = JSON.stringify(orderData, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Создаем ссылку для скачивания
            const a = document.createElement('a');
            a.href = url;
            a.download = `order_tmk_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Освобождаем память
            URL.revokeObjectURL(url);
            
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

// Функция отправки заказа на сервер C#
async function sendOrderToServer(orderData) {
    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Заказ успешно отправлен на сервер:', result);
        return result;
    } catch (error) {
        console.error('Ошибка отправки заказа на сервер:', error);
        // Не прерываем процесс, т.к. JSON файл уже сохранен
    }
}

// Глобальный экземпляр менеджера корзины
const cartManager = new CartManager();
class TMKApp {
    constructor() {
        this.products = [];
        this.filteredProducts = [];
        this.filters = {
            stock: '',
            type: '',
            diameter: '',
            thickness: '',
            gost: '',
            steel: '',
            search: ''
        };
        this.sortBy = 'name';
        this.cart = [];
        this.currentProduct = null;
        this.currentUnit = 'meters';
        this.captcha = {
            num1: 0,
            num2: 0,
            operator: '+',
            answer: 0
        };
        
        // API endpoints - измените на ваш URL бэкенда
        this.API_BASE_URL = 'http://localhost:8080/api';
        this.isServerConnected = false;
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.initTheme();
        this.renderFilters();
        this.renderProducts();
        this.bindEvents();
        this.updateCartCount();
        
        // Проверяем соединение с сервером
        this.checkServerConnection();
        
        this.showNotification('ТМК - Добро пожаловать!', 'success');
    }

    async loadData() {
        try {
            this.showLoading(true);
            console.log('🔄 Loading data from JSON files...');
            
            const [nomenclature, prices, remnants, stocks, types] = await Promise.all([
                this.fetchJSON('data/nomenclature.json'),
                this.fetchJSON('data/prices.json'),
                this.fetchJSON('data/remnants.json'),
                this.fetchJSON('data/stocks.json'),
                this.fetchJSON('data/types.json')
            ]);

            console.log('✅ Data loaded successfully:', {
                nomenclature: nomenclature.ArrayOfNomenclatureEl?.length || 0,
                prices: prices.ArrayOfPricesEl?.length || 0,
                remnants: remnants.ArrayOfRemnantsEl?.length || 0,
                stocks: stocks.ArrayOfStockEl?.length || 0,
                types: types.ArrayOfTypeEl?.length || 0
            });

            this.products = this.combineProductData(
                nomenclature.ArrayOfNomenclatureEl,
                prices.ArrayOfPricesEl,
                remnants.ArrayOfRemnantsEl,
                stocks.ArrayOfStockEl,
                types.ArrayOfTypeEl
            );
            
            console.log('🎯 Combined products:', this.products.length);
            
            this.filteredProducts = [...this.products];
            this.hideLoading();
            this.updateProductsStats();
            
        } catch (error) {
            console.error('❌ Error loading data:', error);
            this.showNotification('Ошибка загрузки данных. Проверьте JSON файлы.', 'error');
            this.hideLoading();
        }
    }

    async fetchJSON(url) {
        console.log(`📥 Fetching: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log(`✅ Loaded: ${url}`, data);
        return data;
    }

    combineProductData(products, prices, remnants, stocks, types) {
        if (!products || !prices || !remnants || !stocks || !types) {
            console.error('Missing data:', { products, prices, remnants, stocks, types });
            return [];
        }

        return products.map(product => {
            const price = prices.find(p => p.ID === product.ID);
            const remnant = remnants.find(r => r.ID === product.ID);
            const stockId = remnant?.IDStock || price?.IDStock;
            const stock = stocks.find(s => s.IDStock === stockId) || {};
            const typeInfo = types.find(t => t.IDType === product.IDType) || {};

            return {
                ...product,
                price: price || {},
                remnant: remnant || {},
                stock: stock || {},
                typeInfo: typeInfo || {}
            };
        });
    }

    initTheme() {
        const savedTheme = localStorage.getItem('tmk-theme') || 'light';
        this.setTheme(savedTheme);
        
        document.getElementById('themeToggle').addEventListener('click', () => {
            const newTheme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            this.setTheme(newTheme);
        });
    }

    setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('tmk-theme', theme);
        
        const themeIcon = document.querySelector('.theme-icon');
        if (themeIcon) {
            themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    }

    renderFilters() {
        this.renderStockFilter();
        this.renderTypeFilter();
        this.renderGostFilter();
        this.renderSteelFilter();
    }

    renderStockFilter() {
        const stocks = [...new Set(this.products.map(p => p.stock.Stock).filter(Boolean))];
        const select = document.getElementById('stockFilter');
        if (!select) return;
        
        select.innerHTML = '<option value="">Все склады</option>';
        stocks.forEach(stock => {
            const option = document.createElement('option');
            option.value = stock;
            option.textContent = stock;
            select.appendChild(option);
        });
    }

    renderTypeFilter() {
        const types = [...new Set(this.products.map(p => p.typeInfo.Type).filter(Boolean))];
        const select = document.getElementById('typeFilter');
        if (!select) return;
        
        select.innerHTML = '<option value="">Все типы</option>';
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            select.appendChild(option);
        });
    }

    renderGostFilter() {
        const gosts = [...new Set(this.products.map(p => p.Gost).filter(Boolean))];
        const select = document.getElementById('gostFilter');
        if (!select) return;
        
        select.innerHTML = '<option value="">Все ГОСТы</option>';
        gosts.forEach(gost => {
            const option = document.createElement('option');
            option.value = gost;
            option.textContent = gost;
            select.appendChild(option);
        });
    }

    renderSteelFilter() {
        const steels = [...new Set(this.products.map(p => p.SteelGrade).filter(Boolean))];
        const select = document.getElementById('steelFilter');
        if (!select) return;
        
        select.innerHTML = '<option value="">Все марки</option>';
        steels.forEach(steel => {
            const option = document.createElement('option');
            option.value = steel;
            option.textContent = steel;
            select.appendChild(option);
        });
    }

    updateProductsStats() {
        const totalCount = this.filteredProducts.length;
        const availableCount = this.filteredProducts.filter(p => 
            (p.remnant.InStockM || 0) > 0 || (p.remnant.InStockT || 0) > 0
        ).length;

        const countElement = document.getElementById('productsCount');
        const availableElement = document.getElementById('availableCount');
        
        if (countElement) countElement.textContent = `${totalCount} товаров`;
        if (availableElement) availableElement.textContent = `${availableCount} в наличии`;
    }

    sortProducts() {
        switch (this.sortBy) {
            case 'name':
                this.filteredProducts.sort((a, b) => a.Name.localeCompare(b.Name));
                break;
            case 'price':
                this.filteredProducts.sort((a, b) => {
                    const priceA = a.price?.PriceM || 0;
                    const priceB = b.price?.PriceM || 0;
                    return priceA - priceB;
                });
                break;
            case 'price-desc':
                this.filteredProducts.sort((a, b) => {
                    const priceA = a.price?.PriceM || 0;
                    const priceB = b.price?.PriceM || 0;
                    return priceB - priceA;
                });
                break;
            case 'diameter':
                this.filteredProducts.sort((a, b) => (a.Diameter || 0) - (b.Diameter || 0));
                break;
            case 'thickness':
                this.filteredProducts.sort((a, b) => (a.PipeWallThickness || 0) - (b.PipeWallThickness || 0));
                break;
            case 'stock':
                this.filteredProducts.sort((a, b) => {
                    const stockA = a.remnant?.InStockM || 0;
                    const stockB = b.remnant?.InStockM || 0;
                    return stockB - stockA;
                });
                break;
        }
    }

    renderProducts() {
        const grid = document.getElementById('productsGrid');
        if (!grid) return;
        
        if (this.filteredProducts.length === 0) {
            const emptyState = document.getElementById('emptyState');
            if (emptyState) emptyState.style.display = 'block';
            grid.innerHTML = '';
            this.updateProductsStats();
            return;
        }

        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.style.display = 'none';
        
        grid.innerHTML = this.filteredProducts.map(product => this.renderProductCard(product)).join('');
        this.updateProductsStats();
    }

    renderProductCard(product) {
        const priceInfo = this.calculatePrice(product, 1, 'meters');
        const stockStatus = this.getStockStatus(product);
        const canAdd = stockStatus !== 'none';
        const discount = priceInfo.discount > 0;
        
        const weight = product.Koef ? (product.Koef * 1000).toFixed(2) : 'н/д';
        
        return `
            <div class="product-card" onclick="app.showProductModal('${product.ID}')">
                <div class="product-header">
                    <div class="product-name">${this.formatName(product.Name)}</div>
                    <div class="product-price">${priceInfo.unitPrice.toLocaleString()} ₽/м</div>
                </div>
                ${discount ? `<div class="discount-badge">Скидка до ${(priceInfo.discount * 100).toFixed(0)}%</div>` : ''}
                <div class="product-specs">
                    <div>📏 Диаметр: ${product.Diameter} мм</div>
                    <div>🔧 Толщина: ${product.PipeWallThickness} мм</div>
                    <div>⚖️ Вес: ${weight} кг/м</div>
                    <div>📋 ГОСТ: ${product.Gost || 'Не указан'}</div>
                    <div>⚡ Сталь: ${product.SteelGrade || 'Не указана'}</div>
                    <div>🏭 Производитель: ${product.Manufacturer || 'Не указан'}</div>
                    <div>📦 Тип: ${product.ProductionType || 'Не указан'}</div>
                    <div>📍 Склад: ${product.stock.Stock || 'Не указан'}</div>
                </div>
                <div class="product-stock">
                    <span class="stock-status ${stockStatus}">
                        ${this.getStockText(product)}
                    </span>
                </div>
                <button class="add-to-cart" ${!canAdd ? 'disabled' : ''}
                    onclick="event.stopPropagation(); app.showProductModal('${product.ID}')">
                    ${canAdd ? '➕ Добавить в корзину' : '❌ Нет в наличии'}
                </button>
            </div>
        `;
    }

    formatName(name) {
        if (!name) return 'Без названия';
        return name.length > 80 ? name.substring(0, 80) + '...' : name;
    }

    getStockStatus(product) {
        const stockM = product.remnant.InStockM || 0;
        const stockT = product.remnant.InStockT || 0;
        
        if (stockM > 100 || stockT > 1) return 'available';
        if (stockM > 0 || stockT > 0) return 'low';
        return 'none';
    }

    getStockText(product) {
        const stockM = product.remnant.InStockM || 0;
        const stockT = product.remnant.InStockT || 0;
        
        if (stockM > 100 || stockT > 1) return `✅ В наличии: ${stockM.toFixed(1)} м`;
        if (stockM > 0 || stockT > 0) return `⚠️ Мало: ${stockM.toFixed(1)} м`;
        return '❌ Нет в наличии';
    }

    calculatePrice(product, quantity, unit) {
        const priceData = product.price;
        if (!priceData) return { unitPrice: 0, totalPrice: 0, discount: 0 };

        let basePrice, limit1, price1, limit2, price2;

        if (unit === 'meters') {
            basePrice = priceData.PriceM || 0;
            limit1 = priceData.PriceLimitM1 || 0;
            price1 = priceData.PriceM1 || basePrice;
            limit2 = priceData.PriceLimitM2 || 0;
            price2 = priceData.PriceM2 || price1;
        } else {
            basePrice = priceData.PriceT || 0;
            limit1 = priceData.PriceLimitT1 || 0;
            price1 = priceData.PriceT1 || basePrice;
            limit2 = priceData.PriceLimitT2 || 0;
            price2 = priceData.PriceT2 || price1;
        }

        let unitPrice = basePrice;
        let discount = 0;

        if (limit2 > 0 && quantity >= limit2 && price2 < basePrice) {
            unitPrice = price2;
            discount = (basePrice - price2) / basePrice;
        } else if (limit1 > 0 && quantity >= limit1 && price1 < basePrice) {
            unitPrice = price1;
            discount = (basePrice - price1) / basePrice;
        }

        const totalPrice = unitPrice * quantity;

        return {
            unitPrice,
            totalPrice,
            discount
        };
    }

    showProductModal(productId) {
        this.currentProduct = this.products.find(p => p.ID === productId);
        if (!this.currentProduct) return;

        const modal = document.getElementById('productModal');
        const title = document.getElementById('productModalTitle');
        const details = document.getElementById('productDetails');

        if (!modal || !title || !details) return;

        title.textContent = this.formatName(this.currentProduct.Name);
        details.innerHTML = this.renderProductDetails(this.currentProduct);

        this.resetQuantityInput();
        this.updatePriceDisplay();
        modal.style.display = 'block';
    }

    renderProductDetails(product) {
        const stockStatus = this.getStockStatus(product);
        const stockM = product.remnant.InStockM || 0;
        const stockT = product.remnant.InStockT || 0;
        const weight = product.Koef ? (product.Koef * 1000).toFixed(2) : 'н/д';
        
        return `
            <div class="product-name">${product.Name}</div>
            <div class="product-specs">
                <div><strong>📏 Диаметр:</strong> ${product.Diameter} мм</div>
                <div><strong>🔧 Толщина стенки:</strong> ${product.PipeWallThickness} мм</div>
                <div><strong>⚖️ Вес погонного метра:</strong> ${weight} кг/м</div>
                <div><strong>📋 ГОСТ:</strong> ${product.Gost || 'Не указан'}</div>
                <div><strong>⚡ Марка стали:</strong> ${product.SteelGrade || 'Не указана'}</div>
                <div><strong>🏭 Производитель:</strong> ${product.Manufacturer || 'Не указан'}</div>
                <div><strong>📦 Тип продукции:</strong> ${product.typeInfo.Type || 'Не указан'}</div>
                <div><strong>📍 Склад:</strong> ${product.stock.Stock || 'Не указан'}</div>
                <div><strong>🏢 Адрес склада:</strong> ${product.stock.Address || 'Не указан'}</div>
                <div><strong>📊 В наличии:</strong> ${stockM.toFixed(1)} м / ${stockT.toFixed(2)} т</div>
                <div><strong>📝 Форма поставки:</strong> ${product.FormOfLength || 'Не указана'}</div>
                <div><strong>🔧 Тип производства:</strong> ${product.ProductionType || 'Не указан'}</div>
            </div>
        `;
    }

    resetQuantityInput() {
        const quantityInput = document.getElementById('quantity');
        if (!quantityInput) return;
        
        quantityInput.value = '1';
        quantityInput.min = '0.01';
        quantityInput.step = '0.01';
        
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const metersTab = document.querySelector('.tab-btn[data-unit="meters"]');
        if (metersTab) metersTab.classList.add('active');
        this.currentUnit = 'meters';
    }

    updatePriceDisplay() {
        if (!this.currentProduct) return;

        const quantityInput = document.getElementById('quantity');
        const quantity = parseFloat(quantityInput?.value) || 0;
        const priceInfo = this.calculatePrice(this.currentProduct, quantity, this.currentUnit);
        
        const availableStock = this.currentUnit === 'meters' ? 
            (this.currentProduct.remnant.InStockM || 0) : 
            (this.currentProduct.remnant.InStockT || 0);

        const availableStockElement = document.getElementById('availableStock');
        const stockUnitElement = document.getElementById('stockUnit');
        if (availableStockElement) availableStockElement.textContent = availableStock.toFixed(2);
        if (stockUnitElement) stockUnitElement.textContent = this.currentUnit === 'meters' ? 'м' : 'т';

        const stockInfo = document.getElementById('stockInfo');
        if (stockInfo) {
            stockInfo.className = 'stock-info';
            
            if (quantity > availableStock) {
                stockInfo.classList.add('insufficient');
            } else if (availableStock < 10) {
                stockInfo.classList.add('low');
            }
        }

        const unitPriceElement = document.getElementById('unitPrice');
        const totalPriceElement = document.getElementById('totalPrice');
        const discountAmountElement = document.getElementById('discountAmount');
        
        if (unitPriceElement) unitPriceElement.textContent = `${priceInfo.unitPrice.toLocaleString()} ₽`;
        if (totalPriceElement) totalPriceElement.textContent = `${priceInfo.totalPrice.toLocaleString()} ₽`;
        if (discountAmountElement) {
            discountAmountElement.textContent = priceInfo.discount > 0 ? 
                `${(priceInfo.discount * 100).toFixed(0)}%` : '0%';
        }

        const addButton = document.getElementById('addToCart');
        if (addButton) {
            if (quantity <= 0 || quantity > availableStock) {
                addButton.disabled = true;
                addButton.innerHTML = quantity > availableStock ? 
                    '❌ Превышает доступное количество' : 
                    '❌ Введите количество';
            } else {
                addButton.disabled = false;
                addButton.innerHTML = '➕ Добавить в корзину';
            }
        }
    }

    addToCart() {
        if (!this.currentProduct) return;

        const quantityInput = document.getElementById('quantity');
        if (!quantityInput) return;
        
        const quantity = parseFloat(quantityInput.value);
        
        if (!quantity || quantity <= 0) {
            this.showNotification('Введите количество', 'error');
            return;
        }

        const availableStock = this.currentUnit === 'meters' ? 
            (this.currentProduct.remnant.InStockM || 0) : 
            (this.currentProduct.remnant.InStockT || 0);
        
        if (quantity > availableStock) {
            this.showNotification(`Недостаточно товара на складе. Доступно: ${availableStock.toFixed(2)} ${this.currentUnit === 'meters' ? 'м' : 'т'}`, 'error');
            return;
        }

        const priceInfo = this.calculatePrice(this.currentProduct, quantity, this.currentUnit);
        
        const cartItem = {
            id: this.currentProduct.ID,
            product: this.currentProduct,
            quantity,
            unit: this.currentUnit,
            unitPrice: priceInfo.unitPrice,
            totalPrice: priceInfo.totalPrice,
            discount: priceInfo.discount
        };

        const existingIndex = this.cart.findIndex(item => 
            item.id === cartItem.id && item.unit === cartItem.unit
        );

        if (existingIndex > -1) {
            const existingItem = this.cart[existingIndex];
            const newQuantity = existingItem.quantity + quantity;
            
            if (newQuantity > availableStock) {
                this.showNotification(`Общее количество превышает доступное на складе`, 'error');
                return;
            }
            
            existingItem.quantity = newQuantity;
            existingItem.totalPrice = existingItem.unitPrice * newQuantity;
        } else {
            this.cart.push(cartItem);
        }

        this.updateCartCount();
        this.closeModal('productModal');
        this.showNotification('🎉 Товар добавлен в корзину!', 'success');
    }

    showCart() {
        const modal = document.getElementById('cartModal');
        const itemsContainer = document.getElementById('cartItems');
        
        if (!modal || !itemsContainer) return;
        
        itemsContainer.innerHTML = this.renderCartItems();
        this.updateCartTotal();
        modal.style.display = 'block';
    }

    renderCartItems() {
        if (this.cart.length === 0) {
            return `
                <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                    <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">🛒</div>
                    <h3 style="margin-bottom: 0.5rem;">Корзина пуста</h3>
                    <p>Добавьте товары из каталога</p>
                </div>
            `;
        }

        return this.cart.map((item, index) => {
            const availableStock = item.unit === 'meters' ? 
                (item.product.remnant.InStockM || 0) : 
                (item.product.remnant.InStockT || 0);
            
            return `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${this.formatName(item.product.Name)}</div>
                        <div class="cart-item-details">
                            ${item.quantity} ${item.unit === 'meters' ? 'м' : 'т'} × ${item.unitPrice.toLocaleString()} ₽
                        </div>
                        <div class="cart-item-quantity">
                            <button class="quantity-control" onclick="app.updateCartItem(${index}, -1)" 
                                ${item.quantity <= 0.01 ? 'disabled' : ''}>-</button>
                            <span>${item.quantity}</span>
                            <button class="quantity-control" onclick="app.updateCartItem(${index}, 1)"
                                ${item.quantity >= availableStock ? 'disabled' : ''}>+</button>
                        </div>
                        ${item.discount > 0 ? 
                            `<div class="cart-item-discount">Скидка ${(item.discount * 100).toFixed(0)}%</div>` : 
                            ''
                        }
                        <button class="remove-item" onclick="app.removeFromCart(${index})">🗑️ Удалить</button>
                    </div>
                    <div class="cart-item-price">
                        <div class="cart-item-total">${item.totalPrice.toLocaleString()} ₽</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateCartItem(index, change) {
        const item = this.cart[index];
        const step = item.unit === 'meters' ? 1 : 0.1;
        const newQuantity = item.quantity + (change * step);
        
        if (newQuantity <= 0) {
            this.removeFromCart(index);
            return;
        }

        const availableStock = item.unit === 'meters' ? 
            (item.product.remnant.InStockM || 0) : 
            (item.product.remnant.InStockT || 0);
        
        if (newQuantity > availableStock) {
            this.showNotification(`Нельзя добавить больше ${availableStock.toFixed(2)} ${item.unit === 'meters' ? 'м' : 'т'}`, 'error');
            return;
        }

        item.quantity = newQuantity;
        item.totalPrice = item.unitPrice * newQuantity;
        this.updateCart();
    }

    removeFromCart(index) {
        this.cart.splice(index, 1);
        this.updateCart();
    }

    updateCart() {
        this.updateCartCount();
        this.showCart();
    }

    updateCartCount() {
        const count = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        const displayCount = count > 99 ? '99+' : Math.round(count);
        const cartCountElement = document.getElementById('cartCount');
        if (cartCountElement) {
            cartCountElement.textContent = displayCount;
            cartCountElement.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    updateCartTotal() {
        const subtotal = this.cart.reduce((sum, item) => sum + item.totalPrice, 0);
        const discount = this.cart.reduce((sum, item) => {
            const basePrice = item.unit === 'meters' ? 
                (item.product.price.PriceM || item.unitPrice) : 
                (item.product.price.PriceT || item.unitPrice);
            return sum + (basePrice * item.quantity - item.totalPrice);
        }, 0);
        const total = subtotal;

        const subtotalElement = document.getElementById('subtotal');
        const discountElement = document.getElementById('discount');
        const finalTotalElement = document.getElementById('finalTotal');
        
        if (subtotalElement) subtotalElement.textContent = `${subtotal.toLocaleString()} ₽`;
        if (discountElement) discountElement.textContent = `${discount.toLocaleString()} ₽`;
        if (finalTotalElement) finalTotalElement.textContent = `${total.toLocaleString()} ₽`;
    }

    generateCaptcha() {
        this.captcha.num1 = Math.floor(Math.random() * 20) + 1;
        this.captcha.num2 = Math.floor(Math.random() * 20) + 1;
        
        const operators = ['+', '-', '*'];
        this.captcha.operator = operators[Math.floor(Math.random() * operators.length)];
        
        switch (this.captcha.operator) {
            case '+':
                this.captcha.answer = this.captcha.num1 + this.captcha.num2;
                break;
            case '-':
                this.captcha.answer = this.captcha.num1 - this.captcha.num2;
                break;
            case '*':
                this.captcha.answer = this.captcha.num1 * this.captcha.num2;
                break;
        }
        
        const captchaQuestion = document.getElementById('captchaQuestion');
        if (captchaQuestion) {
            captchaQuestion.textContent = `Сколько будет ${this.captcha.num1} ${this.captcha.operator} ${this.captcha.num2}?`;
        }
        
        const captchaAnswer = document.getElementById('captchaAnswer');
        const captchaHint = document.getElementById('captchaHint');
        if (captchaAnswer) captchaAnswer.value = '';
        if (captchaHint) {
            captchaHint.textContent = '';
            captchaHint.className = 'captcha-hint';
        }
    }

    validateCaptcha(field) {
        const value = field.value.trim();
        const captchaHint = document.getElementById('captchaHint');
        
        if (!value) {
            field.style.borderColor = 'var(--border)';
            if (captchaHint) captchaHint.textContent = '';
            return false;
        }
        
        const userAnswer = parseInt(value);
        if (userAnswer === this.captcha.answer) {
            field.style.borderColor = 'var(--success)';
            if (captchaHint) {
                captchaHint.textContent = '✅ Верно!';
                captchaHint.className = 'captcha-hint captcha-success';
            }
            return true;
        } else {
            field.style.borderColor = 'var(--error)';
            if (captchaHint) {
                captchaHint.textContent = '❌ Неверный ответ';
                captchaHint.className = 'captcha-hint captcha-error';
            }
            return false;
        }
    }

    validateField(field) {
        const value = field.value.trim();
        
        if (field.id === 'customerName') {
            if (value.length < 2) {
                field.style.borderColor = 'var(--error)';
            } else {
                field.style.borderColor = 'var(--success)';
            }
        }
        
        if (field.id === 'customerPhone') {
            const phoneRegex = /^[\d\s\-\+\(\)]+$/;
            if (value && (!phoneRegex.test(value) || value.replace(/\D/g, '').length < 10)) {
                field.style.borderColor = 'var(--error)';
            } else if (value) {
                field.style.borderColor = 'var(--success)';
            } else {
                field.style.borderColor = 'var(--border)';
            }
        }
        
        if (field.id === 'customerEmail') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (value && !emailRegex.test(value)) {
                field.style.borderColor = 'var(--error)';
            } else if (value) {
                field.style.borderColor = 'var(--success)';
            } else {
                field.style.borderColor = 'var(--border)';
            }
        }
    }

    async submitOrder() {
        const customerName = document.getElementById('customerName')?.value.trim();
        const customerPhone = document.getElementById('customerPhone')?.value.trim();
        const customerEmail = document.getElementById('customerEmail')?.value.trim();
        const customerCompany = document.getElementById('customerCompany')?.value.trim();
        const deliveryAddress = document.getElementById('deliveryAddress')?.value.trim();
        const orderComment = document.getElementById('orderComment')?.value.trim();
        const captchaAnswer = document.getElementById('captchaAnswer')?.value.trim();
        
        // Валидация обязательных полей
        if (!customerName) {
            this.showNotification('Заполните поле ФИО', 'error');
            document.getElementById('customerName')?.focus();
            return;
        }

        if (!customerPhone) {
            this.showNotification('Заполните поле Телефон', 'error');
            document.getElementById('customerPhone')?.focus();
            return;
        }

        if (!customerEmail) {
            this.showNotification('Заполните поле Email', 'error');
            document.getElementById('customerEmail')?.focus();
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerEmail)) {
            this.showNotification('Введите корректный email адрес', 'error');
            document.getElementById('customerEmail')?.focus();
            return;
        }

        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        if (!phoneRegex.test(customerPhone) || customerPhone.replace(/\D/g, '').length < 10) {
            this.showNotification('Введите корректный номер телефона', 'error');
            document.getElementById('customerPhone')?.focus();
            return;
        }

        if (!captchaAnswer) {
            this.showNotification('Решите задачу для подтверждения', 'error');
            document.getElementById('captchaAnswer')?.focus();
            return;
        }

        const userAnswer = parseInt(captchaAnswer);
        if (userAnswer !== this.captcha.answer) {
            this.showNotification('Неверный ответ на задачу. Попробуйте снова.', 'error');
            document.getElementById('captchaAnswer')?.focus();
            this.generateCaptcha();
            return;
        }

        // Подготовка данных для отправки
        const orderData = {
            customer: {
                name: customerName,
                phone: customerPhone,
                email: customerEmail,
                company: customerCompany || ''
            },
            delivery: {
                address: deliveryAddress || ''
            },
            order: {
                items: this.cart,
                total: this.cart.reduce((sum, item) => sum + item.totalPrice, 0),
                comment: orderComment || ''
            },
            captcha: {
                question: `${this.captcha.num1} ${this.captcha.operator} ${this.captcha.num2}`,
                answer: this.captcha.answer.toString()
            }
        };

        try {
            this.showNotification('⏳ Оформляем заказ...', 'info');
            
            const submitBtn = document.getElementById('submitOrder');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '⏳ Обработка...';
            }

            // Реальный API вызов
            const response = await fetch(`${this.API_BASE_URL}/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            if (result.success) {
                const orderNumber = result.orderNumber || result.data?.orderNumber;
                this.showNotification(`🎉 Заказ №${orderNumber} успешно оформлен!`, 'success');
                
                // Очищаем корзину и форму
                this.cart = [];
                this.updateCartCount();
                this.closeModal('checkoutModal');
                this.resetOrderForm();
                
                setTimeout(() => {
                    this.showNotification(`📋 Номер вашего заказа: ${orderNumber}. Мы свяжемся с вами в ближайшее время!`, 'success');
                }, 2000);
                
            } else {
                throw new Error(result.error || 'Order creation failed');
            }
            
        } catch (error) {
            console.error('Order submission error:', error);
            
            let errorMessage = '❌ Ошибка при оформлении заказа';
            
            if (error.message.includes('Failed to fetch')) {
                errorMessage = '❌ Не удалось соединиться с сервером. Проверьте подключение к интернету.';
            } else if (error.message.includes('NetworkError')) {
                errorMessage = '❌ Проблемы с сетью. Проверьте подключение к интернету.';
            } else if (error.message.includes('429')) {
                errorMessage = '❌ Слишком много запросов. Пожалуйста, подождите немного.';
            } else if (error.message.includes('500')) {
                errorMessage = '❌ Внутренняя ошибка сервера. Пожалуйста, попробуйте позже.';
            }
            
            this.showNotification(errorMessage, 'error');
            console.error('Full error details:', error);
            
        } finally {
            const submitBtn = document.getElementById('submitOrder');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '✅ Подтвердить заказ';
            }
        }
    }

    resetOrderForm() {
        const formFields = [
            'customerName', 'customerPhone', 'customerEmail', 
            'customerCompany', 'deliveryAddress', 'orderComment', 'captchaAnswer'
        ];
        
        formFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = '';
                field.style.borderColor = 'var(--border)';
            }
        });
        
        const captchaHint = document.getElementById('captchaHint');
        if (captchaHint) {
            captchaHint.textContent = '';
            captchaHint.className = 'captcha-hint';
        }
        
        this.generateCaptcha();
    }

    async checkServerConnection() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                this.isServerConnected = true;
                console.log('✅ Сервер доступен');
                return true;
            } else {
                this.isServerConnected = false;
                console.warn('⚠️ Сервер отвечает с ошибкой:', response.status);
                return false;
            }
        } catch (error) {
            this.isServerConnected = false;
            console.error('❌ Сервер недоступен:', error.message);
            return false;
        }
    }

    async checkOrderStatus(orderNumber) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/orders/number/${orderNumber}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                return result.data;
            } else {
                throw new Error(result.error || 'Failed to fetch order status');
            }
            
        } catch (error) {
            console.error('Error checking order status:', error);
            throw error;
        }
    }

    applyFilters() {
        this.filteredProducts = this.products.filter(product => {
            const matchesStock = !this.filters.stock || product.stock.Stock === this.filters.stock;
            const matchesType = !this.filters.type || product.typeInfo.Type === this.filters.type;
            const matchesDiameter = !this.filters.diameter || product.Diameter == this.filters.diameter;
            const matchesThickness = !this.filters.thickness || product.PipeWallThickness == this.filters.thickness;
            const matchesGost = !this.filters.gost || product.Gost === this.filters.gost;
            const matchesSteel = !this.filters.steel || product.SteelGrade === this.filters.steel;
            const matchesSearch = !this.filters.search || 
                product.Name.toLowerCase().includes(this.filters.search.toLowerCase()) ||
                (product.Gost && product.Gost.toLowerCase().includes(this.filters.search.toLowerCase())) ||
                (product.SteelGrade && product.SteelGrade.toLowerCase().includes(this.filters.search.toLowerCase()));

            return matchesStock && matchesType && matchesDiameter && matchesThickness && 
                   matchesGost && matchesSteel && matchesSearch;
        });

        this.sortProducts();
        this.renderProducts();
    }

    clearFilters() {
        this.filters = {
            stock: '',
            type: '',
            diameter: '',
            thickness: '',
            gost: '',
            steel: '',
            search: ''
        };
        
        this.sortBy = 'name';

        const filterElements = [
            'stockFilter', 'typeFilter', 'diameterFilter', 
            'thicknessFilter', 'gostFilter', 'steelFilter', 'searchInput', 'sortBy'
        ];

        filterElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });

        const sortSelect = document.getElementById('sortBy');
        if (sortSelect) sortSelect.value = 'name';

        this.filteredProducts = [...this.products];
        this.sortProducts();
        this.renderProducts();
        this.showNotification('Фильтры очищены', 'success');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 1001;
            transform: translateX(400px);
            transition: transform 0.3s ease;
            background: ${type === 'success' ? '#38A169' : type === 'error' ? '#E53E3E' : type === 'warning' ? '#DD6B20' : '#3182CE'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.style.transform = 'translateX(0)', 100);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        const productsGrid = document.getElementById('productsGrid');
        if (loading) loading.style.display = show ? 'block' : 'none';
        if (productsGrid) productsGrid.style.display = show ? 'none' : 'grid';
    }

    hideLoading() {
        this.showLoading(false);
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    }

    bindEvents() {
        // Проверяем соединение с сервером при загрузке
        setTimeout(() => {
            this.checkServerConnection().then(isConnected => {
                if (!isConnected) {
                    console.warn('⚠️ Backend server is not available. Orders will not be saved.');
                    this.showNotification('⚠️ Сервер временно недоступен. Заказы будут сохранены локально.', 'warning');
                }
            });
        }, 2000);

        // Filter events
        const filterIds = [
            'stockFilter', 'typeFilter', 'diameterFilter', 
            'thicknessFilter', 'gostFilter', 'steelFilter'
        ];

        filterIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                if (id === 'diameterFilter' || id === 'thicknessFilter') {
                    element.addEventListener('input', (e) => {
                        if (e.target.value < 0) e.target.value = '';
                        this.filters[id.replace('Filter', '')] = e.target.value;
                        this.applyFilters();
                    });
                } else {
                    element.addEventListener('change', (e) => {
                        this.filters[id.replace('Filter', '')] = e.target.value;
                        this.applyFilters();
                    });
                }
            }
        });

        // Search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value;
                this.applyFilters();
            });
        }

        // Sorting
        const sortBy = document.getElementById('sortBy');
        if (sortBy) {
            sortBy.addEventListener('change', (e) => {
                this.sortBy = e.target.value;
                this.applyFilters();
            });
        }

        // Clear filters
        const clearFilters = document.getElementById('clearFilters');
        if (clearFilters) {
            clearFilters.addEventListener('click', () => {
                this.clearFilters();
            });
        }

        // Cart events
        const cartBtn = document.getElementById('cartBtn');
        if (cartBtn) {
            cartBtn.addEventListener('click', () => {
                this.showCart();
            });
        }

        // Modal events
        const modalCloseEvents = {
            'closeProductModal': 'productModal',
            'closeCartModal': 'cartModal',
            'closeCheckoutModal': 'checkoutModal'
        };

        Object.entries(modalCloseEvents).forEach(([buttonId, modalId]) => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', () => {
                    this.closeModal(modalId);
                });
            }
        });

        // Product modal events
        const cancelAdd = document.getElementById('cancelAdd');
        if (cancelAdd) {
            cancelAdd.addEventListener('click', () => {
                this.closeModal('productModal');
            });
        }

        const addToCart = document.getElementById('addToCart');
        if (addToCart) {
            addToCart.addEventListener('click', () => {
                this.addToCart();
            });
        }

        // Cart modal events
        const continueShopping = document.getElementById('continueShopping');
        if (continueShopping) {
            continueShopping.addEventListener('click', () => {
                this.closeModal('cartModal');
            });
        }

        const checkout = document.getElementById('checkout');
        if (checkout) {
            checkout.addEventListener('click', () => {
                if (this.cart.length === 0) {
                    this.showNotification('Корзина пуста', 'error');
                    return;
                }
                this.closeModal('cartModal');
                const checkoutModal = document.getElementById('checkoutModal');
                if (checkoutModal) {
                    checkoutModal.style.display = 'block';
                    setTimeout(() => {
                        this.generateCaptcha();
                    }, 100);
                }
            });
        }

        // Checkout modal events
        const backToCart = document.getElementById('backToCart');
        if (backToCart) {
            backToCart.addEventListener('click', () => {
                this.closeModal('checkoutModal');
                this.showCart();
            });
        }

        const submitOrder = document.getElementById('submitOrder');
        if (submitOrder) {
            submitOrder.addEventListener('click', () => {
                this.submitOrder();
            });
        }

        // Refresh captcha
        const refreshCaptcha = document.getElementById('refreshCaptcha');
        if (refreshCaptcha) {
            refreshCaptcha.addEventListener('click', () => {
                this.generateCaptcha();
            });
        }

        // Quantity tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentUnit = e.target.dataset.unit;
                const quantityUnit = document.getElementById('quantityUnit');
                if (quantityUnit) {
                    quantityUnit.textContent = this.currentUnit === 'meters' ? 'м' : 'т';
                }
                this.updatePriceDisplay();
            });
        });

        // Quantity input
        const quantityInput = document.getElementById('quantity');
        if (quantityInput) {
            quantityInput.addEventListener('input', () => {
                this.updatePriceDisplay();
            });
        }

        // Close modals on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Prevent negative input in number fields
        document.addEventListener('input', (e) => {
            if (e.target.type === 'number' && e.target.value < 0) {
                e.target.value = '';
            }
        });
    }
}

// Utility function to validate quantity input
function validateQuantity(input) {
    if (input.value < 0) {
        input.value = '';
    }
}

// Глобальные функции для отладки
window.TMKDebug = {
    checkOrderStatus: (orderNumber) => {
        if (window.app) {
            return window.app.checkOrderStatus(orderNumber);
        }
        return Promise.reject('App not loaded');
    },
    
    getCart: () => {
        return window.app ? window.app.cart : null;
    },
    
    clearCart: () => {
        if (window.app) {
            window.app.cart = [];
            window.app.updateCartCount();
            console.log('Cart cleared');
        }
    },
    
    checkServer: () => {
        if (window.app) {
            return window.app.checkServerConnection();
        }
        return Promise.reject('App not loaded');
    }
};

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TMKApp();
    window.app = app;
});

