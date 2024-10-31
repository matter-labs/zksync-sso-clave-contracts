import { test, expect, type Page } from "@playwright/test";

async function waitForServicesToLoad(page: Page): Promise<void> {
  const maxRetryAttempts = 10;
  let retryCount = 0;

  // Wait for demo-app to finish loading
  await page.goto("/");
  let demoHeader = page.getByText("ZKsync SSO Demo");
  while (!(await demoHeader.isVisible()) && retryCount < maxRetryAttempts) {
    await page.waitForTimeout(1000);
    demoHeader = page.getByText("ZKsync SSO Demo");
    retryCount++;

    console.log(`Waiting for demo app to load (retry ${retryCount})...`);
  }
  console.log("Demo App loaded");

  // Wait for auth server to finish loading
  retryCount = 0;
  await page.goto("http://localhost:3002");
  let authServerHeader = page.getByText("Index page");
  while (!(await authServerHeader.isVisible()) && retryCount < maxRetryAttempts) {
    await page.waitForTimeout(1000);
    authServerHeader = page.getByText("Index page");
    retryCount++;

    console.log(`Waiting for auth server to load (retry ${retryCount})...`);
  }
  console.log("Auth Server loaded");
};

test("Create account, session key, and send ETH", async ({ page }) => {
  await waitForServicesToLoad(page);
  await page.goto("/");
  await expect(page.getByText("ZKsync SSO Demo")).toBeVisible();

  // Click the Connect button
  await page.getByRole("button", { name: "Connect" }).click();

  // Ensure popup is displayed
  await page.waitForTimeout(2000);
  const popup = page.context().pages()[1];
  await expect(popup.getByText("Create new account")).toBeVisible();

  // Setup webauthn a Chrome Devtools Protocol session
  // NOTE: This needs to be done for every page of every test that uses WebAuthn
  const client = await popup.context().newCDPSession(popup);
  await client.send("WebAuthn.enable");
  const result = await client.send("WebAuthn.addVirtualAuthenticator", {
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

  // Enter username for new account
  // TODO: Check if error displays when name is taken
  await expect(popup.getByText("Create new account")).toBeVisible();
  await popup.getByRole("button", { name: "Create new account" }).click();
  const randomUsername = `zksync.me.${Math.floor(Math.random() * 100000)}`;
  console.log(`Username: ${randomUsername}`);
  await popup.getByPlaceholder("Username").fill(randomUsername);
  // TODO: Replace timeout that waits for name check to complete
  await popup.waitForTimeout(300);
  await popup.getByRole("button", { name: "Create new account" }).click();
  // TODO: Replace timeout that waits for Account Creation transaction to complete
  await popup.waitForTimeout(3000);

  // Add session
  expect(popup.getByText("Authorize ZKsync SSO Demo App")).toBeVisible();
  expect(popup.getByText("Act on your behalf")).toBeVisible();
  expect(popup.getByText("Expires tomorrow")).toBeVisible();
  await popup.getByRole("button", { name: "Connect" }).click();

  // Check address/balance is shown
  // TODO: Replace timeout that waits for Session transaction to complete
  await page.waitForTimeout(2000);
  expect(page.getByText("Disconnect")).toBeVisible();
  const address = (await page.getByText("Connected Address:").innerText())
    .replace("Connected Address: ", "");
  console.log(`Public Address: ${address}`);
  const startBalance = +(await page.getByText("Balance:").innerText())
    .replace("Balance: ", "")
    .replace(" ETH", "");

  // Send some eth
  await page.getByRole("button", { name: "Send 0.1 ETH" }).click();
  // TODO: Replace timeout that waits for transaction to complete
  await page.waitForTimeout(2000);
  const endBalance = +(await page.getByText("Balance:").innerText())
    .replace("Balance: ", "")
    .replace(" ETH", "");
  expect(startBalance, "Balance after transfer should be ~0.1 ETH less")
    .toBeGreaterThanOrEqual(endBalance + 0.1);
});
