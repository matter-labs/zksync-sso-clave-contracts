import { promises as fs } from "fs";
import path from "path";

// Define the path to the package.json
const packageJsonPath = path.resolve("./package.json");
console.log(packageJsonPath);

// Get the version from environment variables
const version = process.env.INPUT_VERSION;
if (!version) {
  console.error("Error: INPUT_VERSION is required.");
  process.exit(1);
}

async function preparePackageJson() {
  try {
    // Read the existing package.json
    const packageJsonData = await fs.readFile(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonData);

    // Remove unnecessary properties
    delete packageJson.private;
    delete packageJson.type;
    delete packageJson.publishConfig;

    // Set the new version
    packageJson.version = version;

    // Write the updated package.json back to the file
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log(`Updated package.json for version ${version}`);
  } catch (error) {
    console.error("Error updating package.json:", error);
    process.exit(1);
  }
}

preparePackageJson();
