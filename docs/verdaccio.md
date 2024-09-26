# Verdaccio

[Verdaccio](https://verdaccio.org/)

Verdaccio is a local proxy registry that helps with publishing npm packages to a
non production or private environment.

## Run Verdaccio

Verdaccio is installed in this project from an NX plugin `@nx/js`, you do not
need to install the package globally.
Open up a terminal within the monorepo directory and run the following command.

```bash
pnpm run registry
```

## How it works

Verdaccio is a proxy that will intercept npm registry calls and determine if it
has a cached version of the package you're downloading or if it should allow it
through to the official registry. On the first download from the official
registry, it will take that package and cache it locally.

All NPM/PNPM/Yarn commands will work as normal but calls through to a registry
will be managed via Verdaccio.

When publishing a package, Verdaccio will instead take that package and set it
up locally within its own registry. You can access the dashboard for Verdaccio
and view packages at [http://localhost:4873/](http://localhost:4873/).

## Troubleshooting

### Keep Verdaccio running

With the way Verdaccio is setup and how it proxies the NPM registry, it's
probably best practice to always keep Verdaccio running on your machine. How you
do that is up to you.

### Unable to access NPM registry when installing packages

Check your Verdaccio and make sure it's running. Some configuration somewhere,
either in your global configuration for NPM registry URL, a project's `.npmrc`
or a `package.json` `publishConfig` might be pointing to the Verdaccio URL.
Without Verdaccio running it will not proxy to the official NPM registry.

This monorepo project is setup with Verdaccio through NX. It has its own
configuration defined within `.verdaccio/config.yml`.
