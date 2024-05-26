import * as vscode from 'vscode';
import { handleRunRequest, refreshTestFiles, updateWorkspaceTestFile } from './helpers';

export async function activate(context: vscode.ExtensionContext) {
  const controller = vscode.tests.createTestController('RegoTestController', 'Rego');
  context.subscriptions.push(controller);

  controller.refreshHandler = async () => {
    await refreshTestFiles(controller, '**/*_test.rego', vscode.workspace.findFiles, vscode.workspace.fs.readFile);
  };

  controller.createRunProfile(
    'Run Tests',
    vscode.TestRunProfileKind.Run,
    (request: vscode.TestRunRequest, cancellation: vscode.CancellationToken) =>
      handleRunRequest(controller, request, cancellation),
    true,
    undefined,
    true
  );
}
