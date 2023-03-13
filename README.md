# hot_deno

An ESM-HMR client and server, allowing for hot-reloading client-side ESModules, as described by https://github.com/FredKSchott/esm-hmr.

## Usage with Deno

These modules are published at https://deno.land/x/hot_mod.

In each client-side module:

```javascript
import { useHmr } from "hot_mod/client/mod.js";

useHmr(import.meta);
```

This will make `import.meta.hot` available in development (well, as long as serving from localhost. I mean to support some kind of configuration or environment variables for deciding when HMR should be enabled.)

Then, in the dev server, import the HMR engine and wire it up:

```typescript
import { serve } from "http";
import { relative } from "path";
import { debounce } from "async";
import { EsmHmrEngine } from "hot_mod/server/mod.ts";

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
        const cwdRelativePath = relative(Deno.cwd(), path);
        // TODO there's some confusing naming conventions going on in this code
        // The names "id" and "url" are used to refer to the same things, and those
        // things are actually path(name)s.
        modifiedModuleUrls.add("/" + cwdRelativePath);
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

## Contributing

GitHub issues and pull requests welcome!

