import { TVersionKey } from "./auto-version.js";

import { execaCommand } from "execa";
import inquirer from "inquirer";
import ora from "ora";

import { AutoVersion } from "./auto-version.js"
import { createLogger } from "./info-printer.js";
const logger = createLogger();
const spinner = ora();

export class LifeCycle {
    AV: AutoVersion;
    constructor(AV: AutoVersion) {
        this.AV = AV;
    }
    start = async () => {
        const fns: Function[] = [this.step0, this.step1, this.step2, this.step3, this.step4, this.step5];
        for await (let fn of fns) {
            const isContinue: boolean = await fn();
            if (!isContinue) break
        }
    }
    step0 = async () => {
        const { step0 } = await inquirer.prompt([
            {
                name: "step0",
                type: "confirm",
                message: "已经合并 release 分支到 master 分支了么？",
                default: "y",
            },
        ]);
        if (step0) {
            const AV = this.AV;
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
            return true;
        } else {
            console.log(logger.$warn("请先手动合并分支后再进行自动升级版本号操作"));
            return false;
        }
    }
    step1 = async () => {
        try {
            const AV = this.AV;
            spinner.info("开始自动升级版本,请稍等")
            spinner.start("升级 master 版本号中")
            await AV.updatePackageJson("masterNextVersion");
            await execaCommand(`git add package.json`)
            await execaCommand(`git commit -m version(版本更新):版本更新至${AV.get("masterNextVersion")}`)
            await execaCommand(`git push`)
            spinner.text = `升级 master 版本号成功,新版本号：${logger.$info(AV.get("masterNextVersion"))}`;
            spinner.succeed();
            spinner.start("开始打tag发版本")
            await execaCommand(`git tag -a v${AV.get("masterNextVersion")} -m "${Date.now()}"`)
            await execaCommand(`git push origin v${AV.get("masterNextVersion")}`)
            spinner.succeed(`已将 ${logger.$info("v" + AV.get("masterNextVersion"))} 推送到远程`);
            return true;
        } catch (error) {
            console.log(error);
            return false;
        }
    }
    step2 = async () => {
        try {
            const AV = this.AV;
            spinner.start("开始建立 master 快照")
            await AV.updatePackageJson("masterNextSnapshotVersion");
            spinner.succeed(`master 快照版本建立完成,快照版本号：${logger.$info(AV.get("masterNextSnapshotVersion"))}`);
            return true;
        } catch (error) {
            console.log(error);
            return false
        }

    }
    step3 = async () => {
        try {
            const AV = this.AV;
            const getFixBranchName = (base: Exclude<TVersionKey, "masterNextSnapshotVersion" | "releaseVersion">) => {
                const temp = AV.get(base).split(".");
                temp[2] = "x";
                return `hotfix/${temp.join(".")}`
            }
            spinner.start(`开始建立基于${logger.$info(AV.get("masterNextSnapshotVersion"))}版本的热修复分支`)
            const fixBranchName = getFixBranchName("masterNextVersion");
            await execaCommand(`git checkout -b ${fixBranchName}`);
            await execaCommand(`git add package.json`)
            await execaCommand(`git commit -m version(版本更新):版本更新至${AV.get("masterNextSnapshotVersion")}`)
            await execaCommand(`git push --set-upstream origin ${fixBranchName}`);
            spinner.succeed(`建立热修复分支成功,热修复分支名：${logger.$info(fixBranchName)}`);
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
                    spinner.succeed(`本地的上一版本热修复分支 ${logger.$info(fixBranchName)} 删除成功`)
                } catch (error) {
                    spinner.fail(logger.$error(`本地的上一版本热修复分支 ${logger.$info(fixBranchName)} 删除失败`))
                    console.log(error);
                }
                spinner.start("正在删除远程的上一版本热修复分支")
                try {
                    await execaCommand(`git push origin :${fixBranchName}`)
                    spinner.succeed(`远程的上一版本热修复分支 ${logger.$info(fixBranchName)} 删除成功`)
                } catch (error) {
                    spinner.fail(logger.$error(`远程的上一版本热修复分支 ${logger.$info(fixBranchName)} 删除失败`))
                    console.log(error);
                }
            }
            return true;
        } catch (error) {
            console.log(error);
            return false
        }
    }
    step4 = async () => {
        try {
            const AV = this.AV;
            spinner.start("开始升级 release 分支快照版本号")
            await execaCommand(`git checkout release`)
            await AV.updatePackageJson("releaseVersion")
            await execaCommand(`git add package.json`)
            await execaCommand(`git commit -m version(版本更新):版本更新至${AV.get("releaseVersion")}`)
            await execaCommand(`git push --set-upstream origin release`);
            spinner.succeed(`升级 release 分支快照版本号成功,快照版本号：${logger.$info(AV.get("releaseVersion"))}`)
            return true;
        } catch (error) {
            spinner.fail(logger.$error("升级 release 分支快照版本号失败"))
            console.log(error)
            return false;
        }
    }
    step5 = async () => {
        try {
            const AV = this.AV;
            const getDevBranchName = (base: Exclude<TVersionKey, "baseVersion" | "masterNextSnapshotVersion">) => {
                const temp = AV.get(base).split(".");
                temp[2] = "x";
                return `dev/${temp.join(".")}`
            }
            spinner.start(`开始建立下一版本的开发分支`)
            const devBranchName = getDevBranchName("releaseVersion");
            await execaCommand(`git checkout -b ${devBranchName}`);
            await execaCommand(`git push --set-upstream origin ${devBranchName}`);
            spinner.succeed(`建立下一版本的开发分支成功,开发分支名：${logger.$info(devBranchName)}`);
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
                    spinner.succeed(`本地的上一版本开发分支 ${logger.$info(devBranchName)} 删除成功`)
                } catch (error) {
                    spinner.fail(logger.$error(`本地的上一版本开发分支 ${logger.$info(devBranchName)} 删除失败`))
                    console.log(error);
                }
                spinner.start("正在删除远程的上一版本开发分支")
                try {
                    await execaCommand(`git push origin :${devBranchName}`)
                    spinner.succeed(`远程的上一版本开发分支 ${logger.$info(devBranchName)} 删除成功`)
                } catch (error) {
                    spinner.fail(logger.$error(`远程的上一版本开发分支 ${logger.$info(devBranchName)} 删除失败`))
                    console.log(error);
                }
            }
            return true;
        } catch (error) {
            console.log(error);
            return false
        }
    }
}