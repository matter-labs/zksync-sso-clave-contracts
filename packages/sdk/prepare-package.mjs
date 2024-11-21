import { promises as fs } from "fs";
import path from "path";

const version = process.env.INPUT_VERSION;
if (!version) {
  console.error("Error: INPUT_VERSION is required.");
  process.exit(1);
}

const packageJsonPath = path.resolve("./package.json");

async function preparePackageJson() {
  try {
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
