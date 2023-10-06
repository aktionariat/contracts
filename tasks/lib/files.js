const fs = require('fs-extra');
const path = require('path');

module.exports = {
  getCurrentDirectoryBase: () => {
    return path.basename(process.cwd());
  },

  directoryExists: (filePath) => {
    return fs.existsSync(filePath);
  },
  copyDirectory: (src, dest) => {
    fs.copySync(src, dest);
  },
  createDirectory: (path) => {
    fs.mkdirSync(path);
  }
};