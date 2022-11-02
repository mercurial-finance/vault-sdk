const TIMEOUT_SEC = 1000;

module.exports = {
  preset: 'ts-jest',
  testEnvironment: "node",
  transform: {
   '\\.[jt]sx?$': "ts-jest",
  },
  "transformIgnorePatterns": [
    "node_modules/(?!(@tulip-protocol)/)",
  ],
  testTimeout: TIMEOUT_SEC * 90,
};
