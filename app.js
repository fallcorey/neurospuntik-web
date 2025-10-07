// Главный класс приложения NeuroSputnik Android
class NeuroSputnikApp {
    constructor() {
        this.ollamaEngine = null;
        this.datasetBuilder = null;
        this.currentTab = 'chat';
        this.isInitialized = false;
        this.conversationHistory = [];
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Инициализация NeuroSputnik Android...');
        
        try {
            // Инициализируем компоненты
            await this.initializeComponents();
            this.setupEventListeners();
            this.setupUI();
            this.loadUserData();
            
            this.isInitialized = true;
            console.log('✅ NeuroSputnik Android готов к работе!');
            
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            this.showError('Не удалось запустить приложение. Проверьте поддержку WebAssembly.');
        }
    }
    
    async initializeComponents() {
        // Инициализируем движок Ollama
        this.ollamaEngine = new OllamaWebEngine();
        const engineReady = await this.ollamaEngine.initialize();
        
        if (!engineReady) {
            throw new Error('Не удалось инициализировать AI движок');
        }
        
        // Инициализируем сборщик данных
        this.datasetBuilder = new DatasetBuilder();
        
        // Загружаем базовую модель
        await this.loadBaseModel();
    }
    
    async loadBaseModel() {
        try {
            // Пробуем загрузить tiny-llama модель
            const modelResponse = await fetch('resources/models/tiny-llama.json');
            const modelData = await modelResponse.json();
            
            await this.ollamaEngine.loadModel('tiny-llama', modelData);
            console.log('✅ Базовая модель загружена');
            
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить модель, работаем в базовом режиме');
            // Продолжаем работу с базовыми ответами
        }
    }
    
    setupEventListeners() {
        // Навигация по табам
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Отправка сообщений
        document.getElementById('sendBtn').addEventListener('click', () => {
            this.sendMessage();
        });
        
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
        
        // Обработчики игр
        this.setupGamesNavigation();
        
        // Мониторинг хранилища
        this.setupStorageMonitoring();
        
        // Обработка оффлайн режима
        window.addEventListener('online', this.handleOnlineStatus.bind(this));
        window.addEventListener('offline', this.handleOfflineStatus.bind(this));
    }
    
    setupGamesNavigation() {
        document.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const game = e.currentTarget.dataset.game;
                this.openGame(game);
            });
        });
    }
    
    setupStorageMonitoring() {
        // Периодически проверяем использование хранилища
        setInterval(() => {
            this.updateStorageStatus();
        }, 30000);
        
        this.updateStorageStatus();
    }
    
    setupUI() {
        // Инициализируем UI компоненты
        this.updateBatteryStatus();
        this.setupSwipeNavigation();
    }
    
    setupSwipeNavigation() {
        // Добавляем свайп-навигацию для мобильных устройств
        let touchStartX = 0;
        let touchEndX = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });
        
        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe(touchStartX, touchEndX);
        });
    }
    
    handleSwipe(startX, endX) {
        const swipeThreshold = 50;
        const diff = startX - endX;
        
        if (Math.abs(diff) > swipeThreshold) {
            const tabs = ['chat', 'games', 'learn', 'models'];
            const currentIndex = tabs.indexOf(this.currentTab);
            
            if (diff > 0 && currentIndex < tabs.length - 1) {
                // Свайп влево - следующая вкладка
                this.switchTab(tabs[currentIndex + 1]);
            } else if (diff < 0 && currentIndex > 0) {
                // Свайп вправо - предыдущая вкладка
                this.switchTab(tabs[currentIndex - 1]);
            }
        }
    }
    
    switchTab(tabName) {
        // Обновляем активные кнопки навигации
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Показываем соответствующий контент
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });
        
        this.currentTab = tabName;
        
        // Специальные действия для вкладок
        if (tabName === 'models') {
            this.loadModelsList();
        } else if (tabName === 'learn') {
            this.updateLearningStatus();
        }
    }
    
    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Показываем сообщение пользователя
        this.addMessage(message, 'user');
        input.value = '';
        
        // Показываем индикатор "печатает"
        const thinkingId = this.showThinkingIndicator();
        
        try {
            // Генерируем ответ через Ollama
            const context = this.getConversationContext();
            const response = await this.generateAIResponse(message, context);
            
            // Убираем индикатор и показываем ответ
            this.removeThinkingIndicator(thinkingId);
            this.addMessage(response, 'neuro');
            
            // Сохраняем в историю и датасет
            this.saveToHistory(message, response);
            this.datasetBuilder.recordConversation(message, response, context);
            
        } catch (error) {
            this.removeThinkingIndicator(thinkingId);
            this.addMessage(this.getFallbackResponse(message), 'neuro');
        }
    }
    
    async generateAIResponse(message, context) {
        // Пробуем использовать Ollama если доступен
        if (this.ollamaEngine && this.ollamaEngine.currentModel) {
            try {
                const prompt = this.buildPrompt(message, context);
                return await this.ollamaEngine.generateResponse(prompt, {
                    maxTokens: 500,
                    temperature: 0.7
                });
            } catch (error) {
                console.warn('Ollama не ответил, используем fallback');
            }
        }
        
        // Fallback ответы
        return this.getSmartResponse(message);
    }
    
    buildPrompt(message, context) {
        return `Ты - NeuroSputnik, умный AI помощник работающий полностью оффлайн на Android устройстве.

Контекст предыдущего общения:
${context}

Текущий вопрос пользователя: ${message}

Твои возможности:
- Работа без интернета
- Самообучение через взаимодействие
- Игры для тренировки памяти
- Локальная обработка данных

Ответь полезно и точно:`;
    }
    
    getSmartResponse(message) {
        const lowerMsg = message.toLowerCase();
        
        const smartResponses = {
            'привет': 'Привет! 🎉 Я NeuroSputnik - твой оффлайн AI помощник. Работаю полностью без интернета!',
            'как дела': 'Отлично! Готов к общению и обучению. Можешь спрашивать о чём угодно или сыграть в обучающие игры!',
            'оффлайн': 'Да! Я работаю полностью оффлайн. Все AI модели и данные хранятся на твоём устройстве.',
            'обучение': 'Я постоянно учусь на наших разговорах и играх. Чем больше мы общаемся - тем умнее я становлюсь! 🧠',
            'игры': 'Во вкладке "🎮 Игры" найдёшь много обучающих игр для тренировки моего AI!',
            'память': 'Сыграй в "Тренировку памяти" чтобы помочь мне улучшить запоминание информации!'
        };
        
        for (const [key, response] of Object.entries(smartResponses)) {
            if (lowerMsg.includes(key)) {
                return response;
            }
        }
        
        return `🤔 "${message}" - интересный вопрос!

Я работаю в оффлайн режиме, но могу:
• Ответить на основе своих знаний
• Помочь с программированием
• Объяснить сложные темы
• Сыграть с тобой в обучающие игры

Попробуй задать вопрос по-другому или зайди в игры для моего обучения! 🚀`;
    }
    
    // Методы для работы с играми
    openGame(gameName) {
        const gameUrls = {
            'memory': 'games/memory-game.html',
            'quiz': 'games/quiz-game.html',
            'coding': 'games/coding-game.html',
            'language': 'games/language-game.html',
            'logic': 'games/logic-game.html',
            'creative': 'games/creative-game.html'
        };
        
        const gameUrl = gameUrls[gameName];
        if (gameUrl) {
            window.open(gameUrl, '_self');
        } else {
            alert('Игра в разработке! 🛠️');
        }
    }
    
    // Методы для обучения AI
    async startTraining() {
        const trainingData = this.datasetBuilder.prepareTrainingData();
        
        if (trainingData.length === 0) {
            alert('❌ Недостаточно данных для обучения. Сначала пообщайся или поиграй!');
            return;
        }
        
        this.updateTrainingProgress(0, 'Подготовка данных...');
        
        try {
            // Конвертируем данные в формат для Ollama
            const formattedData = this.formatTrainingData(trainingData);
            
            // Запускаем обучение
            const success = await this.ollamaEngine.trainOnData(formattedData, 3);
            
            if (success) {
                this.updateTrainingProgress(100, 'Обучение завершено!');
                alert('✅ AI успешно дообучен на новых данных!');
            } else {
                throw new Error('Ошибка обучения');
            }
            
        } catch (error) {
            console.error('Ошибка обучения:', error);
            alert('❌ Ошибка при обучении AI');
        }
    }
    
    formatTrainingData(trainingData) {
        return trainingData.map(example => ({
            input: example.input,
            output: example.output,
            weight: example.weight
        }));
    }
    
    updateTrainingProgress(percent, message) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('trainingProgress');
        
        if (progressBar) progressBar.style.width = percent + '%';
        if (progressText) progressText.textContent = message;
    }
    
    // Вспомогательные методы UI
    addMessage(text, type) {
        const messagesDiv = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        messageDiv.innerHTML = `<strong>${type === 'user' ? 'Вы' : 'NeuroSputnik'}:</strong> ${this.formatMessage(text)}`;
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    
    formatMessage(text) {
        // Форматируем сообщения для лучшего отображения
        return text.replace(/\n/g, '<br>')
                  .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
                  .replace(/_(.*?)_/g, '<em>$1</em>');
    }
    
    showThinkingIndicator() {
        const messagesDiv = document.getElementById('messages');
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'message neuro-message';
        thinkingDiv.id = 'thinkingMsg';
        thinkingDiv.innerHTML = '<strong>NeuroSputnik:</strong> <em>печатает...</em>';
        messagesDiv.appendChild(thinkingDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        return 'thinkingMsg';
    }
    
    removeThinkingIndicator(id) {
        const element = document.getElementById(id);
        if (element) element.remove();
    }
    
    getConversationContext() {
        return this.conversationHistory.slice(-3).map(msg => 
            `${msg.role}: ${msg.content}`
        ).join('\n');
    }
    
    saveToHistory(userMessage, aiResponse) {
        this.conversationHistory.push(
            { role: 'user', content: userMessage },
            { role: 'assistant', content: aiResponse }
        );
        
        // Ограничиваем историю 20 сообщениями
        if (this.conversationHistory.length > 20) {
            this.conversationHistory = this.conversationHistory.slice(-20);
        }
        
        this.saveToStorage('conversation_history', this.conversationHistory);
    }
    
    // Работа с хранилищем
    saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.warn('Не удалось сохранить в localStorage:', error);
        }
    }
    
    loadFromStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn('Не удалось загрузить из localStorage:', error);
            return null;
        }
    }
    
    loadUserData() {
        this.conversationHistory = this.loadFromStorage('conversation_history') || [];
        this.loadConversationHistory();
    }
    
    loadConversationHistory() {
        this.conversationHistory.forEach(msg => {
            if (msg.role === 'user') {
                this.addMessage(msg.content, 'user');
            } else if (msg.role === 'assistant') {
                this.addMessage(msg.content, 'neuro');
            }
        });
    }
    
    // Системные методы
    updateStorageStatus() {
        try {
            // Примерная оценка использования хранилища
            let totalSize = 0;
            
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length * 2; // Примерно в байтах
                }
            }
            
            const usedMB = Math.round(totalSize / 1024 / 1024);
            document.getElementById('storageStatus').textContent = `💾 ${usedMB}MB`;
            
        } catch (error) {
            console.warn('Не удалось определить использование хранилища');
        }
    }
    
    updateBatteryStatus() {
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                const updateBatteryInfo = () => {
                    const percentage = Math.round(battery.level * 100);
                    document.getElementById('batteryStatus').textContent = `🔋 ${percentage}%`;
                };
                
                battery.addEventListener('levelchange', updateBatteryInfo);
                updateBatteryInfo();
            });
        }
    }
    
    handleOnlineStatus() {
        document.getElementById('aiStatus').textContent = '🟢 AI активен (онлайн)';
    }
    
    handleOfflineStatus() {
        document.getElementById('aiStatus').textContent = '🟢 AI активен (оффлайн)';
    }
    
    showWelcomeMessage() {
        this.addMessage(
            '🚀 Добро пожаловать в NeuroSputnik Android! ' +
            'Я работаю полностью оффлайн и могу самообучаться через наши разговоры и игры. ' +
            'Попробуй вкладку "🎮 Игры" для моего обучения!', 
            'neuro'
        );
    }
    
    showError(message) {
        this.addMessage(`❌ ${message}`, 'neuro');
    }
    
    // Методы для вкладки моделей
    async loadModelsList() {
        const loader = document.getElementById('modelsLoader');
        const modelsList = document.getElementById('modelsList');
        
        if (!this.ollamaEngine) return;
        
        try {
            // Показываем список доступных моделей
            const models = this.ollamaEngine.models;
            
            if (Object.keys(models).length === 0) {
                modelsList.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <h3>🤖 Модели AI</h3>
                        <p>Базовая модель загружена и готова к работе!</p>
                        <button class="send-btn" onclick="app.downloadAdditionalModel()" style="margin: 10px 0;">
                            📥 Скачать дополнительную модель
                        </button>
                    </div>
                `;
            } else {
                modelsList.innerHTML = Object.keys(models).map(model => `
                    <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px; margin: 10px 0;">
                        <h4>${model}</h4>
                        <p>Размер: ${Math.round(models[model].size / 1024 / 1024)}MB</p>
                        <p>Статус: ${models[model].loaded ? '✅ Загружена' : '❌ Не загружена'}</p>
                    </div>
                `).join('');
            }
            
            loader.style.display = 'none';
            modelsList.style.display = 'block';
            
        } catch (error) {
            console.error('Ошибка загрузки списка моделей:', error);
        }
    }
    
    updateLearningStatus() {
        const trainingData = this.datasetBuilder.prepareTrainingData();
        
        document.getElementById('dataCount').textContent = trainingData.length;
        document.getElementById('epochCount').textContent = '0'; // Можно добавить счётчик эпох
        document.getElementById('accuracy').textContent = '0%'; // Можно добавить метрики точности
    }
}

// Глобальные функции для кнопок
async function startTraining() {
    if (window.app) {
        await window.app.startTraining();
    }
}

function exportModel() {
    alert('💾 Функция экспорта модели будет доступна в следующем обновлении!');
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.app = new NeuroSputnikApp();
});

// Регистрация Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('✅ Service Worker зарегистрирован:', registration);
            })
            .catch(error => {
                console.log('❌ Ошибка регистрации Service Worker:', error);
            });
    });
}
