#!/usr/bin/env node
"use strict";

const { createJiti } = require("jiti");
const path = require("path");

createJiti(__filename).import(path.join(__dirname, "..", "orchestrator", "runner.ts"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });