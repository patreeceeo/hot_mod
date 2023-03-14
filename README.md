# hot_mod

https://user-images.githubusercontent.com/578371/224865552-d85df44c-dab8-4eed-bb40-29c0a90c3cc1.mp4

An ESM-HMR client and server, allowing for hot-reloading client-side ESModules, as described by https://github.com/FredKSchott/esm-hmr.

## Usage with Deno

These modules are published at https://deno.land/x/hot_mod (despite what the Web page says, it's there)

In each client-side module:

```javascript
import { useClient } from "hot_mod/dist/client/mod.js";

useClient(import.meta);

// The following is just my best idea so far of how to write hot-reloadable modules :)
export const hotExports = {
  // Add more identifiers here
  drawPlayers // example
}
if (import.meta.hot) {
  import.meta.hot.accept([], ({ module }) => {
    for(const key of Object.keys(hotExports) as Array<keyof typeof hotExports>) {
      hotExports[key] = module.hotExports[key]
    }
  });
}
// In app code, write hotExports.drawPlayers() instead of drawPlayers()
```

This will make `import.meta.hot` available in development (well, as long as serving from localhost. I mean to support some kind of configuration or environment variables for deciding when HMR should be enabled.)

Then, in the dev server, import the HMR engine and wire it up:

```typescript
import { serve } from "http";
import { relative } from "path";
import { debounce } from "async";
import { EsmHmrEngine } from "hot_mod/src/server/mod.ts";

interface ModuleEventHandler {
  (paths: IterableIterator<string>): void;
}

let listenerCount = 0;
const modifiedModuleUrls = new Set<string>();
async function addModuleEventHandler(
  handler: ModuleEventHandler,
  absPaths: Array<string>,
) {
  const watcher = Deno.watchFs(absPaths, { recursive: true });

  const debouncedListener = debounce(() => {
    const copy = new Set(modifiedModuleUrls);
    handler(copy.values());
    modifiedModuleUrls.clear();
  }, 200);

  listenerCount++;
  console.log(
    `Module event handler #${listenerCount} for ${absPaths.join(", ")}`,
  );

  for await (const event of watcher) {
    if (event.kind === "modify") {
      for (const path of event.paths) {
        // These strings must correspond to those created on the client:
        // The pathname to the full URL to the module subject to hot reloading,
        // e.g. new URL(import.meta.url).pathname;
        const moduleId = "/" + relative(Deno.cwd(), path);
        modifiedModuleUrls.add(moduleId);
      }
    }
    if (modifiedModuleUrls.size > 0) {
      debouncedListener();
    }
  }
}

const engine = new EsmHmrEngine((emitModuleModifiedEvent) => {
  addModuleEventHandler((paths) => {
    for (const path of paths) {
      emitModuleModifiedEvent(path);
    }
  }, [Deno.cwd() + "/public"]);
});
serve((request) => {
  const { socket, response } = Deno.upgradeWebSocket(request);
  engine.addClient(socket);
  return response;
}, { port: 12321 });
```

And run it with:

```sh
deno run --allow-net --allow-read --watch "path/to/dev_server.ts"
```

## API

See https://github.com/FredKSchott/esm-hmr

## Contributing

GitHub issues and pull requests welcome!

