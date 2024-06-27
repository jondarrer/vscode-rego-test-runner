import * as vscode from 'vscode';

import { refreshTestFile, refreshTestFiles, setupFileSystemWatchers, updateWorkspaceTestFile } from './test-discovery';
import { handleRunRequest, handleFileChanged } from './test-execution';
import { getConfig } from './config';
import { INote } from './types';

export async function activate(context: vscode.ExtensionContext) {
  const { testFilePatterns } = getConfig();
  const controller = vscode.tests.createTestController('RegoTestController', 'Rego');
  const noteTracker = new Set<string>();

  context.subscriptions.push(controller);

  const watchedTests = new Map<vscode.TestItem | 'ALL', vscode.TestRunProfile | undefined>();
  const fileChangedEmitter = new vscode.EventEmitter<vscode.Uri>();
  fileChangedEmitter.event((uri) => {
    // Get the config again, as it may have changed since the plugin was activated
    const { cwd, policyTestDir, opaCommand } = getConfig();
    handleFileChanged(
      controller,
      vscode.TestRunRequest,
      uri,
      watchedTests,
      cwd,
      policyTestDir,
      vscode.TestMessage,
      opaCommand,
    );
  });

  controller.refreshHandler = async () => {
    // Get the config again, as it may have changed since the plugin was activated
    const { testFilePatterns, policyTestPath } = getConfig();
    const notes: INote[] = [];

    for (let testFilePattern of testFilePatterns) {
      await refreshTestFiles(
        controller,
        testFilePattern,
        vscode.workspace.findFiles,
        vscode.workspace.fs.readFile,
        notes,
        policyTestPath,
      );
    }

    displayNotes(notes, noteTracker);
  };

  controller.resolveHandler = async (item: vscode.TestItem | undefined) => {
    const notes: INote[] = [];
    const { policyTestPath } = getConfig();

    if (!item) {
      context.subscriptions.push(
        ...setupFileSystemWatchers(
          controller,
          fileChangedEmitter,
          vscode.workspace.createFileSystemWatcher,
          vscode.workspace.fs.readFile,
          getConfig,
          notes,
        ),
      );

      // Discover tests by going through documents in the workspace
      for (let testFilePattern of testFilePatterns) {
        await refreshTestFiles(
          controller,
          testFilePattern,
          vscode.workspace.findFiles,
          vscode.workspace.fs.readFile,
          notes,
          policyTestPath,
        );
      }
    } else if (item.uri) {
      await refreshTestFile(controller, item.uri, vscode.workspace.fs.readFile, notes, policyTestPath);
    }

    displayNotes(notes, noteTracker);
  };

  controller.createRunProfile(
    'Run Tests',
    vscode.TestRunProfileKind.Run,
    (request: vscode.TestRunRequest, cancellation: vscode.CancellationToken) =>
      handleRunRequest(controller, request, cancellation, getConfig, watchedTests, vscode.TestMessage),
    true,
    undefined,
    true,
  );

  // Respond to document changes, whether editing or creation
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      // Get the config again, as it may have changed since the plugin was activated
      const { testFilePatterns, policyTestPath } = getConfig();
      updateWorkspaceTestFile(controller, document, testFilePatterns, policyTestPath);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      // Get the config again, as it may have changed since the plugin was activated
      const { testFilePatterns, policyTestPath } = getConfig();
      updateWorkspaceTestFile(controller, event.document, testFilePatterns, policyTestPath);
    }),
  );
}

const displayNotes = (notes: INote[], noteTracker: Set<string>) => {
  for (let i = 0; i < notes.length; i++) {
    // Only show messages which haven't already been shown
    if (!noteTracker.has(`${notes[0].type}:${notes[0].message}`)) {
      vscode.window.showWarningMessage(notes[i].message);
    }
  }
};
