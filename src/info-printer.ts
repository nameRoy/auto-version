import chalk from "chalk";
type TColor = {
    $info: string,
    $warn: string,
    $error: string,
    [key: string]: string
}
const color: TColor = {
    $info: "#12a8cd",
    $warn: "#e5e511",
    $error: "#f87f70",
}
type ILog = {
    [k in keyof TColor]: (info: string) => string;
};
function createLogger(): ILog {
    const res = {};
    Object.entries(color).forEach(([key, value]) => {
        res[key] = (info) => chalk.hex(value)(info)
    })
    return res as ILog
}
export default createLogger