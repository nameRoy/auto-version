import { execaCommand } from "execa";
import inquirer from "inquirer";
import chalk from "chalk";
const $warning = (info: string) => console.log(chalk.hex("#FFA500")(info));
const $infoStr = (info: string) => chalk.hex("#12a8cd")(info)

import { readFile, writeFile } from "node:fs/promises";
import { join } from "path";
import ora from "ora";
const VERSION_CONFIG_PATH = join(process.cwd(), "./package.json");
const SUFFIX = "-SNAPSHOT";

type branchesName = "master" | "release";
type versionKey =
    | "baseVersion"
    | "masterNextVersion"
    | "masterNextSnapshotVersion"
    | "releaseVersion";
class AutoVersion {
    private baseVersion: string;
    private masterNextVersion: string;
    private masterNextSnapshotVersion: string;
    private releaseVersion: string;
    constructor() {
        this.baseVersion = null;
        this.masterNextVersion = null;
        this.masterNextSnapshotVersion = null;
        this.releaseVersion = null;
    }
    updateVersion = (upDigit: 1 | 2 | 3) => {
        return this.baseVersion.replace(
            /^(\d+)\.(\d+)\.(\d+)/,
            (match, p1, p2, p3) => {
                return [p1, p2, p3]
                    .map((item, index) => (index === upDigit - 1 ? +item + 1 : +item))
                    .join(".");
            }
        );
    }
    async updatePackageJson(versionKey: Exclude<versionKey, "baseVersion">) {
        const nextVersion = this.get(versionKey);
        const VERSION_CONFIG = await readFile(VERSION_CONFIG_PATH, {
            encoding: "utf-8",
        });
        const content = JSON.parse(VERSION_CONFIG);
        content.version = nextVersion;
        await writeFile(
            VERSION_CONFIG_PATH,
            JSON.stringify(content, null, 2),
            "utf-8"
        );
    }
    get(key: versionKey) {
        return this[key];
    }
    getCurPackageVersion = async (baseVersion?: string): Promise<string> => {
        if (!baseVersion) {
            const VERSION_CONFIG = await readFile(VERSION_CONFIG_PATH, {
                encoding: "utf-8",
            });
            return JSON.parse(VERSION_CONFIG).version;
        }
        return baseVersion;
    };
    getNextVersion = (
        branchName: branchesName,
        isSnapShot: boolean = false
    ): string => {
        const baseNextVersion = this.updateVersion(2);
        if (branchName === "master") {
            if (isSnapShot) {
                const temp = baseNextVersion.split(".");
                temp[2] = "1";
                return temp.join(".") + SUFFIX;
            }
            const temp = baseNextVersion.split("-")[0].split(".");
            temp[2] = "0"
            return temp.join(".")
        }
        if (branchName === "release") {
            const temp = baseNextVersion.split(".");
            temp[1] = String(+temp[1] + 1);
            if (isSnapShot) {
                return temp.join(".") + SUFFIX;
            }
            return temp.join(".");
        }
    };
    setBaseVersion(version: string) {
        this.baseVersion = version;
    }
    setMasterNextVersion(version?: string) {
        if (version) {
            this.masterNextVersion = version;
        } else {
            this.masterNextVersion = this.getNextVersion("master");
        }
    }
    setMasterNextSnapshotVersion(version?: string) {
        if (version) {
            this.masterNextSnapshotVersion = version;
        } else {
            this.masterNextSnapshotVersion = this.getNextVersion("master", true);
        }
    }
    setReleaseVersion(version?: string) {
        if (version) {
            this.releaseVersion = version;
        } else {
            this.releaseVersion = this.getNextVersion("release", true);
        }
    }
}

async function start() {
    const { step0 } = await inquirer.prompt([
        {
            name: "step0",
            type: "confirm",
            message: "已经合并 release 分支到 master 分支了么？",
            default: "y",
        },
    ]);
    if (!step0) {
        $warning("请先手动合并分支后再进行自动升级版本号操作");
        return;
    }

    const AV = new AutoVersion();
    const curPackageVersion = await AV.getCurPackageVersion();
    const { masterBaseVersion } = await inquirer.prompt([
        {
            name: "masterBaseVersion",
            type: "input",
            message: "当前 master 版本号是",
            default: curPackageVersion,
        },
    ]);
    AV.setBaseVersion(masterBaseVersion);
    AV.setMasterNextSnapshotVersion();
    AV.setMasterNextVersion();
    AV.setReleaseVersion();
    const spinner = ora('开始自动升级版本,请稍等').info();
    async function step1() {
        spinner.start("升级 master 版本号中")
        await AV.updatePackageJson("masterNextVersion");
        await execaCommand(`git add package.json`)
        await execaCommand(`git commit -m version(版本更新):版本更新至${AV.get("masterNextVersion")}`)
        await execaCommand(`git push`)
        spinner.text = `升级 master 版本号成功,新版本号：${$infoStr(AV.get("masterNextVersion"))}`;
        spinner.succeed();
        spinner.start("开始打tag发版本")
        await execaCommand(`git tag -a v${AV.get("masterNextVersion")} -m "${Date.now()}"`)
        await execaCommand(`git push origin v${AV.get("masterNextVersion")}`)
        spinner.succeed(`已将 ${$infoStr("v" + AV.get("masterNextVersion"))} 推送到远程`);
    }
    async function step2() {
        spinner.start("开始建立 master 快照")
        await AV.updatePackageJson("masterNextSnapshotVersion");
        spinner.succeed(`master 快照版本建立完成,快照版本号：${$infoStr(AV.get("masterNextSnapshotVersion"))}`);
    }
    async function step3() {
        const getFixBranchName = (base: Exclude<versionKey, "masterNextSnapshotVersion" | "releaseVersion">) => {
            const temp = AV.get(base).split(".");
            temp[2] = "x";
            return `hotfix/${temp.join(".")}`
        }
        spinner.start(`开始建立基于${$infoStr(AV.get("masterNextSnapshotVersion"))}版本的热修复分支`)
        const fixBranchName = getFixBranchName("masterNextVersion");
        await execaCommand(`git checkout -b ${fixBranchName}`);
        await execaCommand(`git add package.json`)
        await execaCommand(`git commit -m version(版本更新):版本更新至${AV.get("masterNextSnapshotVersion")}`)
        await execaCommand(`git push --set-upstream origin ${fixBranchName}`);
        spinner.succeed(`建立热修复分支成功,热修复分支名：${$infoStr(fixBranchName)}`);
        const { isDeletePreFixBranch } = await inquirer.prompt([
            {
                name: "isDeletePreFixBranch",
                type: "confirm",
                message: "是否自动删除本地及远程的上一版本热修复分支?",
                default: "y",
            },
        ]);
        if (isDeletePreFixBranch) {
            spinner.start("正在删除本地的上一版本热修复分支")
            const fixBranchName = getFixBranchName("baseVersion");
            try {
                await execaCommand(`git branch -d ${fixBranchName}`);
                spinner.succeed(`本地的上一版本热修复分支 ${$infoStr(fixBranchName)} 删除成功`)
            } catch (error) {
                spinner.fail(chalk.bgRed(`本地的上一版本热修复分支 ${$infoStr(fixBranchName)} 删除失败`))
                console.log(error);
            }
            spinner.start("正在删除远程的上一版本热修复分支")
            try {
                await execaCommand(`git push origin :${fixBranchName}`)
                spinner.succeed(`远程的上一版本热修复分支 ${$infoStr(fixBranchName)} 删除成功`)
            } catch (error) {
                spinner.fail(chalk.bgRed(`远程的上一版本热修复分支 ${$infoStr(fixBranchName)} 删除失败`))
                console.log(error);
            }
        }
    }
    async function step4() {
        spinner.start("开始升级 release 分支快照版本号")
        try {
            await execaCommand(`git checkout release`)
            await AV.updatePackageJson("releaseVersion")
            await execaCommand(`git add package.json`)
            await execaCommand(`git commit -m version(版本更新):版本更新至${AV.get("releaseVersion")}`)
            await execaCommand(`git push --set-upstream origin release`);
            spinner.succeed(`升级 release 分支快照版本号成功,快照版本号：${$infoStr(AV.get("releaseVersion"))}`)
        } catch (error) {
            spinner.fail(chalk.bgRed("升级 release 分支快照版本号失败"))
            console.log(error)
        }
    }
    async function step5() {
        const getDevBranchName = (base: Exclude<versionKey, "baseVersion" | "masterNextSnapshotVersion">) => {
            const temp = AV.get(base).split(".");
            temp[2] = "x";
            return `dev/${temp.join(".")}`
        }
        spinner.start(`开始建立下一版本的开发分支`)
        const devBranchName = getDevBranchName("releaseVersion");
        await execaCommand(`git checkout -b ${devBranchName}`);
        await execaCommand(`git push --set-upstream origin ${devBranchName}`);
        spinner.succeed(`建立下一版本的开发分支成功,开发分支名：${$infoStr(devBranchName)}`);
        const { isDeletePreDevBranch } = await inquirer.prompt([
            {
                name: "isDeletePreDevBranch",
                type: "confirm",
                message: "是否自动删除本地及远程的上一版本开发分支?",
                default: "n",
            },
        ]);
        if (isDeletePreDevBranch) {
            spinner.start("正在删除本地的上一版本开发分支")
            const devBranchName = getDevBranchName("masterNextVersion");
            try {
                await execaCommand(`git branch -d ${devBranchName}`);
                spinner.succeed(`本地的上一版本开发分支 ${$infoStr(devBranchName)} 删除成功`)
            } catch (error) {
                spinner.fail(chalk.bgRed(`本地的上一版本开发分支 ${$infoStr(devBranchName)} 删除失败`))
                console.log(error);
            }
            spinner.start("正在删除远程的上一版本开发分支")
            try {
                await execaCommand(`git push origin :${devBranchName}`)
                spinner.succeed(`远程的上一版本开发分支 ${$infoStr(devBranchName)} 删除成功`)
            } catch (error) {
                spinner.fail(chalk.bgRed(`远程的上一版本开发分支 ${$infoStr(devBranchName)} 删除失败`))
                console.log(error);
            }
        }
    }
    await step1();
    await step2();
    await step3();
    await step4();
    await step5();
}
start();
