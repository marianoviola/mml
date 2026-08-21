const [command = "help"] = process.argv.slice(2);

if (command === "help") {
  console.log(`MML CLI (bootstrap)\n\nPlanned commands:\n  simulate\n  compare\n  break-even\n  assumptions\n`);
  process.exit(0);
}

console.error(`Command not implemented yet: ${command}`);
process.exit(1);
