const VERBOSE = process.env.VERBOSE === 'true' || process.env.VERBOSE === '1';

function log(...args) {
  if (VERBOSE && args.length === 1 && typeof args[0] === 'object') {
    console.log('[LOG]', JSON.stringify(args[0]));
  } else {
    console.log('[LOG]', ...args);
  }
}

function json(obj) {
  console.log(JSON.stringify(obj));
}

module.exports = { log, json };
