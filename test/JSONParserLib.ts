// Copyright 2024 cbe
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { Wallet } from "zksync-ethers";
import { JSONParserLibTest, JSONParserLibTest__factory } from "../typechain-types";
import { create2, ethersStaticSalt, getWallet, LOCAL_RICH_WALLETS } from "./utils";
import { expect } from "chai";
import { describe } from "mocha";

describe("JSONParserLib tests", function () {
    let jsonLibTester: JSONParserLibTest;
    const wallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);

    async function deployParser(wallet: Wallet): Promise<JSONParserLibTest> {
        const jsonLib = await create2("JSONParserLibTest", wallet, ethersStaticSalt, []);
        return JSONParserLibTest__factory.connect(await jsonLib.getAddress(), wallet);
    }

    describe("file parsing", () => {
        const jsonDir = join("test", "json-files");

        before(async () => {
            jsonLibTester = await deployParser(wallet);
        });

        function generateTestCase(filename: string) {
            return async () => {
                const testFile = readFileSync(join(jsonDir, filename), "utf-8");

                if (filename.startsWith("y_")) {
                    await expect(jsonLibTester.parse(testFile)).to.not.be.reverted;
                } else if (filename.startsWith("n_")) {
                    await expect(jsonLibTester.parse(testFile)).to.be.reverted;
                } else {
                    expect(false, `File ${filename} should start with 'y_' or 'n_'`);
                }
            };
        }

        // there are lots of files to run so want to include them individually to avoid timeout issues
        const jsonFiles = readdirSync(jsonDir);
        jsonFiles.forEach((filename) => {
            it(filename, generateTestCase(filename));
        });
    });
});
