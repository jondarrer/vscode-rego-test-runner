import * as vscode from 'vscode';
import {
  handleFileChanged,
  handleRunRequest,
  refreshTestFile,
  refreshTestFiles,
  setupFileSystemWatchers,
  updateWorkspaceTestFile,
} from './helpers';
import { getConfig } from './config';

export async function activate(context: vscode.ExtensionContext) {
  const { testFilePatterns } = getConfig();
  const controller = vscode.tests.createTestController('RegoTestController', 'Rego');
  context.subscriptions.push(controller);

  const watchedTests = new Map<vscode.TestItem | 'ALL', vscode.TestRunProfile | undefined>();
  const fileChangedEmitter = new vscode.EventEmitter<vscode.Uri>();
  fileChangedEmitter.event((uri) => {
    // Get the config again, as it may have changed since the plugin was activated
    const { cwd, policyTestDir, opaCommand } = getConfig();
    handleFileChanged(controller, vscode.TestRunRequest, uri, watchedTests, cwd, policyTestDir, opaCommand);
  });

  controller.refreshHandler = async () => {
    // Get the config again, as it may have changed since the plugin was activated
    const { testFilePatterns } = getConfig();
    for (let testFilePattern of testFilePatterns) {
      await refreshTestFiles(controller, testFilePattern, vscode.workspace.findFiles, vscode.workspace.fs.readFile);
    }
  };

  controller.resolveHandler = async (item: vscode.TestItem | undefined) => {
    if (!item) {
      context.subscriptions.push(
        ...setupFileSystemWatchers(
          controller,
          fileChangedEmitter,
          vscode.workspace.createFileSystemWatcher,
          vscode.workspace.fs.readFile,
          getConfig,
        ),
      );

      // Discover tests by going through documents in the workspace
      for (let testFilePattern of testFilePatterns) {
        await refreshTestFiles(controller, testFilePattern, vscode.workspace.findFiles, vscode.workspace.fs.readFile);
      }

      return;
    } else if (item.uri) {
      await refreshTestFile(controller, item.uri, vscode.workspace.fs.readFile);
    }
  };

  controller.createRunProfile(
    'Run Tests',
    vscode.TestRunProfileKind.Run,
    (request: vscode.TestRunRequest, cancellation: vscode.CancellationToken) =>
      handleRunRequest(controller, request, cancellation, getConfig, watchedTests),
    true,
    undefined,
    true,
  );

  // Respond to document changes, whether editing or creation
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      // Get the config again, as it may have changed since the plugin was activated
      const { testFilePatterns } = getConfig();
      updateWorkspaceTestFile(controller, document, testFilePatterns);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      // Get the config again, as it may have changed since the plugin was activated
      const { testFilePatterns } = getConfig();
      updateWorkspaceTestFile(controller, event.document, testFilePatterns);
    }),
  );
}
