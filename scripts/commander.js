/**
 * commander.js
 */

/* api */
import path from 'node:path';
import { program as commander } from 'commander';
import { isDir, removeDir } from './file-util.js';

/**
 * clean directory
 * @param {object} cmdOpts - command options
 * @returns {void}
 */
export const cleanDirectory = (cmdOpts = {}) => {
  const { dir, info } = cmdOpts;
  if (isDir(dir)) {
    removeDir(dir);
    if (info) {
      console.info(`Removed: ${path.resolve(dir)}`);
    }
  }
};

/**
 * parse command
 * @param {Array} args - process.argv
 * @returns {void}
 */
export const parseCommand = args => {
  const reg = /^(?:(?:--)?help|-h|clean|denoconf)$/;
  if (Array.isArray(args) && args.some(arg => reg.test(arg))) {
    if (args.includes('clean')) {
      commander
        .command('clean')
        .description('clean directory')
        .option('-d, --dir <name>', 'specify directory')
        .option('-i, --info', 'console info')
        .action(cleanDirectory);
    }
    commander.parse(args);
  }
};
