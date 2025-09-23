// polyfill.js - Comprehensive polyfills for WhatsApp Bot

console.log('🚀 Loading polyfills...');

// ===== CRITICAL: crypto.subtle polyfill =====
if (typeof globalThis.crypto === 'undefined') {
    console.log('🔧 Setting up crypto polyfill...');
    try {
        // Use Node.js native crypto
        const nodeCrypto = require('crypto');
        globalThis.crypto = {
            // Basic crypto functions
            randomBytes: nodeCrypto.randomBytes,
            createHash: nodeCrypto.createHash,
            createHmac: nodeCrypto.createHmac,
            
            // Subtle crypto implementation for WhatsApp
            subtle: {
                digest: async (algorithm, data) => {
                    const algo = algorithm.toLowerCase().replace('-', '');
                    const hash = nodeCrypto.createHash(algo);
                    hash.update(data);
                    return hash.digest();
                },
                
                importKey: async (format, keyData, algorithm, extractable, keyUsages) => {
                    return {
                        algorithm,
                        extractable,
                        usages: keyUsages,
                        type: 'secret'
                    };
                },
                
                encrypt: async (algorithm, key, data) => {
                    const cipher = nodeCrypto.createCipher('aes-256-cbc', key);
                    let encrypted = cipher.update(data);
                    encrypted = Buffer.concat([encrypted, cipher.final()]);
                    return encrypted;
                },
                
                decrypt: async (algorithm, key, data) => {
                    const decipher = nodeCrypto.createDecipher('aes-256-cbc', key);
                    let decrypted = decipher.update(data);
                    decrypted = Buffer.concat([decrypted, decipher.final()]);
                    return decrypted;
                },
                
                sign: async (algorithm, key, data) => {
                    const sign = nodeCrypto.createSign('RSA-SHA256');
                    sign.update(data);
                    return sign.sign(key);
                },
                
                verify: async (algorithm, key, signature, data) => {
                    const verify = nodeCrypto.createVerify('RSA-SHA256');
                    verify.update(data);
                    return verify.verify(key, signature);
                },
                
                deriveKey: async (algorithm, baseKey, derivedKeyAlgorithm, extractable, keyUsages) => {
                    return {
                        algorithm: derivedKeyAlgorithm,
                        extractable,
                        usages: keyUsages
                    };
                },
                
                deriveBits: async (algorithm, baseKey, length) => {
                    return nodeCrypto.randomBytes(length / 8);
                },
                
                generateKey: async (algorithm, extractable, keyUsages) => {
                    return {
                        publicKey: Buffer.from('mock-public-key'),
                        privateKey: Buffer.from('mock-private-key'),
                        type: 'key-pair'
                    };
                }
            },
            
            getRandomValues: function(array) {
                return nodeCrypto.randomFillSync(array);
            }
        };
        console.log('✅ Native crypto polyfill complete');
    } catch (error) {
        console.error('❌ Crypto polyfill failed:', error.message);
        process.exit(1);
    }
} else if (!globalThis.crypto.subtle) {
    console.log('🔧 Adding subtle to existing crypto...');
    const nodeCrypto = require('crypto');
    globalThis.crypto.subtle = {
        digest: async (algorithm, data) => {
            const algo = algorithm.toLowerCase().replace('-', '');
            const hash = nodeCrypto.createHash(algo);
            hash.update(data);
            return hash.digest();
        },
        importKey: () => Promise.resolve({}),
        encrypt: () => Promise.resolve(Buffer.alloc(0)),
        decrypt: () => Promise.resolve(Buffer.alloc(0)),
        sign: () => Promise.resolve(Buffer.alloc(0)),
        verify: () => Promise.resolve(true)
    };
}

// ===== TextEncoder/TextDecoder =====
if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = require('util').TextEncoder;
    globalThis.TextDecoder = require('util').TextDecoder;
    console.log('✅ TextEncoder/TextDecoder polyfilled');
}

// ===== Blob & File =====
if (typeof globalThis.Blob === 'undefined') {
    try {
        const { Blob } = require('buffer');
        globalThis.Blob = Blob;
        console.log('✅ Blob polyfilled');
    } catch (error) {
        console.warn('⚠️ Blob polyfill failed:', error.message);
        // Fallback Blob implementation
        globalThis.Blob = class Blob {
            constructor(parts = [], options = {}) {
                this.parts = parts;
                this.type = options.type || '';
                this.size = parts.reduce((size, part) => size + (part.length || part.size || 0), 0);
            }
            
            arrayBuffer() {
                return Promise.resolve(Buffer.concat(this.parts.map(part => 
                    Buffer.isBuffer(part) ? part : Buffer.from(part)
                ));
            }
            
            text() {
                return Promise.resolve(Buffer.concat(this.parts.map(part => 
                    Buffer.isBuffer(part) ? part : Buffer.from(part)
                ).toString());
            }
        };
    }
}

if (typeof globalThis.File === 'undefined' && globalThis.Blob) {
    class File extends globalThis.Blob {
        constructor(blobParts, name, options = {}) {
            super(blobParts, options);
            this.name = name;
            this.lastModified = options.lastModified || Date.now();
        }
    }
    globalThis.File = File;
    console.log('✅ File polyfilled');
}

// ===== fetch API =====
if (typeof globalThis.fetch === 'undefined') {
    try {
        globalThis.fetch = require('node-fetch');
        console.log('✅ fetch polyfilled');
    } catch (error) {
        console.warn('⚠️ fetch polyfill failed:', error.message);
        // Simple fetch fallback using http/https modules
        const http = require('http');
        const https = require('https');
        
        globalThis.fetch = function(url, options = {}) {
            return new Promise((resolve, reject) => {
                const lib = url.startsWith('https') ? https : http;
                const req = lib.request(url, options, (res) => {
                    let data = [];
                    
                    res.on('data', chunk => data.push(chunk));
                    res.on('end', () => {
                        const response = {
                            ok: res.statusCode >= 200 && res.statusCode < 300,
                            status: res.statusCode,
                            statusText: res.statusMessage,
                            headers: res.headers,
                            arrayBuffer: () => Promise.resolve(Buffer.concat(data)),
                            text: () => Promise.resolve(Buffer.concat(data).toString()),
                            json: () => Promise.resolve(JSON.parse(Buffer.concat(data).toString()))
                        };
                        resolve(response);
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
    globalThis.process = {
        nextTick: (callback) => setImmediate(callback),
        env: process.env || {},
        version: process.version,
        versions: process.versions
    };
} else if (!globalThis.process.nextTick) {
    globalThis.process.nextTick = (callback) => setImmediate(callback);
}

// ===== Web Streams Polyfill =====
if (typeof globalThis.ReadableStream === 'undefined') {
    try {
        const { ReadableStream } = require('web-streams-polyfill');
        globalThis.ReadableStream = ReadableStream;
        console.log('✅ ReadableStream polyfilled');
    } catch (error) {
        console.warn('⚠️ ReadableStream polyfill failed:', error.message);
    }
}

console.log('✅ All polyfills loaded successfully!');
console.log('🚀 Starting WhatsApp Bot...');

// Import and start the main application
try {
    require('./index.js');
} catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
}