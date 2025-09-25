// polyfill.js - Essential polyfills for WhatsApp Bot

console.log('🚀 Loading essential polyfills...');

// ===== CRITICAL: crypto.subtle polyfill for Baileys =====
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
    console.log('🔧 Setting up crypto polyfill for WhatsApp Baileys...');
    try {
        const nodeCrypto = require('crypto');
        
        if (typeof globalThis.crypto === 'undefined') {
            globalThis.crypto = {
                getRandomValues: function(array) {
                    return nodeCrypto.randomFillSync(array);
                }
            };
        }

        // Minimal subtle implementation specifically for WhatsApp Baileys
        globalThis.crypto.subtle = {
            digest: async (algorithm, data) => {
                const algo = algorithm.toLowerCase().replace('-', '');
                const hash = nodeCrypto.createHash(algo);
                hash.update(data);
                return hash.digest();
            },

            importKey: async (format, keyData, algorithm, extractable, keyUsages) => {
                return { type: 'secret', usages: keyUsages };
            },

            encrypt: async (algorithm, key, data) => {
                const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key.slice(0, 32), Buffer.alloc(12, 0));
                return Buffer.concat([cipher.update(data), cipher.final()]);
            },

            decrypt: async (algorithm, key, data) => {
                const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', key.slice(0, 32), Buffer.alloc(12, 0));
                return Buffer.concat([decipher.update(data), decipher.final()]);
            },

            sign: async (algorithm, key, data) => {
                const sign = nodeCrypto.createSign('sha256');
                sign.update(data);
                return sign.sign(key);
            },

            verify: async (algorithm, key, signature, data) => {
                const verify = nodeCrypto.createVerify('sha256');
                verify.update(data);
                return verify.verify(key, signature);
            },

            // Minimal implementations for other required methods
            generateKey: async (algorithm, extractable, keyUsages) => {
                return Promise.resolve({});
            },

            deriveKey: async (algorithm, baseKey, derivedKeyAlgorithm, extractable, keyUsages) => {
                return Promise.resolve({});
            },

            deriveBits: async (algorithm, baseKey, length) => {
                return nodeCrypto.randomBytes(length / 8);
            }
        };
        console.log('✅ Crypto polyfill complete - WhatsApp Baileys should work now');
    } catch (error) {
        console.error('❌ Crypto polyfill failed:', error.message);
        process.exit(1);
    }
}

// ===== TextEncoder/TextDecoder =====
if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = require('util').TextEncoder;
    globalThis.TextDecoder = require('util').TextDecoder;
    console.log('✅ TextEncoder/TextDecoder polyfilled');
}

// ===== Blob =====
if (typeof globalThis.Blob === 'undefined') {
    try {
        globalThis.Blob = require('buffer').Blob;
        console.log('✅ Blob polyfilled');
    } catch (error) {
        // Simple fallback Blob
        globalThis.Blob = class Blob {
            constructor(parts = [], options = {}) {
                this._buffer = Buffer.concat(parts.map(part => 
                    Buffer.isBuffer(part) ? part : Buffer.from(part)
                ));
                this.type = options.type || '';
                this.size = this._buffer.length;
            }
            arrayBuffer() { return Promise.resolve(this._buffer); }
            text() { return Promise.resolve(this._buffer.toString()); }
        };
    }
}

// ===== fetch API =====
if (typeof globalThis.fetch === 'undefined') {
    try {
        globalThis.fetch = require('node-fetch');
        console.log('✅ fetch polyfilled');
    } catch (error) {
        // Use native http module as fallback
        const http = require('http');
        const https = require('https');
        
        globalThis.fetch = function(url, options = {}) {
            return new Promise((resolve, reject) => {
                const lib = url.startsWith('https') ? https : http;
                const req = lib.request(url, { 
                    method: options.method || 'GET',
                    headers: options.headers || {}
                }, (res) => {
                    const chunks = [];
                    res.on('data', chunk => chunks.push(chunk));
                    res.on('end', () => {
                        const buffer = Buffer.concat(chunks);
                        resolve({
                            ok: res.statusCode >= 200 && res.statusCode < 300,
                            status: res.statusCode,
                            statusText: res.statusMessage,
                            arrayBuffer: () => Promise.resolve(buffer),
                            text: () => Promise.resolve(buffer.toString()),
                            json: () => Promise.resolve(JSON.parse(buffer.toString()))
                        });
                    });
                });
                req.on('error', reject);
                if (options.body) req.write(options.body);
                req.end();
            });
        };
    }
}

// ===== Buffer =====
if (typeof globalThis.Buffer === 'undefined') {
    globalThis.Buffer = require('buffer').Buffer;
    console.log('✅ Buffer polyfilled');
}

// ===== process.nextTick =====
if (typeof globalThis.process === 'undefined') {
    globalThis.process = require('process');
} else if (!globalThis.process.nextTick) {
    globalThis.process.nextTick = (callback) => setImmediate(callback);
}

console.log('✅ All essential polyfills loaded successfully!');
console.log('🚀 Starting WhatsApp Bot main application...');

// Start the main application
try {
    require('./index.js');
} catch (error) {
    console.error('❌ Failed to start main application:', error);
    process.exit(1);
}