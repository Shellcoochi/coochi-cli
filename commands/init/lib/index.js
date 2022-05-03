'use strict';

const fs = require('fs');
const path = require('path');
const userHome = require("os").homedir();
const inquirer = require('inquirer');
const fse = require('fs-extra');
const semver = require('semver');

const Command = require('@coochi/command');
const log = require('@coochi/log');
const { spinnerStart, sleep, execAsync } = require('@coochi/utils');
const getProjectTempalte = require('./getProjectTemplate');
const Package = require('@coochi/package');

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';

const TEMPLATE_TYPE_NORAML = 'normal';
const TEMPLATE_TYPE_CUSTOM = 'custom';

const WHITE_COMMAND = ['npm', 'cnpm'];

class InitCommand extends Command {
    init() {
        this.projectName = this._argv[0] || '';
        this.force = !!this._cmd.force;
        log.verbose('projectName', this.projectName);
        log.verbose('force', this.force);
    }

    async exec() {
        try {
            //1.准备阶段
            const projectInfo = await this.prepare();
            if (projectInfo) {
                //2.下载模版
                log.verbose('projectInfo', projectInfo);
                this.projectInfo = projectInfo;
                await this.downloadTemplate();
                //3.安装模版
                await this.installTemplate();
            }

        } catch (e) {
            log.error(e.message);
        }
    }

    async installTemplate() {
        if (this.templateInfo) {
            if (!this.templateInfo.type) {
                this.templateInfo.type = TEMPLATE_TYPE_NORAML;
            }
            if (this.templateInfo.type === TEMPLATE_TYPE_NORAML) {
                //标准安装
                await this.installNormalTemplate();
            } else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
                //自定义安装
                await this.installCustomTemplate();
            } else {
                throw new Error('无法识别项目类型！');
            }
        } else {
            throw new Error('项目模版信息不存在！');
        }
    }

    checkCommand(cmd) {
        if (WHITE_COMMAND.includes(cmd)) {
            return cmd;
        };
        return null
    }

    async execCommand(command,errMsg) {
        let ret;
        if (command) {
            const cmdArray = command.split(' ');
            const cmd = this.checkCommand(cmdArray[0]);
            if (!cmd) {
                throw new Error('命令不存在！命令：' + command);
            }
            const args = cmdArray.slice(1);
            ret = await execAsync(cmd, args, {
                stdio: 'inherit',
                cwd: process.cwd()
            });
        }
        if (ret !== 0) {
            throw new Error(errMsg);
        }
        return ret;
    }

    async installNormalTemplate() {
        log.verbose('templateNpm', this.templateNpm);
        //拷贝模版代码至当前目录
        let spinner = spinnerStart('正在安装模版。。。');
        await sleep();
        try {
            // const templatePath = path.resolve(this.templateNpm.cacheFilePath,'template');
            const templatePath = path.resolve(this.templateNpm.cacheFilePath);
            const targetPath = process.cwd();
            fse.ensureDirSync(templatePath);
            fse.ensureDirSync(targetPath);
            fse.copySync(templatePath, targetPath);
        } catch (error) {
            throw e;
        } finally {
            spinner.stop(true);
            log.success('模版安装成功！');
        }
        //安装依赖
        const { installCommand, startCommand } = this.templateInfo;
        this.execCommand(installCommand,'依赖安装过程中失败！');
        //启动命令执行
        this.execCommand(startCommand,'启动过程中失败！');
    }

    async installCustomTemplate() {

    }

    async downloadTemplate() {
        const { projectTemplate } = this.projectInfo;
        const templateInfo = this.template.find(item => item.npmName === projectTemplate)
        const targetPath = path.resolve(userHome, '.coochi-cli', 'template');
        const storeDir = path.resolve(userHome, '.coochi-cli', 'template', 'node_modules');
        const { npmName, version } = templateInfo;
        this.templateInfo = templateInfo;
        const templateNpm = new Package({
            targetPath,
            storeDir,
            packageName: npmName,
            packageVersion: version
        })
        if (!await templateNpm.exists()) {
            const spinner = spinnerStart('正在下载模版。。。');
            await sleep();
            try {
                await templateNpm.install()
            } catch (e) {
                throw e;
            } finally {
                spinner.stop(true)
                if (await templateNpm.exists()) {
                    log.success('下载模版成功！')
                    this.templateNpm = templateNpm;
                }

            }
        } else {
            const spinner = spinnerStart('正在更新模版。。。');
            await sleep();
            try {
                await templateNpm.update()
            } catch (e) {
                throw e;
            } finally {
                spinner.stop(true)
                if (await templateNpm.exists()) {
                    log.success('更新模版成功！')
                    this.templateNpm = templateNpm;
                }
            }
        }
    }

    async prepare() {
        //0.判断项目模版是否存在
        const template = await getProjectTempalte();
        if (!template || template.length === 0) {
            throw new Error('项目模版不存在！')
        };
        this.template = template;
        //1.判断当前目录是否为空
        const localPath = process.cwd();
        if (!this.isDirEmpty(localPath)) {
            let ifContinue = false
            if (!this.force) {
                //询问是否继续创建
                ifContinue = (await inquirer.prompt({
                    type: 'confirm',
                    name: 'ifContinue',
                    default: false,
                    message: "当前文件夹不为空，是否继续创建项目"
                })).ifContinue
                if (!ifContinue) {
                    return;
                }
            }
            //2.是否启动强制更新
            if (ifContinue || this.force) {
                //给用户二次确认
                const { confirmDelete } = await inquirer.prompt({
                    type: 'confirm',
                    name: 'confirmDelete',
                    default: false,
                    message: "是否确认清空当前目录下的文件？"
                });
                if (confirmDelete) {
                    //清空当前目录
                    fse.emptyDirSync(localPath);
                }

            }
        }
        return this.getProjectInfo();
    }

    async getProjectInfo() {
        let projectInfo = {};
        //1.选择创建项目或组件
        const { type } = await inquirer.prompt({
            type: 'list',
            name: 'type',
            message: '请选择初始化类型',
            default: TYPE_PROJECT,
            choices: [
                {
                    name: '项目',
                    value: TYPE_PROJECT,
                },
                {
                    name: '组件',
                    value: TYPE_COMPONENT,
                },
            ]
        })
        log.verbose(type);
        if (type === TYPE_PROJECT) {
            //2.获取项目的基本信息
            const project = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'projectName',
                    message: '请输入项目名称',
                    default: '',
                    validate: function (v) {
                        const done = this.async();
                        setTimeout(function () {
                            //1.首字母必须为英文字符
                            //2.尾字符必须为英文、数字，不能为字符
                            //3.字符仅允许“-_”
                            if (!/^[a-zA-z]+([-][a-zA-z][a-zA-Z0-9]*|[_][a-zA-z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v)) {
                                done('请输入合法的项目名称');
                                return;
                            }
                            done(null, true);
                        }, 0)
                    },
                    filter: function (v) {
                        return v;
                    }
                },
                {
                    type: 'input',
                    name: 'projectVersion',
                    message: '请输入项目版本号',
                    default: '1.0.0',
                    validate: function (v) {
                        const done = this.async();
                        setTimeout(function () {
                            if (!(!!semver.valid(v))) {
                                done('请输入合法的版本号');
                                return;
                            }
                            done(null, true);
                        }, 0)
                    },
                    filter: function (v) {
                        if (!!semver.valid(v)) {
                            return semver.valid(v);
                        } else {
                            return v;
                        }

                    }
                },
                {
                    type: 'list',
                    name: 'projectTemplate',
                    message: '请选择项目模版',
                    choices: this.createTemplateChoices()
                }
            ])
            projectInfo = {
                type,
                ...project,
            }
        } else if (type === TYPE_COMPONENT) {

        }
        //return 项目基本信息（object）
        return projectInfo;
    }

    createTemplateChoices() {
        return this.template.map(item => ({
            value: item.npmName,
            name: item.name
        }))
    }

    isDirEmpty(localPath) {
        let fileList = fs.readdirSync(localPath);
        //文件过滤的逻辑
        fileList = fileList.filter(file => (
            !file.startsWith('.') && ['node_modules'].indexOf(file) < 0
        ))
        return !fileList || fileList.length <= 0;
    }
}

function init(argv) {
    return new InitCommand(argv);
}

module.exports = init;
module.exports.InitCommand = InitCommand;