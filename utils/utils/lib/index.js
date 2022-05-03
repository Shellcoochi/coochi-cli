'use strict';


function exec(command, args, options) {
    const win32 = process.platform === 'win32';

    const cmd = win32 ? 'cmd' : command;
    const cmdArs = win32 ? ['/c'].concat(command, args) : args;
    return require('child_process').spawn(cmd, cmdArs, options || {});
}

function execAsync(command, args, options) {
    return new Promise((resolve, reject) => {
        const p = exec(command, args, options);
        p.on('error', e => {
            reject(e)
        });
        p.on('exit', c => {
            resolve(c)
        })
    })
}

function isObject(o) {
    return Object.prototype.toString.call(o) === '[object Object]';
}

function spinnerStart(msg, setSpinnerString = '|/-\\') {
    const Spinner = require('cli-spinner').Spinner;

    const spinner = new Spinner(msg + ' %s');
    spinner.setSpinnerString(setSpinnerString);
    spinner.start();
    return spinner;
}

function sleep(timeout = 1000) {
    return new Promise(resolve => setTimeout(resolve, timeout));
}

module.exports = { isObject, spinnerStart, sleep, exec, execAsync };
