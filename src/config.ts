import * as vscode from 'vscode';
import os from 'node:os';
import { IGetConfigFunc } from './types';

export const getConfig: IGetConfigFunc = () => {
  const cwd = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0].uri.fsPath;
  const opaCommand: string =
    vscode.workspace.getConfiguration('regoTest').get('opaCommand') || (os.platform() === 'win32' ? 'opa.exe' : 'opa');
  const policyTestDir: string = vscode.workspace.getConfiguration('regoTest').get('policyTestDir') || '.';
  const testFilePatterns: string[] = vscode.workspace.getConfiguration('regoTest').get('testFilePatterns') || [
    '**/*_test.rego',
  ];

  return {
    cwd,
    opaCommand,
    policyTestDir,
    testFilePatterns,
  };
};
