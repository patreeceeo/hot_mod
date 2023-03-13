rm -rf dist
npx tsc --declaration src/client/mod.ts --outDir dist/client --lib esnext,dom --target esnext --module es2020
directive=$(cat src/client/triple-slash.js)
echo "$directive" | cat - dist/client/mod.js > temp && mv temp dist/client/mod.js
