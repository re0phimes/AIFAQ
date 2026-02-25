import { initDB } from "../lib/db";

async function main() {
  await initDB();
  console.log("Database initialized successfully");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});
