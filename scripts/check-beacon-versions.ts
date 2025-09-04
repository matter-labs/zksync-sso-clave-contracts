import { ethers } from "ethers";
import fs from "fs";
import { task } from "hardhat/config";

task("check-beacon-versions", "Checks what beacon versions are deployed")
  .addParam("proxyfile", "location of the file with proxy contract addresses")
  .setAction(async (cmd, hre) => {
    console.log("Checking beacon versions for network:", hre.network.name);

    // Read the deployed contract addresses
    const proxyAddresses = JSON.parse(fs.readFileSync(cmd.proxyfile).toString());
    console.log("Proxy addresses loaded:", proxyAddresses);

    const factoryAddress = proxyAddresses.accountFactory;
    if (!factoryAddress) {
      throw new Error("No accountFactory address found in proxy file");
    }

    // Get provider
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getProvider } = require("../test/utils");
    const provider = getProvider();

    // Factory ABI to read the beacon address
    const factoryAbi = [
      "function beacon() view returns (address)",
      "function getEncodedBeacon() view returns (bytes)",
    ];

    // Beacon ABI to read the implementation
    const beaconAbi = [
      "function implementation() view returns (address)",
    ];

    try {
      // Get beacon address from factory
      const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
      console.log("\n🏭 Checking factory at:", factoryAddress);

      const beaconAddress = await factory.beacon();
      console.log("📡 Factory points to beacon:", beaconAddress);

      // Get implementation from beacon
      const beacon = new ethers.Contract(beaconAddress, beaconAbi, provider);
      const implementationAddress = await beacon.implementation();
      console.log("🎯 Beacon points to implementation:", implementationAddress);

      // Check if there are any other beacons we should know about
      console.log("\n📊 Summary:");
      console.log("Factory:", factoryAddress);
      console.log("Beacon:", beaconAddress);
      console.log("Implementation:", implementationAddress);

      // Also check all proxy contracts and see what they point to
      console.log("\n🔍 Checking all proxy contracts:");
      const proxyAbi = [
        "function implementation() view returns (address)",
        "function beacon() view returns (address)",
      ];

      for (const [contractName, contractAddress] of Object.entries(proxyAddresses)) {
        if (contractName === "accountPaymaster") {
          console.log(`${contractName}: ${contractAddress} (not a proxy)`);
          continue;
        }

        try {
          const proxy = new ethers.Contract(contractAddress as string, proxyAbi, provider);

          // Try to get implementation directly (for transparent proxies)
          try {
            const impl = await proxy.implementation();
            console.log(`${contractName}: ${contractAddress} -> impl: ${impl}`);
          } catch {
            // Try to get beacon (for beacon proxies)
            try {
              const beaconAddr = await proxy.beacon();
              const beaconContract = new ethers.Contract(beaconAddr, beaconAbi, provider);
              const impl = await beaconContract.implementation();
              console.log(`${contractName}: ${contractAddress} -> beacon: ${beaconAddr} -> impl: ${impl}`);
            } catch {
              console.log(`${contractName}: ${contractAddress} (could not determine proxy type)`);
            }
          }
        } catch (error) {
          console.log(`${contractName}: ${contractAddress} (error reading: ${error.message})`);
        }
      }
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  });
