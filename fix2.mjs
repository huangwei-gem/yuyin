import fs from "fs";
let code = fs.readFileSync("src/index.ts", "utf8");
// 把结尾的 "" 去掉
code = code.replace('+""', "+");
// 也要修复可能残留的 +"" 在末尾
code = code.replace(/\+""$/m, "");
fs.writeFileSync("src/index.ts", code);
console.log("Fixed done");