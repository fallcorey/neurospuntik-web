// WebAssembly обертка для Ollama
class OllamaWebEngine {
    constructor() {
        this.isInitialized = false;
        this.isRunning = false;
        this.currentModel = null;
        this.models = {};
        this.memoryLimit = 512 * 1024 * 1024; // 512MB для мобильных устройств
    }

    async initialize() {
        console.log('🔄 Инициализация WebAssembly Ollama...');
        
        try {
            // Загружаем WebAssembly модуль
            if (!WebAssembly.instantiateStreaming) {
                console.log('⚠️ WebAssembly streaming не поддерживается');
                return false;
            }

            // Инициализируем WASM модуль Ollama
            const wasmResponse = await fetch('resources/ollama/ollama.wasm');
            const wasmBytes = await wasmResponse.arrayBuffer();
            const wasmModule = await WebAssembly.instantiate(wasmBytes, {
                env: {
                    memory: new WebAssembly.Memory({ initial: 256 }),
                    abort: () => console.log('WASM abort')
                }
            });

            this.instance = wasmModule.instance;
            this.isInitialized = true;
            
            console.log('✅ WebAssembly Ollama инициализирован');
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка инициализации WebAssembly:', error);
            return false;
        }
    }

    async loadModel(modelName, modelData) {
        if (!this.isInitialized) {
            throw new Error('Движок не инициализирован');
        }

        console.log(`📦 Загружаем модель: ${modelName}`);
        
        try {
            // Загружаем модель в память WASM
            const modelBuffer = new Uint8Array(modelData);
            const modelPtr = this._allocateMemory(modelBuffer.length);
            
            // Копируем данные модели в WASM память
            const wasmMemory = new Uint8Array(this.instance.exports.memory.buffer);
            wasmMemory.set(modelBuffer, modelPtr);
            
            // Инициализируем модель в Ollama
            const result = this.instance.exports.load_model(
                modelPtr, 
                modelBuffer.length,
                this.memoryLimit
            );
            
            if (result === 0) {
                this.currentModel = modelName;
                this.models[modelName] = {
                    loaded: true,
                    size: modelBuffer.length
                };
                
                console.log(`✅ Модель ${modelName} загружена`);
                return true;
            } else {
                throw new Error(`Ошибка загрузки модели: код ${result}`);
            }
            
        } catch (error) {
            console.error(`❌ Ошибка загрузки модели ${modelName}:`, error);
            return false;
        }
    }

    async generateResponse(prompt, options = {}) {
        if (!this.currentModel) {
            throw new Error('Модель не загружена');
        }

        const {
            maxTokens = 500,
            temperature = 0.7,
            topP = 0.9
        } = options;

        console.log('🤖 Генерируем ответ...');

        try {
            // Подготавливаем промпт
            const promptBuffer = new TextEncoder().encode(prompt);
            const promptPtr = this._allocateMemory(promptBuffer.length);
            
            const wasmMemory = new Uint8Array(this.instance.exports.memory.buffer);
            wasmMemory.set(promptBuffer, promptPtr);

            // Генерируем ответ
            const responsePtr = this.instance.exports.generate_response(
                promptPtr,
                promptBuffer.length,
                maxTokens,
                temperature,
                topP
            );

            if (responsePtr === 0) {
                throw new Error('Ошибка генерации ответа');
            }

            // Читаем ответ из WASM памяти
            const response = this._readStringFromMemory(responsePtr);
            
            // Освобождаем память
            this.instance.exports.free_memory(responsePtr);
            this.instance.exports.free_memory(promptPtr);

            return response;

        } catch (error) {
            console.error('❌ Ошибка генерации:', error);
            throw error;
        }
    }

    async trainOnData(trainingData, epochs = 1) {
        if (!this.currentModel) {
            throw new Error('Модель не загружена');
        }

        console.log(`🎯 Начинаем обучение на ${trainingData.length} примерах`);

        try {
            const trainingJson = JSON.stringify(trainingData);
            const trainingBuffer = new TextEncoder().encode(trainingJson);
            const trainingPtr = this._allocateMemory(trainingBuffer.length);

            const wasmMemory = new Uint8Array(this.instance.exports.memory.buffer);
            wasmMemory.set(trainingBuffer, trainingPtr);

            const result = this.instance.exports.train_model(
                trainingPtr,
                trainingBuffer.length,
                epochs
            );

            this.instance.exports.free_memory(trainingPtr);

            if (result === 0) {
                console.log('✅ Обучение завершено успешно');
                return true;
            } else {
                throw new Error(`Ошибка обучения: код ${result}`);
            }

        } catch (error) {
            console.error('❌ Ошибка обучения:', error);
            return false;
        }
    }

    // Вспомогательные методы
    _allocateMemory(size) {
        return this.instance.exports.allocate_memory(size);
    }

    _readStringFromMemory(ptr) {
        const memory = new Uint8Array(this.instance.exports.memory.buffer);
        let length = 0;
        
        // Находим длину строки (null-terminated)
        while (memory[ptr + length] !== 0) {
            length++;
        }
        
        // Читаем строку
        const stringBytes = memory.slice(ptr, ptr + length);
        return new TextDecoder().decode(stringBytes);
    }

    getMemoryUsage() {
        if (!this.isInitialized) return 0;
        
        const used = this.instance.exports.get_used_memory();
        const total = this.instance.exports.get_total_memory();
        
        return {
            used: Math.round(used / 1024 / 1024),
            total: Math.round(total / 1024 / 1024),
            percentage: Math.round((used / total) * 100)
        };
    }

    async saveModel(modelName) {
        if (!this.currentModel) {
            throw new Error('Модель не загружена');
        }

        console.log(`💾 Сохраняем модель: ${modelName}`);

        try {
            const modelSize = this.instance.exports.get_model_size();
            const modelPtr = this.instance.exports.export_model();
            
            const wasmMemory = new Uint8Array(this.instance.exports.memory.buffer);
            const modelData = wasmMemory.slice(modelPtr, modelPtr + modelSize);
            
            // Сохраняем в IndexedDB
            await this._saveToIndexedDB(modelName, modelData);
            
            this.instance.exports.free_memory(modelPtr);
            
            console.log(`✅ Модель ${modelName} сохранена`);
            return true;

        } catch (error) {
            console.error('❌ Ошибка сохранения модели:', error);
            return false;
        }
    }

    async _saveToIndexedDB(key, data) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('NeuroSputnikModels', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['models'], 'readwrite');
                const store = transaction.objectStore('models');
                
                const putRequest = store.put(data, key);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                db.createObjectStore('models');
            };
        });
    }
}

// Экспортируем глобально для использования
window.OllamaWebEngine = OllamaWebEngine;
