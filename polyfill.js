// polyfill.js - Add missing browser APIs to Node.js

// Polyfill for File
if (typeof globalThis.File === 'undefined') {
  const { Blob } = require('buffer');
  
  class File extends Blob {
    constructor(blobParts, name, options = {}) {
      super(blobParts, options);
      this.name = name;
      this.lastModified = options.lastModified || Date.now();
    }
  }
  
  globalThis.File = File;
  global.File = File;
}

// Basic polyfill for ReadableStream using Node.js streams
if (typeof globalThis.ReadableStream === 'undefined') {
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
              
              // Cleanup
              const cleanup = () => {
                this._readable.off('readable', readableHandler);
                this._readable.off('end', endHandler);
                this._readable.off('error', errorHandler);
              };
              
              // Auto cleanup after resolution
              resolve.then(cleanup).catch(cleanup);
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
}

// Now require the main application
require('./index.js');