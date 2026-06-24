/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
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
