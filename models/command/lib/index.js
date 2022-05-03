'use strict';

const semver = require("semver");
const colors = require("colors");

const log = require('@coochi/log');

const LOWEST_NODE_VERSION = 'v12.18.3';

class Command {
    constructor(argv) {
        // console.log('command', argv)
        if (!argv) {
            throw new Error('参数不能为空');
        }
        if (!Array.isArray(argv)) {
            throw new Error('参数必须为数组');
        }
        if (argv.length < 1) {
            throw new Error('参数列表不能为空');
        }
        this._argv = argv;
        let runner = new Promise((resolve, reject) => {
            let chain = Promise.resolve();
            chain = chain.then(() => { this.checkNodeVersion() });
            chain = chain.then(() => { this.initArgs() });
            chain = chain.then(() => { this.init() });
            chain = chain.then(() => { this.exec() });

            chain.catch(err => {
                log.error(err.message)
            })
        })
    }

    initArgs() {
        this._cmd = this._argv[this._argv.length - 2];
        this._argv = this._argv.slice(0, this._argv.length - 2);
    }

    checkNodeVersion() {
        const currentVersion = process.version;
        const lowestVersion = LOWEST_NODE_VERSION;
        if (!semver.gte(currentVersion, lowestVersion)) {
            throw new Error(
                colors.red(`coochi 需要安装 v${lowestVersion} 以上版本的node.js`)
            );
        }
    }

    init() {
        throw new Error('init 必须实现');
    }

    exec() {
        throw new Error('exec 必须实现');
    }
}

module.exports = Command;