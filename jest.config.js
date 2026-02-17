module.exports = {
  testEnvironment: "jsdom",
  collectCoverage: true,
  coverageDirectory: "./coverage",
  coverageReporters: ["lcov", "text", "html"],
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