import path from 'path'
import resolve from '@rollup/plugin-node-resolve' 
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import ts from 'rollup-plugin-typescript2'
const getPath = _path => path.resolve(process.cwd(), _path)


const extensions = [
  '.js',
  '.ts'
]

const tsPlugin = ts({
  tsconfig: getPath('./tsconfig.json'), // 导入本地ts配置
  extensions
})

// 基础配置
const commonConf = {
  input: getPath('./src/index.ts'),
  plugins:[
    resolve(extensions),
    tsPlugin,
    commonjs(),
    json()
  ]
}
// 需要导出的模块类型
const outputMap = [
  {
    file: "lib/index.js",
    format: "iife",
  }
]


const buildConf = options => Object.assign({}, commonConf, options)


export default outputMap.map(output => buildConf({ output: {name: "autoVersion", ...output}}))