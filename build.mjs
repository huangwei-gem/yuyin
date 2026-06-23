import fs from "fs";

const b64 = fs.readFileSync("static/index.b64", "utf8").trim();
let code = fs.readFileSync("src/index.ts", "utf8");

// 用占位符替换
const placeholder = "' + $b64 + '";
const replacement = '"' + b64 + '"';
code = code.replace(placeholder, replacement);

fs.writeFileSync("src/index.ts", code);
console.log("Done, replaced " + placeholder.substring(0, 20) + "... length=" + b64.length);