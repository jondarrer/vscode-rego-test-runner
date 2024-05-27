import * as vscode from 'vscode';
import { handleRunRequest, refreshTestFiles, updateWorkspaceTestFile } from './helpers';

export async function activate(context: vscode.ExtensionContext) {
  const cwd = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0].uri.path;
  const controller = vscode.tests.createTestController('RegoTestController', 'Rego');
  context.subscriptions.push(controller);

  controller.refreshHandler = async () => {
    await refreshTestFiles(controller, '**/*_test.rego', vscode.workspace.findFiles, vscode.workspace.fs.readFile);
  };

  controller.createRunProfile(
    'Run Tests',
    vscode.TestRunProfileKind.Run,
    (request: vscode.TestRunRequest, cancellation: vscode.CancellationToken) =>
      handleRunRequest(controller, request, cancellation, cwd),
    true,
    undefined,
    true
  );

  // Discover tests by going through documents the editor is
  // currently aware of. This appears to only get the currently
  // focused document.
  for (const document of vscode.workspace.textDocuments) {
    updateWorkspaceTestFile(controller, document);
  }

  // Respond to document changes, whether editing or creation
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => updateWorkspaceTestFile(controller, document)),
    vscode.workspace.onDidChangeTextDocument((event) => updateWorkspaceTestFile(controller, event.document))
  );
}
