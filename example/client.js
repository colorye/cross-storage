import "babel-polyfill";
import crossStorage from "../dist/index.js";

async function callback(storage) {
  await storage.setItem("hello", "world");
  console.log("await", await storage.getItem("hello"));
  storage.disconnect();
}

// (async () => {
//   const storage = await crossStorage.connect("http://localhost:3000");
//   callback(storage);
// })();

crossStorage.connect("http://localhost:3000", { callback });
