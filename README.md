# Rego Test Runner for VS Code

Run [Rego tests](https://www.openpolicyagent.org/docs/latest/policy-testing/) for [Open Policy Agent](https://www.openpolicyagent.org) within VS Code.

![Exension Demo](https://github.com/jondarrer/vscode-rego-test-runner/blob/main/extension-demo.gif)

## Features

Simple way to run OPA Rego tests from within VS Code. Tests are policies which begin with `test_`.

## Requirements

This plugin requires the [Open Policy Agent](https://github.com/open-policy-agent/opa) executable (`opa`) to be installed in your $PATH.

### Installation

To install the extension, visit the Visual Studio Code Marketplace or search for "Rego Test Runner" in the 'Extensions' panel.

## Configuration

| Field                       | Default              | Description                                                                                    |
| --------------------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `regoTest.policyTestDir`    | `${workspaceFolder}` | Relative folder from which to load the policy tests, defaults to the current working directory |
| `regoTest.testFilePatterns` | `["**/*_test.rego"]` | List of patterns which identify files as policy tests                                          |
| `regoTest.opaCommand`       | `opa` or `opa.exe`   | The name, or full path to the opa command on your system, defaults to opa (or opa.exe on windows)                                          |

## Features

- Automatic test discovery upon activation
- Manually discover tests via the Refresh Tests feature
- Run all tests within a file
- Run tests individually
- Run individual tests directly from within the test file
- Run on either Mac, Linux or Windows

## Planned features

- [ ] Watch tests
- [ ] Run all tests together
- [ ] View verbose test failure message next to the failed test and in the Test Results pane
- [ ] Handle todo tests, those prefixed with `todo_`, but which must be skipped

## Other feature ideas

- [ ] Failed test assertion surfacing (when tests are written with [rego-test-assertions](https://github.com/anderseknert/rego-test-assertions))
- [ ] Code coverage

## [CHANGELOG](./CHANGELOG.md)

## Troubleshooting

### All tests are failing

- Make sure you have the [Open Policy Agent](https://github.com/open-policy-agent/opa) executable (`opa`) installed in your $PATH.

- Try setting the `regoTest.policyTestDir` in your project's `.vscode/settings.json` file to the relative path where your policies are, e.g. `policies`. By default this is `.`.

- Try setting the `regoTest.testFilePatterns` in your project's `.vscode/settings.json` file to an array of [glob](https://en.wikipedia.org/wiki/Glob_(programming))s to describe where to find your test files. By default this is `["**/*_test.rego"]`.

- Try setting the `regoTest.opaCommand` in your application's `settings.json` file to the full path where your `opa` executable is, e.g. `/opt/homebrew/bin/opa` or `C:\\Users\\me\\opa_windows_amd64.exe`.

## Development

### Testing

Run the tests with the usual command:

```sh
npm test
```

This will run the tests with a coverage report (requires 100% across the board to pass), which you can view with:

```sh
open coverage/lcov-report/index.html
```

### Debugging

Run the `Run Extension` task in VS Code to debug the extension.
