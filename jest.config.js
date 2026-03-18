/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "react-jsx" } }],
  },
  collectCoverageFrom: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "!**/*.d.ts"],
};

module.exports = config;
