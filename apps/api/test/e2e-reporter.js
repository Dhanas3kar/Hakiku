class E2eReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
  }

  onRunStart(results, options) {
    console.log('\n🚀 Starting E2E Test Suite Execution...\n');
  }

  onTestResult(test, testResult, aggregatedResult) {
    const status = testResult.numFailingTests === 0 ? '✓ PASSED' : '✗ FAILED';
    const filename = test.path ? test.path.split(/[\\/]/).pop() : 'test';
    console.log(`[E2E] ${status} - ${filename} (${testResult.perfStats ? testResult.perfStats.runtime : 0}ms)`);
  }

  onRunComplete(contexts, results) {
    console.log(`\n✨ E2E Test Suite Execution Complete: ${results.numPassedTests}/${results.numTotalTests} tests passed (${results.numPassedTestSuites}/${results.numTotalTestSuites} suites passed).\n`);
  }
}

module.exports = E2eReporter;
