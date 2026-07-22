/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { module: "commonjs" } }],
  },
  // e2e bridge는 P4_E2E_INPUT_PATH 있을 때만 실질 동작; 평소에도 skip으로 통과
  testPathIgnorePatterns: [],
};

module.exports = config;
