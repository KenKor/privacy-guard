// `npm run site`: serves the fictitious broker A on localhost:8080. Node 22.18+ strips the types.
import { startSite } from "./server.ts";

await startSite(8080);
console.log("Broker A (fictitious) on http://localhost:8080/");
