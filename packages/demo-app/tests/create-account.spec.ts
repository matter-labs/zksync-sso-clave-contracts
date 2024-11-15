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
  await expect(page.getByText("ZKsync SSO Demo")).toBeVisible();
});

test("Create account, session key, and send ETH", async ({ page }) => {
  // Click the Connect button
  await page.getByRole("button", { name: "Connect" }).click();

  // Ensure popup is displayed
  await page.waitForTimeout(2000);
  const popup = page.context().pages()[1];
  await expect(popup.getByText("Connect to")).toBeVisible();
  popup.on("console", (msg) => {
    if (msg.type() === "error")
      console.log(`Auth server error console: "${msg.text()}"`);
  });
  popup.on("pageerror", (exception) => {
    console.log(`Auth server uncaught exception: "${exception}"`);
  });

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

  // Click Sign Up
  await popup.getByTestId("signup").click();

  // Add session
  await expect(popup.getByText("Authorize ZKsync SSO Demo")).toBeVisible();
  await expect(popup.getByText("Act on your behalf")).toBeVisible();
  await expect(popup.getByText("Expires tomorrow")).toBeVisible();
  await expect(popup.getByText("Permissions")).toBeVisible();
  await popup.getByTestId("connect").click();

  // Waits for session to complete and popup to close
  await page.waitForTimeout(2000);

  // Check address/balance is shown
  await expect(page.getByText("Disconnect")).toBeVisible();
  const address = (await page.getByText("Connected Address:").innerText())
    .replace("Connected Address: ", "");
  console.log(`Public Address: ${address}`);
  await expect(page.getByText("Balance:")).toBeVisible();
  const startBalance = +(await page.getByText("Balance:").innerText())
    .replace("Balance: ", "")
    .replace(" ETH", "");

  // Send some eth
  await page.getByRole("button", { name: "Send 0.1 ETH" }).click();
  await expect(page.getByRole("button", { name: "Send 0.1 ETH" })).toBeEnabled();
  const endBalance = +(await page.getByText("Balance:").innerText())
    .replace("Balance: ", "")
    .replace(" ETH", "");
  await expect(startBalance, "Balance after transfer should be ~0.1 ETH less")
    .toBeGreaterThanOrEqual(endBalance + 0.1);
});
