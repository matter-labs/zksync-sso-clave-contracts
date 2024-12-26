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

import * as hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet } from "zksync-ethers";
import { JsmnSolLibTest, JsmnSolLibTest__factory } from "../typechain-types";
import { getWallet, LOCAL_RICH_WALLETS } from "./utils";
import { expect } from "chai";
import { describe } from "mocha";
import exp from "constants";

describe.only("JsmnSolLib", function () {
  const wallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
  async function deployParser(wallet: Wallet): Promise<JsmnSolLibTest> {
    const deployer: Deployer = new Deployer(hre, wallet);
    const JsmnSolLibTestArtifact = await deployer.loadArtifact("JsmnSolLibTest");

    const validator = await deployer.deploy(JsmnSolLibTestArtifact, []);
    return JsmnSolLibTest__factory.connect(await validator.getAddress(), wallet);
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

  describe("unicode", () => {
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

      const [_returnValue, tokens, _actualNum] = await jsmnSolLib.parse(json, 10);

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
  });
});
