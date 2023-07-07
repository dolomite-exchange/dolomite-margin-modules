"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const deploy_utils_1 = require("./deploy-utils");
async function main() {
    const fileBuffer = fs_1.default.readFileSync('./scripts/deployments.json');
    const file = JSON.parse(fileBuffer.toString());
    (0, deploy_utils_1.writeFile)(file);
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
