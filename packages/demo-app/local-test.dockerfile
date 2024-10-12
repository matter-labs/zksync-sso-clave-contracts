FROM mcr.microsoft.com/playwright

# install pnpm into system deps
RUN wget -qO- https://get.pnpm.io/install.sh | ENV="$HOME/.shrc" SHELL="$(which sh)" sh -

# ensure to mount the repo to /root/app
WORKDIR /root/app/packages/demo-app

# install playwright
RUN pnpm exec playwright install --with-deps

# then actually run the tests
CMD pnpm nx e2e demo-app
