import { expect, type Page, test } from "@playwright/test";

async function waitForServicesToLoad(page: Page): Promise<void> {
  const maxRetryAttempts = 30;
  let retryCount = 0;

  // Wait for nft-quest to finish loading
  await page.goto("/");
  let demoButton = page.getByText("Let's Go");
  while (!(await demoButton.isVisible()) && retryCount < maxRetryAttempts) {
    await page.waitForTimeout(1000);
    demoButton = page.getByText("Let's Go");
    retryCount++;

    console.log(`Waiting for nft quest app to load (retry ${retryCount})...`);
  }
  console.log("NFT Quest App loaded");

  // Wait for auth server to finish loading
  retryCount = 0;
  await page.goto("http://localhost:3002");
  let authServerHeader = page.getByTestId("signup");
  while (!(await authServerHeader.isVisible()) && retryCount < maxRetryAttempts) {
    await page.waitForTimeout(1000);
    authServerHeader = page.getByTestId("signup");
    retryCount++;

    console.log(`Waiting for auth server to load (retry ${retryCount})...`);
  }
  console.log("Auth Server loaded");
};

test.beforeEach(async ({ page }) => {
  page.on("console", (msg) => {
    if (msg.type() === "error")
      console.log(`Main page error console: "${msg.text()}"`);
  });
  page.on("pageerror", (exception) => {
    console.log(`Main page uncaught exception: "${exception}"`);
  });

  await waitForServicesToLoad(page);
  await page.goto("/");
  await expect(page.getByText("Let's Go")).toBeVisible();
});

test("Create account, session key, and mint NFT", async ({ page }) => {
  // Click the Let's Go button
  await page.getByRole("button", { name: "Let's Go" }).click();

  // Ensure popup is displayed
  await page.waitForTimeout(2000);
  let popup = page.context().pages()[1];
  await expect(popup.getByText("Connect to ZK NFT Quest")).toBeVisible({ timeout: 15000 });
  popup.on("console", (msg) => {
    if (msg.type() === "error")
      console.log(`Auth server error console: "${msg.text()}"`);
  });
  popup.on("pageerror", (exception) => {
    console.log(`Auth server uncaught exception: "${exception}"`);
  });

  // Setup webauthn a Chrome Devtools Protocol session
  // NOTE: This needs to be done for every page of every test that uses WebAuthn
  let client = await popup.context().newCDPSession(popup);
  await client.send("WebAuthn.enable");
  let result = await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "usb",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  const authenticatorId = result.authenticatorId;
  console.log(`WebAuthn Authenticator ID: ${authenticatorId}`);

  // Click Sign Up
  await popup.getByTestId("signup").click();

  // Save credentials.id for later tests
  let newCredential = null;
  client.on("WebAuthn.credentialAdded", (credentialAdded) => {
    console.log("New Passkey credential added");
    console.log(`Authenticator ID: ${credentialAdded.authenticatorId}`);
    console.log(`Credential: ${credentialAdded.credential}`);
    newCredential = credentialAdded.credential;
  });

  // Add session
  await expect(popup.getByText("Authorize ZK NFT Quest")).toBeVisible();
  await expect(popup.getByText("Permissions")).toBeVisible();
  await popup.getByTestId("connect").click();

  // Waits for session to complete and popup to close
  await page.waitForTimeout(2000);

  // Mint your NFT
  await page.getByRole("button", { name: "Mint 100% free NFT" }).click();
  await expect(page.getByTestId("spinner")).not.toBeVisible();

  // Send a friend the NFT
  await expect(page.getByText("You've got Zeek.")).toBeVisible();
  const richWallet0 = "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049";
  await page.getByPlaceholder("Wallet address").fill(richWallet0);
  await page.getByRole("button", { name: "Mint and send" }).click();
  await expect(page.getByTestId("spinner")).not.toBeVisible();
  await expect(page.getByText("You've sent the minted copy to")).toBeVisible({ timeout: 15000 });

  // Disconnect and try again by logging in with the existing passkey
  await page.getByText("keyboard_arrow_down").click();
  await page.getByText("Disconnect").click();
  await expect(page.getByText("Let's Go")).toBeVisible();
  await page.getByText("Let's Go").click();

  // Wait for Auth Server to pop back up
  await page.waitForTimeout(2000);
  popup = page.context().pages()[1];

  // We need to recreate the virtual authenticator to match the previous one
  client = await popup.context().newCDPSession(popup);
  await client.send("WebAuthn.enable");
  result = await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "usb",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await expect(newCredential).not.toBeNull();
  await client.send("WebAuthn.addCredential", {
    authenticatorId: result.authenticatorId,
    credential: newCredential!,
  });
  await expect(popup.getByText("Authorize ZK NFT Quest")).toBeVisible();

  // Logout
  await popup.getByTestId("logout").click();
  await expect(popup.getByText("Connect to ZK NFT Quest")).toBeVisible();

  // Sign In
  await popup.getByTestId("login").click();

  // Add session
  await expect(popup.getByText("Authorize ZK NFT Quest")).toBeVisible();
  await expect(popup.getByText("Permissions")).toBeVisible();
  await popup.getByTestId("connect").click();

  // Waits for session to complete and popup to close
  await page.waitForTimeout(2000);

  // Mint another NFT
  await page.getByRole("button", { name: "Mint 100% free NFT" }).click({ timeout: 60000 });
  await expect(page.getByTestId("spinner")).not.toBeVisible();
  await expect(page.getByText("You've got Zeek.")).toBeVisible();
});
