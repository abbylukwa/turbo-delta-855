now create the groupmanagerweb.js according to the following codespecifications the bot only replies to Adkins and ignores other users messages const fs = require('fs'); const path= require('path'); const axios= require('axios'); const ytdl= require('ytdl-core'); const instagramGetUrl= require('instagram-url-direct'); const{ exec } = require('child_process'); const util= require('util'); const execAsync= util.promisify(exec);

class GroupManager { constructor(sock) { this.sock = sock; this.isRunning = false; this.intervals = []; this.timeouts = []; this.downloadDir = path.join(__dirname, 'downloads');

}

module.exports = GroupManager;