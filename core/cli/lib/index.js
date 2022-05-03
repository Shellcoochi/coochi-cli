"use strict";

module.exports = core;

const path = require("path");
const userHome = require("os").homedir();
const commander = require("commander");
const log = require("@coochi/log");
const exec = require("@coochi/exec");
const semver = require("semver");
const colors = require("colors");
const pathExists = require("path-exists").sync;

const pkg = require("../package.json");
const constant = require("./const");
const { copyFile } = require("fs");

const program = new commander.Command();

async function core() {
    try {
        prepare();
        registerCommand();
    } catch (e) {
        const options = program.opts();
        log.error(e.message);
        if(options.debug){
            console.log(e);
        }
    }

}

function registerCommand() {
  program
    .name(Object.keys(pkg.bin)[0])
    .usage("<command> [options]")
    .version(pkg.version)
    .option("-d, --debug", "是否开启debug模式", false)
    .option("-tp, --targetPath <targetPath>", "是否指定本地调试文件路径", "");

  program
    .command("init [projectName]")
    .option("-f,--force", "是否强制初始化项目")
    .action(exec);

  //开启debug模式
  program.on("option:debug", () => {
    const options = program.opts();
    if (options.debug) {
      process.env.LOG_LEVEL = "verbose";
    } else {
      process.env.LOG_LEVEL = "info";
    }
    log.level = process.env.LOG_LEVEL;
    log.verbose("debug", "test debug log");
  });

  //指定全局targetPath
  program.on("option:targetPath", () => {
    const options = program.opts();
    process.env.CLI_TARGET_PATH = options.targetPath;
  });

  //监听未知命令
  program.on("command:*", (obj) => {
    console.log(obj);
    const avilableCommands = program.commands.map((cmd) => cmd._name);
    console.log(colors.red("未知的命令：" + obj[0]));
    if (avilableCommands.length > 0) {
      console.log(colors.red("可用命令：" + avilableCommands.join(",")));
    }
  });

  program.parse(process.argv);
  //在没有输入命令时，打印帮助信息。【注】：新版本commandder在program注册之前获取不到输入的命令（args）
  if (program.args && program.args.length < 1) {
    program.outputHelp();
    console.log();
  }
}

async function prepare() {
  checkPkgVersion();
  checkRoot();
  checkUserHome();
  checkEnv();
  await checkGlobalUpdate();
}

async function checkGlobalUpdate() {
  //1.获取当前版本号和模块名
  const currentVersion = pkg.version;
  const npmName = pkg.name;
  //2.调用npm API，获取所有版本号
  const { getNpmSemverVersion } = require("@coochi/get-npm-info");
  // const lastVersion = await getNpmSemverVersion(currentVersion, npmName);
  const lastVersion = await getNpmSemverVersion("0.0.0", "semver");
  if (lastVersion && semver.gt(lastVersion, currentVersion)) {
    log.warn(
      "更新提示",
      colors.yellow(`请手动更新 ${npmName}，当前版本 ${currentVersion}，最新版本 ${lastVersion}
            更新命令：npm install -g ${npmName}`)
    );
  }
  //3.提取所有版本号，比对那些大于当前版本号
  //4.获取最新版本号，提醒用户更新到最新版本
}

function checkEnv() {
  const dotenv = require("dotenv");
  const dotenvPath = path.resolve(userHome, ".env");
  if (dotenvPath) {
    dotenv.config({ path: dotenvPath });
  }
  createDeaultConfig();
}

function createDeaultConfig() {
  const cliConfig = {
    home: userHome,
  };
  if (process.env.CLI_HOME) {
    cliConfig["cliHome"] = path.join(userHome, process.env.CLI_HOME);
  } else {
    cliConfig["cliHome"] = path.join(userHome, constant.DEFAULT_CLI_HOME);
  }
  process.env.CLI_HOME_PATH = cliConfig.cliHome;
}

function checkUserHome() {
  if (!userHome || !pathExists(userHome)) {
    throw Error(colors.red("当前登陆用户主目录不存在"));
  }
}

function checkRoot() {
  const rootCheck = require("root-check");
  rootCheck();
  // console.log(process.geteuid());
}

function checkPkgVersion() {
  log.notice("cli", pkg.version);
  // log.success('shellcoochi','成功！')
}
