/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@actions/core$": "<rootDir>/node_modules/@actions/core/lib/core.js",
    "^@actions/github$": "<rootDir>/node_modules/@actions/github/lib/github.js",
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/main.ts"],
  coverageThreshold: {
    "./src/inputs.ts": { lines: 90, functions: 90 },
    "./src/selector.ts": { lines: 90, functions: 90 },
    "./src/branches.ts": { lines: 90, functions: 90 },
    "./src/report.ts": { lines: 90, functions: 90 }
  },
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: { module: "commonjs", moduleResolution: "node" } }]
  }
};
