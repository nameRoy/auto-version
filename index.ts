import { execaCommand } from 'execa';
import inquirer from 'inquirer';

import { readFile } from "node:fs/promises"
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));

const VERSION_CONFIG_PATH = join(__dirname, "./package.json");
const SUFFIX = "-SNAPSHOT"

class AutoVersion {
    private baseVersion: string
    private masterNextVersion: string
    private masterNextSnapshotVersion: string;
    private releaseVersion: string;
    constructor() {
        this.baseVersion = null;
        this.masterNextVersion = null;
        this.masterNextSnapshotVersion = null;
        this.releaseVersion = null;
    }
    get(key: "baseVersion" | "masterNextVersion" | "masterNextSnapshotVersion" | "releaseVersion") {
        return this[key]
    }
    setBaseVersion(version: string) {
        this.baseVersion = version
    }
    setMasterNextVersion(version?: string) {
        if (version) {
            this.masterNextVersion = version
        } else {
            this.masterNextVersion = this.getNextVersion("master")
        }
    }
    setMasterNextSnapshotVersion(version?: string) {
        if (version) {
            this.masterNextSnapshotVersion = version
        } else {
            this.masterNextSnapshotVersion = this.getNextVersion("master", true)
        }
    }
    setReleaseVersion(version?: string) {
        if (version) {
            this.releaseVersion = version
        } else {
            this.releaseVersion = this.getNextVersion("release", true)
        }
    }
    getCurPackageVersion = async (baseVersion?: string): Promise<string> => {
        if (!baseVersion) {
            const VERSION_CONFIG = await readFile(VERSION_CONFIG_PATH, {
                encoding: "utf-8"
            })
            return JSON.parse(VERSION_CONFIG).version
        }
        return baseVersion
    }

    updateVersion = (upDigit: 1 | 2 | 3) => {
        return this.baseVersion.replace(/^(\d+)\.(\d+)\.(\d+)/, (match, p1, p2, p3) => {
            return [p1, p2, p3].map((item, index) => index === upDigit - 1 ? (+item + 1) : (+item)).join(".")
        })
    }

    getNextVersion = (branchName: "master" | "release", isSnapShot: boolean = false): string => {
        const baseNextVersion = this.updateVersion(2);
        if (branchName === "master") {
            if (isSnapShot) {
                const temp = baseNextVersion.split(".");
                temp[2] = "1"
                return temp.join(".") + SUFFIX;
            }
            return baseNextVersion
        }
        if (branchName === "release") {
            const temp = baseNextVersion.split(".");
            temp[1] = String(+temp[1] + 1);
            if (isSnapShot) {
                return temp.join(".") + SUFFIX;
            }
            return temp.join(".")
        }
    }
}

async function start() {
    const AV = new AutoVersion();
    const curPackageVersion = await AV.getCurPackageVersion()
    AV.setMasterNextSnapshotVersion()
    AV.setMasterNextVersion()
    AV.setReleaseVersion()

    const { step0 } = await inquirer.prompt([
        {
            name: "step0",
            type: "confirm",
            message: "已经合并 release 分支到 master 分支了么？",
            default: "y"
        }
    ])
    if (!step0) {
        console.log("请先手动合并分支后进行自动升级版本号操作")
        return;
    }

    const { masterBaseVersion } = await inquirer.prompt([
        {
            name: "masterBaseVersion",
            type: "input",
            message: "当前 master 版本号是",
            default: curPackageVersion
        }
    ])
    AV.setBaseVersion(masterBaseVersion);

    function updatePackageJson() {

    }


}
start()
