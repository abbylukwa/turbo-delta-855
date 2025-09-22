// polyfill.js - Add missing browser APIs to Node.js
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
}

// Now require the main application
require('./index.js');