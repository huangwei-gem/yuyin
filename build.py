import base64
import re

with open('static/index.html', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode()
    
with open('src/index.ts', 'r', encoding='utf-8') as f:
    code = f.read()

code = re.sub(r'const INDEX_HTML_B64 = "[^"]*"', 'const INDEX_HTML_B64 = "' + b64 + '"', code)

with open('src/index.ts', 'w', encoding='utf-8') as f:
    f.write(code)
print('OK len=' + str(len(b64)))