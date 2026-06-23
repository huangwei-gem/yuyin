import fs from "fs";
let code = fs.readFileSync("src/index.ts", "utf8");
code = code.replace('INDEX_HTML_B64 = ""', "INDEX_HTML_B64 = \"");
fs.writeFileSync("src/index.ts", code);
console.log("Fixed");