module.exports = {
  testEnvironment: "jsdom",
  collectCoverage: true,
  coverageDirectory: "./coverage",
  coverageReporters: ["lcov", "text", "html"],
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1"
  },
  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "/harness/coverage",
        outputName: "test-results.xml"
      }
    ]
  ]
};
