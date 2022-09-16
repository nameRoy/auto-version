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
            return baseNextVersion;
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
        spinner.text = `升级 master 版本号成功,新版本号：${$infoStr(AV.get("masterNextVersion"))}`;
        spinner.succeed();
        spinner.start("开始打tag发版本")
        // execaCommand()
    }
    step1();

}
start();
