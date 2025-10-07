class DatasetBuilder {
    constructor() {
        this.conversations = [];
        this.gameData = [];
        this.userPreferences = {};
        this.learningSessions = [];
        this.maxStorage = 50 * 1024 * 1024; // 50MB максимум
    }
    
    // Сбор данных из чата
    recordConversation(userMessage, aiResponse, context) {
        const conversation = {
            timestamp: Date.now(),
            user_message: userMessage,
            ai_response: aiResponse,
            context: context,
            metadata: {
                message_length: userMessage.length,
                response_length: aiResponse.length,
                topic: this.analyzeTopic(userMessage),
                sentiment: this.analyzeSentiment(userMessage)
            }
        };
        
        this.conversations.push(conversation);
        this.checkStorageLimit();
        
        console.log('💬 Записано сообщение в датасет');
    }
    
    // Сбор данных из игр
    recordGameData(gameType, performance, decisions, outcome) {
        const gameSession = {
            timestamp: Date.now(),
            game_type: gameType,
            performance: performance,
            decisions: decisions,
            outcome: outcome,
            learning_metrics: this.calculateLearningMetrics(performance)
        };
        
        this.gameData.push(gameSession);
        this.checkStorageLimit();
        
        console.log(`🎮 Записаны данные игры: ${gameType}`);
    }
    
    // Анализ топика сообщения
    analyzeTopic(message) {
        const topics = {
            programming: ['код', 'программир', 'алгоритм', 'python', 'javascript', 'функция', 'переменн'],
            science: ['наук', 'физик', 'хими', 'биолог', 'математ', 'теория'],
            learning: ['обуч', 'изуч', 'курс', 'учеб', 'заняти'],
            creative: ['идея', 'придумай', 'создай', 'креатив', 'творчеств'],
            technical: ['техник', 'компьютер', 'телефон', 'приложени', 'настройк']
        };
        
        const lowerMessage = message.toLowerCase();
        for (const [topic, keywords] of Object.entries(topics)) {
            if (keywords.some(keyword => lowerMessage.includes(keyword))) {
                return topic;
            }
        }
        
        return 'general';
    }
    
    // Простой анализ тональности
    analyzeSentiment(message) {
        const positiveWords = ['хорош', 'отличн', 'прекрасн', 'замечательн', 'спасиб', 'понрав', 'люб'];
        const negativeWords = ['плох', 'ужасн', 'отвратительн', 'ненавиж', 'грустн', 'зл', 'разочарован'];
        
        const lowerMessage = message.toLowerCase();
        let score = 0;
        
        positiveWords.forEach(word => {
            if (lowerMessage.includes(word)) score++;
        });
        
        negativeWords.forEach(word => {
            if (lowerMessage.includes(word)) score--;
        });
        
        return score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
    }
    
    // Метрики обучения из игровых данных
    calculateLearningMetrics(performance) {
        return {
            accuracy: performance.accuracy || 0,
            speed: performance.speed || 0,
            consistency: performance.consistency || 0,
            improvement_rate: this.calculateImprovementRate(performance),
            attention_span: this.calculateAttentionSpan(performance)
        };
    }
    
    calculateImprovementRate(performance) {
        // Рассчитываем скорость улучшения на основе исторических данных
        const recentSessions = this.gameData.slice(-5);
        if (recentSessions.length < 2) return 0;
        
        const improvements = recentSessions.map(session => 
            session.learning_metrics?.accuracy || 0
        );
        
        const totalImprovement = improvements[improvements.length - 1] - improvements[0];
        return totalImprovement / (improvements.length - 1);
    }
    
    calculateAttentionSpan(performance) {
        // Оцениваем продолжительность концентрации внимания
        return Math.min(100, (performance.focusTime || 0) / 60 * 100);
    }
    
    // Предобработка данных для обучения
    prepareTrainingData() {
        const trainingExamples = [];
        
        // Данные из чата
        this.conversations.forEach(conv => {
            trainingExamples.push({
                input: conv.user_message,
                output: conv.ai_response,
                context: conv.context,
                weight: this.calculateExampleWeight(conv)
            });
        });
        
        // Данные из игр
        this.gameData.forEach(game => {
            trainingExamples.push({
                input: `Игра: ${game.game_type}. Результат: ${game.outcome}`,
                output: this.generateGameLearningOutput(game),
                context: 'game_learning',
                weight: game.learning_metrics.accuracy
            });
        });
        
        return trainingExamples;
    }
    
    calculateExampleWeight(conversation) {
        let weight = 1.0;
        
        // Увеличиваем вес для длинных содержательных сообщений
        if (conversation.metadata.message_length > 50) weight *= 1.2;
        
        // Увеличиваем вес для технических/образовательных топиков
        if (['programming', 'science', 'technical'].includes(conversation.metadata.topic)) {
            weight *= 1.5;
        }
        
        // Уменьшаем вес для негативных взаимодействий
        if (conversation.metadata.sentiment === 'negative') {
            weight *= 0.7;
        }
        
        return Math.min(weight, 2.0); // Максимальный вес 2.0
    }
    
    generateGameLearningOutput(gameSession) {
        const metrics = gameSession.learning_metrics;
        return `На основе игры "${gameSession.game_type}" я улучшил: точность ${metrics.accuracy}%, скорость ${metrics.speed}%, концентрация ${metrics.attention_span}%`;
    }
    
    // Управление хранилищем
    checkStorageLimit() {
        const totalSize = this.getTotalDataSize();
        
        if (totalSize > this.maxStorage) {
            this.cleanupOldData();
        }
    }
    
    getTotalDataSize() {
        const dataString = JSON.stringify({
            conversations: this.conversations,
            gameData: this.gameData
        });
        
        return new Blob([dataString]).size;
    }
    
    cleanupOldData() {
        // Удаляем самые старые 20% данных
        const conversationsToKeep = Math.floor(this.conversations.length * 0.8);
        const gamesToKeep = Math.floor(this.gameData.length * 0.8);
        
        this.conversations = this.conversations.slice(-conversationsToKeep);
        this.gameData = this.gameData.slice(-gamesToKeep);
        
        console.log('🧹 Очищены устаревшие данные для экономии места');
    }
    
    // Экспорт данных
    exportDataset() {
        const dataset = {
            conversations: this.conversations,
            gameData: this.gameData,
            userPreferences: this.userPreferences,
            metadata: {
                total_examples: this.conversations.length + this.gameData.length,
                export_date: new Date().toISOString(),
                version: '1.0'
            }
        };
        
        const dataStr = JSON.stringify(dataset, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        return URL.createObjectURL(dataBlob);
    }
    
    // Импорт данных
    importDataset(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    
                    this.conversations = importedData.conversations || [];
                    this.gameData = importedData.gameData || [];
                    this.userPreferences = importedData.userPreferences || {};
                    
                    console.log('📥 Датасет успешно импортирован');
                    resolve(true);
                } catch (error) {
                    reject(new Error('Ошибка парсинга файла датасета'));
                }
            };
            
            reader.onerror = () => reject(new Error('Ошибка чтения файла'));
            reader.readAsText(file);
        });
    }
}

// Глобальный экземпляр
window.DatasetBuilder = DatasetBuilder;
