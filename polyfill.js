// polyfill.js - Add missing browser APIs to Node.js

// CRITICAL: Polyfill for crypto first (this is what's causing your error)
if (typeof globalThis.crypto === 'undefined') {
    try {
        // First try to use Node.js native crypto
        globalThis.crypto = require('crypto');
        console.log('✅ Using Node.js native crypto module');
    } catch (error) {
        console.warn('⚠️ Native crypto not available, using crypto-browserify');
        try {
            globalThis.crypto = require('crypto-browserify');
            
            // Add subtle API if missing (required by some libraries)
            if (!globalThis.crypto.subtle) {
                globalThis.crypto.subtle = {
                    digest: async (algorithm, data) => {
                        const hash = require('crypto').createHash(algorithm.toLowerCase().replace('-', ''));
                        hash.update(data);
                        return hash.digest();
                    }
                };
            }
        } catch (polyfillError) {
            console.error('❌ Could not load crypto polyfill:', polyfillError.message);
            // Create a minimal crypto implementation
            globalThis.crypto = {
                getRandomValues: (array) => {
                    const crypto = require('crypto');
                    const randomBytes = crypto.randomBytes(array.byteLength);
                    new Uint8Array(array.buffer).set(randomBytes);
                    return array;
                },
                subtle: {
                    digest: async (algorithm, data) => {
                        const hash = require('crypto').createHash(algorithm.toLowerCase().replace('-', ''));
                        hash.update(data);
                        return hash.digest();
                    }
                }
            };
        }
    }
}

// Polyfill for TextEncoder/TextDecoder if missing
if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = require('util').TextEncoder;
    globalThis.TextDecoder = require('util').TextDecoder;
}

// Polyfill for Blob (should be first since File depends on it)
if (typeof globalThis.Blob === 'undefined') {
    try {
        const { Blob } = require('buffer');
        globalThis.Blob = Blob;
        global.Blob = Blob;
        console.log('✅ Blob polyfill loaded');
    } catch (error) {
        console.warn('⚠️ Could not load Blob polyfill:', error.message);
    }
}

// Polyfill for File
if (typeof globalThis.File === 'undefined') {
    try {
        class File extends globalThis.Blob {
            constructor(blobParts, name, options = {}) {
                super(blobParts, options);
                this.name = name;
                this.lastModified = options.lastModified || Date.now();
            }
        }

        globalThis.File = File;
        global.File = File;
        console.log('✅ File polyfill loaded');
    } catch (error) {
        console.warn('⚠️ Could not load File polyfill:', error.message);
    }
}

// Polyfill for fetch API if missing (some environments might need this)
if (typeof globalThis.fetch === 'undefined') {
    try {
        globalThis.fetch = require('node-fetch');
        console.log('✅ fetch polyfill loaded');
    } catch (error) {
        console.warn('⚠️ Could not load fetch polyfill:', error.message);
    }
}

// Polyfill for ReadableStream using Node.js streams
if (typeof globalThis.ReadableStream === 'undefined') {
    try {
        const { Readable } = require('stream');

        class ReadableStreamPolyfill {
            constructor(underlyingSource = {}) {
                this._readable = new Readable({
                    read(size) {
                        if (underlyingSource.start) {
                            underlyingSource.start(this);
                        }
                    }
                });

                if (underlyingSource.start) {
                    const controller = {
                        enqueue: (chunk) => this._readable.push(chunk),
                        close: () => this._readable.push(null),
                        error: (err) => this._readable.destroy(err)
                    };
                    underlyingSource.start(controller);
                }
            }

            getReader() {
                return {
                    read: () => {
                        return new Promise((resolve, reject) => {
                            const chunk = this._readable.read();
                            if (chunk !== null) {
                                resolve({ value: chunk, done: false });
                            } else {
                                // Check if stream has ended
                                if (this._readable.readableEnded) {
                                    resolve({ value: undefined, done: true });
                                    return;
                                }

                                // Wait for data to be available
                                const readableHandler = () => {
                                    const chunk = this._readable.read();
                                    if (chunk !== null) {
                                        resolve({ value: chunk, done: false });
                                    }
                                };

                                const endHandler = () => {
                                    resolve({ value: undefined, done: true });
                                };

                                const errorHandler = (err) => {
                                    reject(err);
                                };

                                this._readable.once('readable', readableHandler);
                                this._readable.once('end', endHandler);
                                this._readable.once('error', errorHandler);
                            }
                        });
                    },
                    releaseLock: () => {
                        // No-op for this simple implementation
                    },
                    closed: new Promise((resolve, reject) => {
                        this._readable.once('end', resolve);
                        this._readable.once('error', reject);
                    })
                };
            }

            [Symbol.asyncIterator]() {
                const reader = this.getReader();
                return {
                    next: () => reader.read(),
                    return: () => {
                        reader.releaseLock();
                        return Promise.resolve({ value: undefined, done: true });
                    }
                };
            }

            cancel(reason) {
                this._readable.destroy(reason);
                return Promise.resolve();
            }
        }

        globalThis.ReadableStream = ReadableStreamPolyfill;
        global.ReadableStream = ReadableStreamPolyfill;
        console.log('✅ ReadableStream polyfill loaded');
    } catch (error) {
        console.warn('⚠️ Could not load ReadableStream polyfill:', error.message);
    }
}

// Polyfill for other potentially missing APIs
if (typeof globalThis.DOMException === 'undefined') {
    try {
        class DOMException extends Error {
            constructor(message, name) {
                super(message);
                this.name = name || 'DOMException';
            }
        }
        globalThis.DOMException = DOMException;
        global.DOMException = DOMException;
        console.log('✅ DOMException polyfill loaded');
    } catch (error) {
        console.warn('⚠️ Could not load DOMException polyfill:', error.message);
    }
}

// Ensure Buffer is available
if (typeof globalThis.Buffer === 'undefined') {
    try {
        globalThis.Buffer = require('buffer').Buffer;
        console.log('✅ Buffer polyfill loaded');
    } catch (error) {
        console.warn('⚠️ Could not load Buffer polyfill:', error.message);
    }
}

// Add process.nextTick if missing (some environments)
if (typeof globalThis.process === 'undefined') {
    globalThis.process = {
        nextTick: (callback) => setTimeout(callback, 0),
        env: {}
    };
} else if (!globalThis.process.nextTick) {
    globalThis.process.nextTick = (callback) => setTimeout(callback, 0);
}

console.log('✅ All polyfills loaded. Starting application...');

// Now require the main application
try {
    require('./index.js');
} catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
}