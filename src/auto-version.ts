import { readFile, writeFile } from "node:fs/promises";
import { join } from "path";
const VERSION_CONFIG_PATH = join(process.cwd(), "./package.json");
const SUFFIX = "-SNAPSHOT";

export type TBranchesName = "master" | "release";
export type TVersionKey =
    | "baseVersion"
    | "masterNextVersion"
    | "masterNextSnapshotVersion"
    | "releaseVersion";

export class AutoVersion {
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
    updatePackageJson = async (versionKey: Exclude<TVersionKey, "baseVersion">) => {
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
    get = (key: TVersionKey) => {
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
        branchName: TBranchesName,
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
    setBaseVersion = (version: string) => {
        this.baseVersion = version;
    }
    setMasterNextVersion = (version?: string) => {
        if (version) {
            this.masterNextVersion = version;
        } else {
            this.masterNextVersion = this.getNextVersion("master");
        }
    }
    setMasterNextSnapshotVersion = (version?: string) => {
        if (version) {
            this.masterNextSnapshotVersion = version;
        } else {
            this.masterNextSnapshotVersion = this.getNextVersion("master", true);
        }
    }
    setReleaseVersion = (version?: string) => {
        if (version) {
            this.releaseVersion = version;
        } else {
            this.releaseVersion = this.getNextVersion("release", true);
        }
    }
}