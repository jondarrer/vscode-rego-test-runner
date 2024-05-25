import {
  FindFilesFunc,
  ICancellationToken,
  GlobPatternType,
  ITestController,
  ITestItem,
  ITestRunRequest,
  ITextDocument,
  IUri,
} from './types';

export const handleRunRequest = (
  controller: ITestController,
  request: ITestRunRequest,
  cancellation: ICancellationToken
) => {};

export const updateWorkspaceTestFile = (
  controller: ITestController,
  document: ITextDocument
): ITestItem | undefined => {
  if (document.uri.scheme !== 'file') {
    return;
  }

  if (!document.uri.path.endsWith('_test.rego')) {
    return;
  }

  return registerTestItemFile(controller, document.uri);
};

export const registerTestItemFile = (controller: ITestController, uri: IUri): ITestItem => {
  const existing = controller.items.get(uri.toString());
  if (existing) {
    return existing;
  }

  const item = controller.createTestItem(uri.toString(), uri.path.split('/').pop()!, uri);
  controller.items.add(item);
  return item;
};

export const refreshTestFiles = async (
  controller: ITestController,
  pattern: string,
  findFiles: FindFilesFunc
): Promise<ITestItem[]> => {
  return (await findFiles(pattern)).map((uri) => registerTestItemFile(controller, uri));
};