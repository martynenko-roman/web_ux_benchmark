#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import {
  createBenchmarkCommand,
  createReportCommand,
  createCompareCommand,
} from "./commands.js";

const program = new Command();

program
  .name("web-ux-benchmark")
  .description("Benchmarking Web UX Beyond Core Web Vitals")
  .version("1.0.0");

program.addCommand(createBenchmarkCommand());
program.addCommand(createReportCommand());
program.addCommand(createCompareCommand());

program.parse();

if (!process.argv.slice(2).length) {
  program.outputHelp();
  console.log(chalk.yellow("\nNo command specified. Use --help for usage information."));
}

