module.exports = {
  testEnvironment: "jsdom",
  collectCoverage: true,
  coverageDirectory: "./coverage",
  coverageReporters: ["lcov", "text", "html"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: {
        jsx: "react-jsx",
        esModuleInterop: true,
        module: "commonjs",
        moduleResolution: "node",
        baseUrl: ".",
        paths: { "@/*": ["./src/*"] }
      }
    }]
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
