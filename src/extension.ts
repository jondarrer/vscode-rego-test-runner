import * as vscode from 'vscode';
import { handleRunRequest, refreshTestFiles, updateWorkspaceTestFile } from './helpers';
import { getConfig } from './config';

export async function activate(context: vscode.ExtensionContext) {
  const { testFilePatterns } = getConfig();
  const controller = vscode.tests.createTestController('RegoTestController', 'Rego');
  context.subscriptions.push(controller);

  controller.refreshHandler = async () => {
    for (let testFilePattern of testFilePatterns) {
      await refreshTestFiles(controller, testFilePattern, vscode.workspace.findFiles, vscode.workspace.fs.readFile);
    }
  };

  controller.createRunProfile(
    'Run Tests',
    vscode.TestRunProfileKind.Run,
    (request: vscode.TestRunRequest, cancellation: vscode.CancellationToken) =>
      handleRunRequest(controller, request, cancellation, getConfig),
    true,
    undefined,
    true,
  );

  // Discover tests by going through documents the editor is
  // currently aware of. This appears to only get the currently
  // focused document.
  for (const document of vscode.workspace.textDocuments) {
    updateWorkspaceTestFile(controller, document, testFilePatterns);
  }

  // Respond to document changes, whether editing or creation
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      // Get the config again, as it may have changed since the plugin was installed
      const { testFilePatterns } = getConfig();
      updateWorkspaceTestFile(controller, document, testFilePatterns);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      // Get the config again, as it may have changed since the plugin was installed
      const { testFilePatterns } = getConfig();
      updateWorkspaceTestFile(controller, event.document, testFilePatterns);
    }),
  );
}
