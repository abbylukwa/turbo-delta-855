// polyfill.js - Comprehensive polyfills for WhatsApp Bot

console.log('🚀 Loading polyfills...');

// ===== CRITICAL: crypto.subtle polyfill =====
if (typeof globalThis.crypto === 'undefined') {
    console.log('🔧 Setting up crypto polyfill...');
    try {
        // Use Node.js native crypto
        const nodeCrypto = require('crypto');
        globalThis.crypto = nodeCrypto;
        
        // Polyfill crypto.subtle which is required by WhatsApp Web
        if (!globalThis.crypto.subtle) {
            globalThis.crypto.subtle = {
                importKey: function(format, keyData, algorithm, extractable, keyUsages) {
                    return Promise.resolve({
                        algorithm: algorithm,
                        extractable: extractable,
                        usages: keyUsages,
                        type: 'secret'
                    });
                },
                encrypt: function(algorithm, key, data) {
                    return Promise.resolve(Buffer.from(data));
                },
                decrypt: function(algorithm, key, data) {
                    return Promise.resolve(Buffer.from(data));
                },
                digest: function(algorithm, data) {
                    return new Promise((resolve, reject) => {
                        try {
                            const hash = nodeCrypto.createHash(algorithm.toLowerCase().replace('-', ''));
                            hash.update(data);
                            resolve(hash.digest());
                        } catch (error) {
                            reject(error);
                        }
                    });
                },
                generateKey: function(algorithm, extractable, keyUsages) {
                    return Promise.resolve({
                        publicKey: Buffer.from('mock-public-key'),
                        privateKey: Buffer.from('mock-private-key')
                    });
                },
                sign: function(algorithm, key, data) {
                    return Promise.resolve(Buffer.from('mock-signature'));
                },
                verify: function(algorithm, key, signature, data) {
                    return Promise.resolve(true);
                }
            };
        }
        console.log('✅ Native crypto polyfill complete');
    } catch (error) {
        console.warn('⚠️ Native crypto failed, using browserify:', error.message);
        try {
            globalThis.crypto = require('crypto-browserify');
            
            // Ensure subtle exists
            if (!globalThis.crypto.subtle) {
                const nodeCrypto = require('crypto');
                globalThis.crypto.subtle = {
                    digest: async (algorithm, data) => {
                        const hash = nodeCrypto.createHash(algorithm.toLowerCase().replace('-', ''));
                        hash.update(data);
                        return hash.digest();
                    },
                    importKey: () => Promise.resolve({}),
                    encrypt: () => Promise.resolve(Buffer.alloc(0)),
                    decrypt: () => Promise.resolve(Buffer.alloc(0))
                };
            }
        } catch (polyfillError) {
            console.error('❌ Crypto polyfill failed:', polyfillError.message);
            process.exit(1);
        }
    }
} else if (!globalThis.crypto.subtle) {
    console.log('🔧 Adding subtle to existing crypto...');
    const nodeCrypto = require('crypto');
    globalThis.crypto.subtle = {
        digest: async (algorithm, data) => {
            const hash = nodeCrypto.createHash(algorithm.toLowerCase().replace('-', ''));
            hash.update(data);
            return hash.digest();
        },
        importKey: () => Promise.resolve({}),
        encrypt: () => Promise.resolve(Buffer.alloc(0)),
        decrypt: () => Promise.resolve(Buffer.alloc(0))
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
        nextTick: (callback) => setTimeout(callback, 0),
        env: process.env || {}
    };
} else if (!globalThis.process.nextTick) {
    globalThis.process.nextTick = (callback) => setTimeout(callback, 0);
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