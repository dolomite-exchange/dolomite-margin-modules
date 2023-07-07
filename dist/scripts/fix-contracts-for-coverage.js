"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
async function main() {
    (0, child_process_1.execSync)('yarn clean', { stdio: 'inherit' });
    (0, child_process_1.execSync)('rm -rf contracts_coverage && cp -r contracts/ contracts_coverage/', { stdio: 'inherit' });
    (0, child_process_1.execSync)('python scripts/fix-contracts-for-coverage.py', { stdio: 'inherit' });
}
main()
    .then(() => console.log('Fix contracts completed'))
    .catch((err) => {
    console.error('Found error', err.message);
    process.exit(-1);
});
