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
import { JsmnSolLibTest, JsmnSolLibTest__factory } from "../typechain-types";
import { create2, ethersStaticSalt, getWallet, LOCAL_RICH_WALLETS } from "./utils";
import { expect } from "chai";
import { describe } from "mocha";
import { JsmnSolLib } from "../typechain-types/src/test/JsmnSolLibTest";

describe.only("JsmnSolLib", function () {
    const wallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
    async function deployParser(wallet: Wallet): Promise<JsmnSolLibTest> {
        const jsonLib = await create2("JsmnSolLibTest", wallet, ethersStaticSalt, []);

        return JsmnSolLibTest__factory.connect(await jsonLib.getAddress(), wallet);
    }

    function printTokens(jsonStr: string, tokens: JsmnSolLib.TokenStructOutput[], numTokens: bigint) {
        const tokenList: string[] = [];
        for (let i = 0; i < numTokens; i++) {
            const t = tokens[i];
            console.log(
                `Token ${i}: type: ${t.jsmnType}, start: ${t.start}, end: ${t.end}, size: ${t.size}, parent: ${t.parent}`,
            );
            console.log(`Token ${i}: ${jsonStr.slice(Number(t.start), Number(t.end))}`);
            tokenList.push(jsonStr.slice(Number(t.start), Number(t.end)));
        }

        return tokenList;
    }

    const RETURN_SUCCESS = 0;
    const RETURN_ERROR_INVALID_JSON = 1;
    const RETURN_ERROR_PART = 2;
    const RETURN_ERROR_NO_MEM = 3;

    describe("arrays", function () {
        it("should parse a simple array", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = '{"outerKey": [{"innerKey1": "value"}, {"innerKey2": "value"}]}';

            const [returnValue, tokens, _actualNum] = await jsmnSolLib.parse(json, 20);

            const t = tokens[2];

            expect(returnValue).to.eq(RETURN_SUCCESS, "Valid JSON should return a success.");
            expect(t.jsmnType).to.eq(2, "Not an array");
        });

        it("should parse a float array", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = "[16500.4, 16450.5]";
            const expectedInt1 = 1650040;
            const expectedInt2 = 1645050;
            const [returnValue, tokens, actualNum] = await jsmnSolLib.parse(json, 20);

            const returnedInt1 = await jsmnSolLib.parseIntSize(
                await jsmnSolLib.getBytes(json, tokens[1].start, tokens[1].end),
                2,
            );
            const returnedInt2 = await jsmnSolLib.parseIntSize(
                await jsmnSolLib.getBytes(json, tokens[2].start, tokens[2].end),
                2,
            );

            expect(returnValue).to.eq(RETURN_SUCCESS, "Valid JSON should return a success.");
            expect(actualNum).to.eq(3, "Number of tokens should be 3");
            expect(tokens[0].jsmnType).to.eq(2, "Not an array");
            expect(tokens[1].jsmnType).to.eq(4, "Not a primitive");
            expect(tokens[2].jsmnType).to.eq(4, "Not a primitive");
            expect(returnedInt1).to.eq(expectedInt1, "First numbers not equal");
            expect(returnedInt2).to.eq(expectedInt2, "Second numbers not equal");
        });
    });

    describe("errors", function () {
        it("should return for too few tokens", async () => {
            const jsmnSolLib = await deployParser(wallet);

            const json = "[16500.4, 16450.5]";
            const [returnValue, _tokens, _actualNum] = await jsmnSolLib.parse(json, 2);

            expect(returnValue).to.eq(RETURN_ERROR_NO_MEM, "Parser should have run out of tokens");
        });
    });

    describe("parse int", () => {
        it("should cast double", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const testValue = "236.6";
            const expected = 23660;
            const result = await jsmnSolLib.parseIntSize(testValue, 2);
            expect(result).to.eq(expected, "Not equal");
        });

        it("should check on decimal", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const testValue = "23.4";
            const expected = 234;
            const result = await jsmnSolLib.parseIntSize(testValue, 1);
            expect(result).to.eq(expected, "Not equal");
        });

        it("should parse two decimals", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const testValue = "23.4";
            const expected = 2340;
            const result = await jsmnSolLib.parseIntSize(testValue, 2);
            expect(result).to.eq(expected, "Not equal");
        });

        it("should parse two decimals", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const testValue = "-45.2";
            const expected = -452;
            const result = await jsmnSolLib.parseIntSize(testValue, 1);
            expect(result).to.eq(expected, "Not equal");
        });
    });

    describe("parse object", () => {
        it("should parse an object", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = '{"outerKey": {"innerKey": "value"}}';

            const [returnValue, tokens, _actualNum] = await jsmnSolLib.parse(json, 20);

            const t = tokens[4];

            expect(returnValue).to.eq(RETURN_SUCCESS, "Valid JSON should return a success.");
            expect(t.jsmnType).to.eq(3, "Not an string");
        });
    });

    describe("parse primatives", () => {
        it("should prase a string key", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = '{"key": "value"}';

            const [returnValue, tokens, actualNum] = await jsmnSolLib.parse(json, 5);

            expect(returnValue).to.eq(RETURN_SUCCESS, "Valid JSON should return a success.");
            expect(await jsmnSolLib.getBytes(json, tokens[1].start, tokens[1].end)).to.eq("key", "Not equal");
            expect(await jsmnSolLib.getBytes(json, tokens[2].start, tokens[2].end)).to.eq("value", "Not equal");
        });

        it("should parse a longer json", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = '{ "key1": { "key1.1": "value", "key1.2": 3, "key1.3": true, "key1.4": "val2"} }';

            const [returnValue, tokens, _actualNum] = await jsmnSolLib.parse(json, 20);
            expect(returnValue).to.eq(RETURN_SUCCESS, "Valid JSON should return a success.");

            {
                const t = tokens[1];
                expect(await jsmnSolLib.getBytes(json, t.start, t.end)).to.eq("key1", "Not equal");
            }

            {
                const t = tokens[3];
                expect(await jsmnSolLib.getBytes(json, t.start, t.end)).to.eq("key1.1", "Not equal");
            }

            {
                const t = tokens[4];
                expect(await jsmnSolLib.getBytes(json, t.start, t.end)).to.eq("value", "Not equal");
            }

            {
                const t = tokens[5];
                expect(await jsmnSolLib.getBytes(json, t.start, t.end)).to.eq("key1.2", "Not equal");
            }

            {
                const t = tokens[6];
                expect(await jsmnSolLib.parseIntNoSize(await jsmnSolLib.getBytes(json, t.start, t.end))).to.eq(3, "Not equal");
            }

            {
                const t = tokens[7];
                expect(await jsmnSolLib.getBytes(json, t.start, t.end)).to.eq("key1.3", "Not equal");
            }

            {
                const t = tokens[8];
                expect(await jsmnSolLib.parseBool(await jsmnSolLib.getBytes(json, t.start, t.end))).to.eq(true, "Not equal");
            }
            {
                const t = tokens[9];
                expect(await jsmnSolLib.getBytes(json, t.start, t.end)).to.eq("key1.4", "Not equal");
            }

            {
                const t = tokens[10];
                expect(await jsmnSolLib.getBytes(json, t.start, t.end)).to.eq("val2", "Not equal");
            }
        });

        it("should parse an integegr key value", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = '{"key": 23}';

            const [returnValue, tokens, _actualNum] = await jsmnSolLib.parse(json, 5);

            expect(returnValue).to.eq(RETURN_SUCCESS, "Valid JSON should return a success.");
            expect(await jsmnSolLib.getBytes(json, tokens[1].start, tokens[1].end)).to.eq("key", "Not equal");
            expect(await jsmnSolLib.parseIntNoSize(await jsmnSolLib.getBytes(json, tokens[2].start, tokens[2].end))).to.eq(
                23,
                "Not equal",
            );
        });

        it("should parse a negative integer key value", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = '{"key": -4523}';

            const [returnValue, tokens, _actualNum] = await jsmnSolLib.parse(json, 5);

            expect(returnValue).to.eq(RETURN_SUCCESS, "Valid JSON should return a success.");
            expect(await jsmnSolLib.getBytes(json, tokens[1].start, tokens[1].end)).to.eq("key", "Not equal");
            expect(await jsmnSolLib.parseIntNoSize(await jsmnSolLib.getBytes(json, tokens[2].start, tokens[2].end))).to.eq(
                -4523,
                "Not equal",
            );
        });

        it("should parse a boolean key value", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = '{"key": true}';

            const [returnValue, tokens, _actualNum] = await jsmnSolLib.parse(json, 5);

            expect(returnValue).to.eq(RETURN_SUCCESS, "Valid JSON should return a success.");
            expect(await jsmnSolLib.getBytes(json, tokens[1].start, tokens[1].end)).to.eq("key", "Not equal");
            expect(await jsmnSolLib.parseBool(await jsmnSolLib.getBytes(json, tokens[2].start, tokens[2].end))).to.be.true;
        });

        it("should parse float key value", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = '{"key": 23.45, "key2": 5, "key3": "23.66", "key4": "236.6"}';

            const [returnValue, tokens, _actualNum] = await jsmnSolLib.parse(json, 10);

            expect(returnValue).to.eq(RETURN_SUCCESS, "Valid JSON should return a success.");
            expect(await jsmnSolLib.getBytes(json, tokens[1].start, tokens[1].end)).to.eq("key", "Not equal");
            expect(await jsmnSolLib.parseIntSize(await jsmnSolLib.getBytes(json, tokens[2].start, tokens[2].end), 2)).to.eq(
                2345,
                "Not equal",
            );
        });
    });

    describe("return values", () => {
        it("should return error not enough memory", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = '{ "key": "value", "key_2": 23, "key_3": true }';

            const [returnValue, _tokens, _actualNum] = await jsmnSolLib.parse(json, 5);

            expect(returnValue).to.eq(RETURN_ERROR_NO_MEM, "There should not have been enough tokens to store the json.");
        });

        it("should unescape quote in string", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = '{ "key1": { "key1.1": "value", "key1"2": 3, "key1.3": true } }';

            const [returnValue, _tokens, _actualNum] = await jsmnSolLib.parse(json, 20);

            expect(returnValue).to.eq(
                RETURN_ERROR_INVALID_JSON,
                "An unescaped quote should result in a RETURN_ERROR_INVALID_JSON",
            );
        });

        it("should parse escaped quote in string", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = '{ "k": "a\\"b" }';

            const [_returnValue, tokens, _actualNum] = await jsmnSolLib.parse(json, 20);
            const t = tokens[2];

            expect(await jsmnSolLib.getBytes(json, t.start, t.end)).to.eq('a\\"b', "An escape quote should be preserved.");
            expect(t.start).to.eq(8, "Wrong start value for token");
            expect(t.end).to.eq(12, "Wrong end value for token");
        });

        it("should parse the correct number of elements", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = '{ "key": "value", "key_2": 23, "key_3": true }';

            const [returnValue, _tokens, actualNum] = await jsmnSolLib.parse(json, 10);

            expect(returnValue).to.eq(RETURN_SUCCESS, "Should have returned SUCCESS");
            expect(actualNum).to.eq(7, "Should have returned the correct # of elements");
        });
    });

    describe.only("unicode", () => {
        it("should parse umlaut", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = '{"key": "Möhrenbrot"}';

            const [returnValue, tokens, _actualNum] = await jsmnSolLib.parse(json, 5);

            const t = tokens[2];

            expect(returnValue).to.eq(RETURN_SUCCESS, "Valid JSON should return a success.");
            expect(await jsmnSolLib.getBytes(json, t.start, t.end)).to.eq("Möhrenbrot", "Problems with an umlaut");
        });

        it("should parse diacritcs", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = '{"key": "svenskå", "key2": "smørgasbröd", "key3": "Fußball"}';

            const [returnValue, tokens, actualNum] = await jsmnSolLib.parse(json, 10);
            expect(returnValue).to.eq(0, "Should be valid json");
            expect(actualNum).to.eq(7, "Should have 7 tokens");

            {
                const t = tokens[2];
                expect(await jsmnSolLib.getBytes(json, t.start, t.end)).to.eq("svenskå", "Problems with svensk 1");
            }

            {
                const t = tokens[4];
                expect(await jsmnSolLib.getBytes(json, t.start, t.end)).to.eq("smørgasbröd", "Problems with svensk 2");
            }

            {
                const t = tokens[6];
                expect(await jsmnSolLib.getBytes(json, t.start, t.end)).to.eq("Fußball", "Problems with svensk 2");
            }
        });

        it("should parse in the 0x80-0x7ff range", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = '{"\xc2\x80": "\xc2\x81", "\xdf\xbe": "\xdf\xbf"}';

            const [returnValue, tokens, actualNum] = await jsmnSolLib.parse(json, 10);

            expect(returnValue).to.eq(0, "Should be valid json");
            expect(actualNum).to.eq(5, "Should have 1 object and 2 key value pairs");
            expect(await jsmnSolLib.getBytes(json, tokens[1].start, tokens[1].end)).to.eq("\xc2\x80", "failed to parse start of range");
            expect(await jsmnSolLib.getBytes(json, tokens[2].start, tokens[2].end)).to.eq("\xc2\x81", "failed to parse within range start");
            expect(await jsmnSolLib.getBytes(json, tokens[3].start, tokens[3].end)).to.eq("\xdf\xbe", "failed to parse within range end");
            expect(await jsmnSolLib.getBytes(json, tokens[4].start, tokens[4].end)).to.eq("\xdf\xbf", "failed to parse end of range");
        });

        it("should parse in 0x800-0xffff range", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = '{"\xe0\xa0\x80": "\xe0\xa0\x81", "\xef\xbf\xbe": "\xef\xbf\xbf"}';
            const [returnValue, tokens, actualNum] = await jsmnSolLib.parse(json, 10);

            expect(returnValue).to.eq(0, "Should be valid json");
            expect(actualNum).to.eq(5, "Should have 1 object and 2 key value pairs");
            expect(await jsmnSolLib.getBytes(json, tokens[1].start, tokens[1].end)).to.eq("\xe0\xa0\x80", "failed to parse start of range");
            expect(await jsmnSolLib.getBytes(json, tokens[2].start, tokens[2].end)).to.eq("\xe0\xa0\x81", "failed to parse within range start");
            expect(await jsmnSolLib.getBytes(json, tokens[3].start, tokens[3].end)).to.eq("\xef\xbf\xbe", "failed to parse within range end");
            expect(await jsmnSolLib.getBytes(json, tokens[4].start, tokens[4].end)).to.eq("\xef\xbf\xbf", "failed to parse end of range");
        });

        it("should parse in 0x10000-0x10ffff range", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = '{"\xf0\x90\x80\x80": "\xf0\x90\x80\x81", "\xf4\x8f\xbf\xbe": "\xf4\x8f\xbf\xbf"}';
            const [returnValue, tokens, actualNum] = await jsmnSolLib.parse(json, 10);

            expect(returnValue).to.eq(0, "Should be valid json");
            expect(actualNum).to.eq(5, "Should have 1 object and 2 key value pairs");
            expect(await jsmnSolLib.getBytes(json, tokens[1].start, tokens[1].end)).to.eq("\xf0\x90\x80\x80", "failed to parse start of range");
            expect(await jsmnSolLib.getBytes(json, tokens[2].start, tokens[2].end)).to.eq("\xf0\x90\x80\x81", "failed to parse within range start");
            expect(await jsmnSolLib.getBytes(json, tokens[3].start, tokens[3].end)).to.eq("\xf4\x8f\xbf\xbe", "failed to parse within range end");
            expect(await jsmnSolLib.getBytes(json, tokens[4].start, tokens[4].end)).to.eq("\xf4\x8f\xbf\xbf", "failed to parse end of range");
        });

        it("should accept unicode encoding", async () => {
            const jsmnSolLib = await deployParser(wallet);
            const json = '{"\uD834\uDD1E": "\u005C"}';
            const [returnValue, tokens, actualNum] = await jsmnSolLib.parse(json, 10);

            expect(returnValue).to.eq(0, "Should be valid json");
            expect(actualNum).to.eq(3, "Should have 1 object and 1 key value pair");
            expect(await jsmnSolLib.getBytes(json, tokens[1].start, tokens[1].end)).to.eq("\uD834\uDD1E", "failed to parse g clef");
            expect(await jsmnSolLib.getBytes(json, tokens[2].start, tokens[2].end)).to.eq("\u005C", "failed to parse a single reverse solidus character");
        });
    });

    describe("file parsing", () => {
        const jsonDir = join("test", "json-files");

        function generateTestCase(filename: string) {
            return async () => {
                const jsmnSolLib = await deployParser(wallet);
                const testFile = readFileSync(join(jsonDir, filename), "utf-8");

                const tryParse = async (): Promise<[bigint, JsmnSolLib.TokenStructOutput[], bigint]> => {
                    try {
                        const [returnValue, tokens, actualNum] = await jsmnSolLib.parse(testFile, 10);
                        return [returnValue, tokens, actualNum];
                    } catch (e) {
                        console.log("e", e);
                    }
                    return [1n, [], 0n];
                };

                const [returnValue, tokens, actualNum] = await tryParse();

                const validParseResults = (returnValue == 0n && tokens.length > 0 && actualNum > 0);
                if (filename.startsWith("y_")) {
                    // expect(validParseResults,`File ${filename} should have succeeded! Tokens=${printTokens(testFile, tokens, actualNum)}, ParsedTokenCount=${actualNum}`).to.be.true;
                } else if (filename.startsWith("n_")) {
                    expect(validParseResults, `File ${filename} should have failed! Tokens=${printTokens(testFile, tokens, actualNum)}, ParsedTokenCount=${actualNum}`).to.be.false;
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
