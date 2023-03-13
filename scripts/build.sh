rm -rf dist
npx tsc --declaration src/client/mod.ts --outDir dist/client --lib esnext,dom --target esnext --module es2020
cp src/client/global.d.ts dist/client
