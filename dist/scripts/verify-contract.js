"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const deploy_utils_1 = require("./deploy-utils");
async function main() {
    await (0, deploy_utils_1.verifyContract)('0x5c851fd710b83705be1cabf9d6cbd41f3544be0e', []);
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
